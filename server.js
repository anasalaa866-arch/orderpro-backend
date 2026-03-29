const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;

let orders = [];
let nextId = 1;

app.use(cors({ origin: '*' }));
app.use('/webhook/shopify', express.raw({ type: 'application/json' }));
app.use(express.json());

function mapShopifyOrder(sh) {
  const shipping = sh.shipping_address || {};
  const customer = sh.customer || {};
  const shippingLine = (sh.shipping_lines || [])[0] || {};
  const sm = (shippingLine.title || '').toLowerCase();
  const isSameDay = sm.includes('same day');
  const isPickupOrder = (sm.includes('pick up') || sm.includes('pickup') || sm.includes('trivium')) && !sm.includes('transit');
  const isTransitOrder = sm.includes('transit') || sm.includes('مخزن العبور') || sm.includes('عبور');
  let status = 'جديد';
  if (sh.cancelled_at) status = 'ملغي';
  else if (sh.fulfillment_status === 'fulfilled') status = 'مكتمل';
  else if (sh.fulfillment_status === 'partial') status = 'جاري التوصيل';
  return {
    id: 'SH-' + sh.order_number,
    shopifyId: String(sh.id),
    src: 'shopify',
    name: shipping.first_name ? (shipping.first_name + ' ' + (shipping.last_name||'')).trim() : customer.first_name ? (customer.first_name + ' ' + (customer.last_name||'')).trim() : 'عميل',
    phone: shipping.phone || customer.phone || '—',
    area: [shipping.city, shipping.address1].filter(Boolean).join(' - ') || '—',
    addr: [shipping.address1, shipping.address2, shipping.city].filter(Boolean).join('، ') || '—',
    total: parseFloat(sh.total_price) || 0,
    ship: 50,
    courierId: null,
    status,
    paid: sh.financial_status === 'paid',
    shippingMethod: shippingLine.title || '',
    deliveryType: isTransitOrder ? 'transit' : isPickupOrder ? 'pickup' : isSameDay ? 'express' : 'normal',
    note: sh.note || '',
    items: (sh.line_items || []).map(i => i.name + ' x' + i.quantity).join(', '),
    time: new Date(sh.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    createdAt: sh.created_at || new Date().toISOString(),
  };
}

app.post('/webhook/shopify', (req, res) => {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '';
  if (secret) {
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const hash = crypto.createHmac('sha256', secret).update(req.body).digest('base64');
    if (hash !== hmac) return res.status(401).json({ error: 'Unauthorized' });
  }
  const sh = JSON.parse(req.body);
  const order = mapShopifyOrder(sh);
  const existing = orders.findIndex(o => o.shopifyId === order.shopifyId);
  if (existing >= 0) orders[existing] = { ...orders[existing], ...order };
  else orders.unshift(order);
  console.log('Webhook:', order.id, order.name);
  res.status(200).json({ received: true });
});

app.post('/api/import-shopify', async (req, res) => {
  const { shopUrl, accessToken, days = 15 } = req.body;
  if (!shopUrl || !accessToken) return res.status(400).json({ error: 'shopUrl و accessToken مطلوبان' });
  const since = new Date();
  since.setDate(since.getDate() - days);
  try {
    let fetched = 0;
    const shopifyOrders = await fetchShopifyOrders(
      shopUrl, accessToken, since.toISOString(),
      (count) => { fetched = count; }
    );
    let imported = 0, updated = 0;
    for (const sh of shopifyOrders) {
      const order = mapShopifyOrder(sh);
      const idx = orders.findIndex(o => o.shopifyId === order.shopifyId);
      if (idx >= 0) {
        if (!orders[idx].courierId) orders[idx] = { ...orders[idx], ...order };
        updated++;
      } else {
        orders.push(order);
        imported++;
      }
    }
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    console.log(`Import done: ${imported} new, ${updated} updated, ${shopifyOrders.length} total`);
    res.json({
      success: true,
      imported,
      updated,
      total: shopifyOrders.length,
      pages: Math.ceil(shopifyOrders.length / 250),
      message: `تم استيراد ${imported} طلب جديد وتحديث ${updated} طلب (إجمالي ${shopifyOrders.length} طلب من Shopify)`
    });
  } catch (err) {
    console.error('Import error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// جلب صفحة واحدة من Shopify
function fetchPage(host, accessToken, path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host, path, method: 'GET',
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      // استخراج link header للـ pagination
      const linkHeader = res.headers['link'] || '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(data);
          if (p.errors) return reject(new Error(JSON.stringify(p.errors)));
          // استخراج رابط الصفحة التالية من Link header
          let nextUrl = null;
          if (linkHeader) {
            const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
            if (match) {
              // نأخذ الـ path فقط من الـ URL
              try {
                const u = new URL(match[1]);
                nextUrl = u.pathname + u.search;
              } catch(e) {
                nextUrl = match[1];
              }
            }
          }
          resolve({ orders: p.orders || [], nextUrl });
        } catch (e) { reject(new Error('فشل في قراءة رد Shopify')); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// جلب كل الطلبات مع pagination تلقائي
async function fetchShopifyOrders(shopUrl, accessToken, sinceDate, onProgress) {
  const host = shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  let path = `/admin/api/2024-01/orders.json?status=any&created_at_min=${encodeURIComponent(sinceDate)}&limit=250&order=created_at+desc`;
  
  let allOrders = [];
  let pageNum = 1;

  while (path) {
    console.log(`📄 جلب صفحة ${pageNum}... (${allOrders.length} طلب حتى الآن)`);
    const { orders, nextUrl } = await fetchPage(host, accessToken, path);
    allOrders = allOrders.concat(orders);
    
    if (onProgress) onProgress(allOrders.length);
    
    // لو مفيش صفحة تانية أو الصفحة فارغة، وقف
    if (!nextUrl || orders.length === 0) break;
    
    path = nextUrl;
    pageNum++;
    
    // حماية — max 20 صفحة (5000 طلب)
    if (pageNum > 20) {
      console.log('⚠️ وصلنا لحد 5000 طلب');
      break;
    }
  }
  
  console.log(`✅ انتهى الاستيراد: ${allOrders.length} طلب إجمالي`);
  return allOrders;
}

app.get('/api/orders', (req, res) => res.json({ orders, total: orders.length }));
app.post('/api/orders', (req, res) => { const order = { id: 'MN-'+(1000+nextId++), src:'manual', createdAt:new Date().toISOString(), time:new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}), status:'في الانتظار', courierId:null, ship:50, ...req.body }; orders.unshift(order); res.json({ order }); });
app.patch('/api/orders/:id', (req, res) => { const o = orders.find(o => o.id===req.params.id); if (!o) return res.status(404).json({ error:'not found' }); Object.assign(o, req.body); res.json({ order: o }); });
app.delete('/api/orders/:id', (req, res) => { orders = orders.filter(o => o.id!==req.params.id); res.json({ ok:true }); });
app.get('/', (req, res) => res.json({ status:'✅ OrderPro Backend شغال', orders:orders.length, uptime:Math.floor(process.uptime())+' ثانية' }));

// ===== BOSTA PROXY =====
const BOSTA_URL = (env) => env==='staging'
  ? 'https://staging.bostaapp.com/api/v0'
  : 'https://app.bosta.co/api/v0';

function bostaRequest(env, apiKey, path, method='GET', body=null){
  return new Promise((resolve, reject)=>{
    const base = BOSTA_URL(env);
    const url = new URL(base + path);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
    };
    const protocol = url.protocol === 'https:' ? require('https') : require('http');
    const req = protocol.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data||'{}'), headers: res.headers }); }
        catch(e) { resolve({ status: res.statusCode, data: {raw: data}, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    if(body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Test Bosta connection
app.post('/api/bosta/test', async (req, res) => {
  const { apiKey, env='production' } = req.body;
  if(!apiKey) return res.status(400).json({ success:false, error:'API Key مطلوب' });
  try {
    const r = await bostaRequest(env, apiKey, '/pickup-locations');
    if(r.status===200){
      const locs = r.data.data||r.data||[];
      res.json({ success:true, message:'متصل بنجاح', locations: Array.isArray(locs)?locs.length:1 });
    } else if(r.status===401){
      res.json({ success:false, error:'الـ API Key غلط أو منتهي — تأكد من الـ Key من داشبورد بوسطة' });
    } else {
      res.json({ success:false, error:'HTTP '+r.status+': '+JSON.stringify(r.data) });
    }
  } catch(e) {
    res.status(500).json({ success:false, error: e.message });
  }
});

// Create Bosta delivery
app.post('/api/bosta/create', async (req, res) => {
  const { apiKey, env='production', locationId, order } = req.body;
  if(!apiKey||!order) return res.status(400).json({ success:false, error:'بيانات ناقصة' });
  
  const nameParts = (order.name||'').trim().split(/\s+/);
  const payload = {
    type: 10, // SEND
    specs: { packageDetails: { numberOfParcels: 1 } },
    cod: order.paid ? 0 : (order.total||0),
    dropOffAddress: {
      city: order.area||'القاهرة',
      firstLine: order.addr||order.area||'—',
    },
    receiver: {
      firstName: nameParts[0]||'عميل',
      lastName: nameParts.slice(1).join(' ')||'.',
      phone: (order.phone||'01000000000').replace(/[^0-9+]/g,''),
    },
    businessReference: order.id,
    notes: order.note||'',
  };
  if(locationId) payload.pickupAddress = { _id: locationId };

  try {
    const r = await bostaRequest(env, apiKey, '/deliveries', 'POST', payload);
    if(r.status===200||r.status===201){
      const d = r.data.data||r.data;
      res.json({ success:true, deliveryId:d._id||d.id, trackingNumber:d.trackingNumber||d._id });
    } else {
      res.json({ success:false, error:'HTTP '+r.status+': '+(r.data.message||r.data.error||JSON.stringify(r.data)) });
    }
  } catch(e) {
    res.status(500).json({ success:false, error: e.message });
  }
});

app.listen(PORT, () => console.log('OrderPro Backend on port', PORT));
