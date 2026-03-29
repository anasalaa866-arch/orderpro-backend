const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const https = require('https');
const { Pool } = require('pg');
const app = express();
const PORT = process.env.PORT || 3000;

// ===== DATABASE =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// إنشاء الجداول
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        shopify_id TEXT,
        src TEXT DEFAULT 'manual',
        name TEXT,
        phone TEXT,
        area TEXT,
        addr TEXT,
        total NUMERIC DEFAULT 0,
        ship NUMERIC DEFAULT 50,
        courier_id INTEGER,
        status TEXT DEFAULT 'جديد',
        paid BOOLEAN DEFAULT false,
        shipping_method TEXT,
        delivery_type TEXT DEFAULT 'normal',
        note TEXT,
        items TEXT,
        time TEXT,
        bosta_id TEXT,
        bosta_tracking TEXT,
        bosta_awb_url TEXT,
        bosta_awb_base64 TEXT,
        bosta_status TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS couriers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        zone TEXT,
        vehicle TEXT,
        ship NUMERIC DEFAULT 50,
        ship_express NUMERIC DEFAULT 80,
        status TEXT DEFAULT 'متاح',
        settled BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        icon TEXT,
        title TEXT,
        sub TEXT,
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Database tables ready');
  } catch (err) {
    console.error('❌ DB init error:', err.message);
  }
}

// ===== MIDDLEWARE =====
app.use(cors({ origin: '*' }));
app.use('/webhook/shopify', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));

// ===== HELPER: map Shopify order =====
function mapShopifyOrder(sh) {
  const shipping = sh.shipping_address || {};
  const customer = sh.customer || {};
  const shippingLine = (sh.shipping_lines || [])[0] || {};
  const sm = (shippingLine.title || '').toLowerCase();
  const isSameDay = sm.includes('same day');
  const isPickupOrder = (sm.includes('pick up') || sm.includes('pickup') || sm.includes('trivium')) && !sm.includes('transit');
  const isTransitOrder = sm.includes('transit') || sm.includes('مخزن العبور');
  let status = 'جديد';
  if (sh.cancelled_at) status = 'ملغي';
  else if (sh.fulfillment_status === 'fulfilled') status = 'مكتمل';
  else if (sh.fulfillment_status === 'partial') status = 'جاري التوصيل';
  return {
    id: 'SH-' + sh.order_number,
    shopify_id: String(sh.id),
    src: 'shopify',
    name: shipping.first_name ? (shipping.first_name + ' ' + (shipping.last_name || '')).trim() : customer.first_name ? (customer.first_name + ' ' + (customer.last_name || '')).trim() : 'عميل',
    phone: shipping.phone || customer.phone || '—',
    area: [shipping.city, shipping.address1].filter(Boolean).join(' - ') || '—',
    addr: [shipping.address1, shipping.address2, shipping.city].filter(Boolean).join('، ') || '—',
    total: parseFloat(sh.total_price) || 0,
    ship: 50,
    courier_id: null,
    status,
    paid: sh.financial_status === 'paid',
    shipping_method: shippingLine.title || '',
    delivery_type: isTransitOrder ? 'transit' : isPickupOrder ? 'pickup' : isSameDay ? 'express' : 'normal',
    note: sh.note || '',
    items: (sh.line_items || []).map(i => i.name + ' x' + i.quantity).join(', '),
    time: new Date(sh.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    created_at: sh.created_at || new Date().toISOString(),
  };
}

// helper: row to frontend format
function rowToOrder(r) {
  return {
    id: r.id, shopifyId: r.shopify_id, src: r.src, name: r.name,
    phone: r.phone, area: r.area, addr: r.addr,
    total: parseFloat(r.total) || 0, ship: parseFloat(r.ship) || 50,
    courierId: r.courier_id, status: r.status, paid: r.paid,
    shippingMethod: r.shipping_method, deliveryType: r.delivery_type,
    note: r.note, items: r.items, time: r.time,
    bostaId: r.bosta_id, bostaTrackingNo: r.bosta_tracking,
    bostaAwbUrl: r.bosta_awb_url, bostaAwbBase64: r.bosta_awb_base64,
    bostaStatus: r.bosta_status,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

// ===== SHOPIFY WEBHOOK =====
app.post('/webhook/shopify', async (req, res) => {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '';
  if (secret) {
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const hash = crypto.createHmac('sha256', secret).update(req.body).digest('base64');
    if (hash !== hmac) return res.status(401).json({ error: 'Unauthorized' });
  }
  const sh = JSON.parse(req.body);
  const o = mapShopifyOrder(sh);
  try {
    await pool.query(`
      INSERT INTO orders (id,shopify_id,src,name,phone,area,addr,total,ship,courier_id,status,paid,shipping_method,delivery_type,note,items,time,created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (id) DO UPDATE SET
        name=EXCLUDED.name, phone=EXCLUDED.phone, area=EXCLUDED.area,
        addr=EXCLUDED.addr, total=EXCLUDED.total, status=EXCLUDED.status,
        paid=EXCLUDED.paid, shipping_method=EXCLUDED.shipping_method,
        delivery_type=EXCLUDED.delivery_type, note=EXCLUDED.note,
        items=EXCLUDED.items, updated_at=NOW()
    `, [o.id, o.shopify_id, o.src, o.name, o.phone, o.area, o.addr, o.total, o.ship,
        o.courier_id, o.status, o.paid, o.shipping_method, o.delivery_type,
        o.note, o.items, o.time, o.created_at]);
    await pool.query(`INSERT INTO notifications (icon,title,sub) VALUES ($1,$2,$3)`,
      ['📦', 'طلب جديد من Shopify', `${o.id} — ${o.name} — ${o.total} ج`]);
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook DB error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== ORDERS API =====
app.get('/api/orders', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  res.json({ orders: rows.map(rowToOrder), total: rows.length });
});

app.post('/api/orders', async (req, res) => {
  const o = req.body;
  const id = o.id || 'MN-' + Date.now();
  const now = new Date().toISOString();
  await pool.query(`
    INSERT INTO orders (id,src,name,phone,area,addr,total,ship,courier_id,status,paid,delivery_type,note,items,time,created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    ON CONFLICT (id) DO NOTHING
  `, [id, o.src||'manual', o.name, o.phone||'—', o.area, o.addr||o.area,
      o.total||0, o.ship||50, o.courierId||null, o.status||'في الانتظار',
      o.paid||false, o.deliveryType||'normal', o.note||'', o.items||'',
      o.time||new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}), now]);
  const { rows } = await pool.query('SELECT * FROM orders WHERE id=$1', [id]);
  res.json({ order: rowToOrder(rows[0]) });
});

app.patch('/api/orders/:id', async (req, res) => {
  const b = req.body;
  const sets = [], vals = [];
  const map = {
    courierId:'courier_id', status:'status', paid:'paid', ship:'ship',
    note:'note', bostaId:'bosta_id', bostaTrackingNo:'bosta_tracking',
    bostaAwbUrl:'bosta_awb_url', bostaAwbBase64:'bosta_awb_base64',
    bostaStatus:'bosta_status', deliveryType:'delivery_type',
  };
  Object.entries(b).forEach(([k, v]) => {
    if (map[k]) { sets.push(`${map[k]}=$${vals.length+1}`); vals.push(v); }
  });
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
  sets.push(`updated_at=NOW()`);
  vals.push(req.params.id);
  await pool.query(`UPDATE orders SET ${sets.join(',')} WHERE id=$${vals.length}`, vals);
  const { rows } = await pool.query('SELECT * FROM orders WHERE id=$1', [req.params.id]);
  res.json({ order: rows[0] ? rowToOrder(rows[0]) : null });
});

app.delete('/api/orders/:id', async (req, res) => {
  await pool.query('DELETE FROM orders WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ===== IMPORT FROM SHOPIFY =====
app.post('/api/import-shopify', async (req, res) => {
  const { shopUrl, accessToken, days = 15 } = req.body;
  if (!shopUrl || !accessToken) return res.status(400).json({ error: 'بيانات ناقصة' });
  const since = new Date();
  since.setDate(since.getDate() - days);
  try {
    const shopifyOrders = await fetchShopifyOrders(shopUrl, accessToken, since.toISOString());
    let imported = 0, updated = 0;
    for (const sh of shopifyOrders) {
      const o = mapShopifyOrder(sh);
      // تحقق لو الطلب موجود
      const existing = await pool.query('SELECT id, courier_id FROM orders WHERE id=$1', [o.id]);
      if (existing.rows.length === 0) {
        // طلب جديد — أضفه
        await pool.query(`
          INSERT INTO orders (id,shopify_id,src,name,phone,area,addr,total,ship,courier_id,status,paid,shipping_method,delivery_type,note,items,time,created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
          ON CONFLICT (id) DO NOTHING
        `, [o.id, o.shopify_id, o.src, o.name, o.phone, o.area, o.addr, o.total, o.ship,
            null, o.status, o.paid, o.shipping_method, o.delivery_type,
            o.note, o.items, o.time, o.created_at]);
        imported++;
      } else {
        // طلب موجود — حدّث البيانات من Shopify بس لو مفيش مندوب معين
        if (!existing.rows[0].courier_id) {
          await pool.query(`
            UPDATE orders SET name=$1, phone=$2, area=$3, addr=$4, total=$5,
            status=$6, paid=$7, shipping_method=$8, delivery_type=$9,
            note=$10, items=$11, updated_at=NOW()
            WHERE id=$12
          `, [o.name, o.phone, o.area, o.addr, o.total,
              o.status, o.paid, o.shipping_method, o.delivery_type,
              o.note, o.items, o.id]);
        }
        updated++;
      }
    }
    res.json({ success: true, imported, updated, total: shopifyOrders.length,
      pages: Math.ceil(shopifyOrders.length / 250),
      message: `تم استيراد ${imported} طلب جديد وتحديث ${updated} طلب` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== COURIERS API =====
app.get('/api/couriers', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM couriers ORDER BY id');
  res.json({ couriers: rows.map(r => ({
    id: r.id, name: r.name, phone: r.phone, zone: r.zone,
    vehicle: r.vehicle, ship: parseFloat(r.ship), shipExpress: parseFloat(r.ship_express),
    status: r.status, settled: r.settled,
  })) });
});

app.post('/api/couriers', async (req, res) => {
  const c = req.body;
  const { rows } = await pool.query(`
    INSERT INTO couriers (name,phone,zone,vehicle,ship,ship_express,status)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [c.name, c.phone, c.zone||'غير محدد', c.vehicle||'دراجة بخارية',
      c.ship||50, c.shipExpress||80, c.status||'متاح']);
  res.json({ courier: rows[0] });
});

app.patch('/api/couriers/:id', async (req, res) => {
  const b = req.body;
  const map = { name:'name', phone:'phone', zone:'zone', vehicle:'vehicle',
    ship:'ship', shipExpress:'ship_express', status:'status', settled:'settled' };
  const sets = [], vals = [];
  Object.entries(b).forEach(([k, v]) => {
    if (map[k]) { sets.push(`${map[k]}=$${vals.length+1}`); vals.push(v); }
  });
  if (!sets.length) return res.status(400).json({ error: 'No fields' });
  vals.push(req.params.id);
  await pool.query(`UPDATE couriers SET ${sets.join(',')} WHERE id=$${vals.length}`, vals);
  const { rows } = await pool.query('SELECT * FROM couriers WHERE id=$1', [req.params.id]);
  res.json({ courier: rows[0] });
});

app.delete('/api/couriers/:id', async (req, res) => {
  await pool.query('DELETE FROM couriers WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ===== NOTIFICATIONS =====
app.get('/api/notifications', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100');
  res.json({ notifications: rows });
});

app.patch('/api/notifications/:id/read', async (req, res) => {
  await pool.query('UPDATE notifications SET read=true WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

app.patch('/api/notifications/read-all', async (req, res) => {
  await pool.query('UPDATE notifications SET read=true');
  res.json({ ok: true });
});

app.post('/api/notifications', async (req, res) => {
  const { icon, title, sub } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO notifications (icon,title,sub) VALUES ($1,$2,$3) RETURNING *',
    [icon||'📌', title||'', sub||'']
  );
  res.json({ notification: rows[0] });
});

// ===== BOSTA PROXY =====
const BOSTA_URL = (env) => env === 'staging'
  ? 'https://staging.bostaapp.com/api/v0'
  : 'https://app.bosta.co/api/v0';

function bostaRequest(env, apiKey, path, method = 'GET', body = null, binary = false) {
  return new Promise((resolve, reject) => {
    const base = BOSTA_URL(env);
    const url = new URL(base + path);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: { 'Authorization': apiKey, 'Content-Type': 'application/json', 'Accept': binary ? 'application/pdf' : 'application/json' }
    };
    const req = https.request(opts, res => {
      if (binary) {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, buffer: Buffer.concat(chunks), headers: res.headers }));
      } else {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(data || '{}'), headers: res.headers }); }
          catch { resolve({ status: res.statusCode, data: { raw: data }, headers: res.headers }); }
        });
      }
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

app.post('/api/bosta/test', async (req, res) => {
  const { apiKey, env = 'production' } = req.body;
  if (!apiKey) return res.status(400).json({ success: false, error: 'API Key مطلوب' });
  try {
    const r = await bostaRequest(env, apiKey, '/pickup-locations');
    if (r.status === 200) {
      const locs = r.data.data || r.data || [];
      res.json({ success: true, message: 'متصل بنجاح', locations: Array.isArray(locs) ? locs.length : 1 });
    } else if (r.status === 401) {
      res.json({ success: false, error: 'الـ API Key غلط — تحقق من داشبورد بوسطة' });
    } else {
      res.json({ success: false, error: 'HTTP ' + r.status + ': ' + JSON.stringify(r.data) });
    }
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/bosta/create', async (req, res) => {
  const { apiKey, env = 'production', locationId, order } = req.body;
  if (!apiKey || !order) return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
  const nameParts = (order.name || '').trim().split(/\s+/);
  const payload = {
    type: 10,
    specs: { packageDetails: { numberOfParcels: 1 } },
    cod: order.paid ? 0 : (order.total || 0),
    dropOffAddress: { city: order.area || 'القاهرة', firstLine: order.addr || order.area || '—' },
    receiver: {
      firstName: nameParts[0] || 'عميل',
      lastName: nameParts.slice(1).join(' ') || '.',
      phone: (order.phone || '01000000000').replace(/[^0-9+]/g, ''),
    },
    businessReference: order.id,
    notes: order.note || '',
  };
  if (locationId) payload.pickupAddress = { _id: locationId };
  try {
    const r = await bostaRequest(env, apiKey, '/deliveries', 'POST', payload);
    if (r.status === 200 || r.status === 201) {
      const d = r.data.data || r.data;
      const deliveryId = d._id || d.id;
      const trackingNumber = d.trackingNumber || d._id;

      // جلب الـ AWB تلقائياً بعد الإنشاء
      let awbBase64 = null, awbUrl = null;
      try {
        const awbR = await bostaRequest(env, apiKey, '/deliveries/'+deliveryId+'/airwaybill', 'GET', null, true);
        if (awbR.status === 200 && awbR.buffer) {
          awbBase64 = awbR.buffer.toString('base64');
          awbUrl = 'data:application/pdf;base64,' + awbBase64;
        }
      } catch (awbErr) { console.log('AWB fetch failed:', awbErr.message); }

      // حفظ في قاعدة البيانات
      if (order.id) {
        await pool.query(`
          UPDATE orders SET bosta_id=$1, bosta_tracking=$2, bosta_awb_url=$3,
          bosta_awb_base64=$4, bosta_status='created', updated_at=NOW()
          WHERE id=$5
        `, [deliveryId, trackingNumber, awbUrl, awbBase64, order.id]);

        await pool.query(`INSERT INTO notifications (icon,title,sub) VALUES ($1,$2,$3)`,
          ['🚚', 'تم رفع بوليصة بوسطة', `${order.id} — تتبع: ${trackingNumber}`]);
      }

      res.json({ success: true, deliveryId, trackingNumber, hasAwb: !!awbBase64 });
    } else {
      res.json({ success: false, error: 'HTTP ' + r.status + ': ' + (r.data.message || r.data.error || JSON.stringify(r.data)) });
    }
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// جلب الـ AWB لطلب موجود
app.get('/api/bosta/awb/:orderId', async (req, res) => {
  const { rows } = await pool.query('SELECT bosta_awb_base64, bosta_awb_url, bosta_id FROM orders WHERE id=$1', [req.params.orderId]);
  if (!rows[0]) return res.status(404).json({ error: 'الطلب مش موجود' });
  if (rows[0].bosta_awb_base64) {
    res.json({ success: true, awbBase64: rows[0].bosta_awb_base64, awbUrl: rows[0].bosta_awb_url });
  } else {
    res.json({ success: false, bostaId: rows[0].bosta_id, error: 'البوليصة مش محفوظة بعد' });
  }
});

// ===== SHOPIFY PAGINATION =====
function fetchPage(host, accessToken, path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host, path, method: 'GET',
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      const linkHeader = res.headers['link'] || '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(data);
          if (p.errors) return reject(new Error(JSON.stringify(p.errors)));
          let nextUrl = null;
          if (linkHeader) {
            const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
            if (match) { try { const u = new URL(match[1]); nextUrl = u.pathname + u.search; } catch { nextUrl = match[1]; } }
          }
          resolve({ orders: p.orders || [], nextUrl });
        } catch (e) { reject(new Error('فشل في قراءة رد Shopify')); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchShopifyOrders(shopUrl, accessToken, sinceDate) {
  const host = shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  let path = `/admin/api/2024-01/orders.json?status=any&created_at_min=${encodeURIComponent(sinceDate)}&limit=250&order=created_at+desc`;
  let allOrders = [], pageNum = 1;
  while (path) {
    const { orders, nextUrl } = await fetchPage(host, accessToken, path);
    allOrders = allOrders.concat(orders);
    if (!nextUrl || orders.length === 0 || pageNum >= 20) break;
    path = nextUrl; pageNum++;
  }
  return allOrders;
}

// ===== HEALTH =====
app.get('/', async (req, res) => {
  let dbOk = false, orderCount = 0;
  try { const r = await pool.query('SELECT COUNT(*) FROM orders'); orderCount = parseInt(r.rows[0].count); dbOk = true; } catch {}
  res.json({ status: '✅ OrderPro Backend شغال', db: dbOk ? '✅ متصل' : '❌ منفصل', orders: orderCount, uptime: Math.floor(process.uptime()) + ' ثانية' });
});

// ===== START =====
initDB().then(() => {
  app.listen(PORT, () => console.log('🚀 OrderPro Backend on port', PORT));
});
