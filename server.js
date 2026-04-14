const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const https = require('https');
const { Pool } = require('pg');
const app = express();

// Global error handlers - prevent crashes
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// ===== HTTPS Helper (compatible with all Node versions) =====
function httpsRequest(url, options={}, body=null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if(body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}
const PORT = process.env.PORT || 3000;

// ===== DATABASE =====
const DB_ENABLED = !!process.env.DATABASE_URL;
const pool = DB_ENABLED ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
}) : null;

console.log(DB_ENABLED ? '✅ PostgreSQL متصل' : '⚠️ بدون DB — استخدام الذاكرة');

// fallback in-memory
let memOrders = [];
let memCouriers = [];
let memNotifs = [];

// إنشاء الجداول
async function initDB() {
  if (!DB_ENABLED) { console.log('⚠️ DATABASE_URL غير موجودة — شغّال بدون DB'); return; }
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
        is_bosta BOOLEAN DEFAULT false,
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
        has_problem BOOLEAN DEFAULT false,
        assigned_zone TEXT,
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

      CREATE TABLE IF NOT EXISTS check_books (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        bank TEXT,
        account TEXT,
        pages INTEGER DEFAULT 48,
        note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS checks (
        id TEXT PRIMARY KEY,
        num TEXT,
        payee TEXT NOT NULL,
        amount NUMERIC DEFAULT 0,
        date DATE,
        book_id TEXT,
        invoice TEXT,
        note TEXT,
        img TEXT,
        status TEXT DEFAULT 'pending',
        done_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // جدول المستخدمين
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        pass_hash TEXT NOT NULL,
        pages TEXT DEFAULT '[]',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // جدول التسويات
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settlements (
        id SERIAL PRIMARY KEY,
        courier_id INTEGER NOT NULL,
        ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        order_ids TEXT DEFAULT '[]',
        cod NUMERIC DEFAULT 0,
        ship NUMERIC DEFAULT 0,
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('✅ Database tables ready');

    // Safe column migrations
    const migrations = [
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS addr2 TEXT",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_bosta BOOLEAN DEFAULT false",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS has_problem BOOLEAN DEFAULT false",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_zone TEXT",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS bosta_awb_url TEXT",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS bosta_awb_base64 TEXT",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS shop_settled BOOLEAN DEFAULT false",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS bosta_exported BOOLEAN DEFAULT false",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS line_items_json TEXT",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_price NUMERIC DEFAULT 0",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_price NUMERIC DEFAULT 0",
      "ALTER TABLE settlements ADD COLUMN IF NOT EXISTS adj TEXT DEFAULT '[]'",
      "ALTER TABLE check_books ADD COLUMN IF NOT EXISTS first_num INTEGER DEFAULT 1",
      "ALTER TABLE check_books ADD COLUMN IF NOT EXISTS last_num INTEGER",
    ];
    for (const sql of migrations) {
      try { await pool.query(sql); } catch(e) {}
    }
    console.log('✅ Migrations applied');

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
    addr2: shipping.address2 || '',
    total: parseFloat(sh.total_price) || 0,
    subtotal_price: parseFloat(sh.subtotal_price) || 0,
    shipping_price: (sh.shipping_lines || []).reduce((s, l) => s + (parseFloat(l.price) || 0), 0),
    ship: 50,
    courier_id: null,
    status,
    paid: sh.financial_status === 'paid' || sh.financial_status === 'partially_paid',
    shipping_method: shippingLine.title || '',
    delivery_type: isTransitOrder ? 'transit' : isPickupOrder ? 'pickup' : isSameDay ? 'express' : 'normal',
    note: sh.note || '',
    items: (sh.line_items || []).map(i => i.name + ' x' + i.quantity).join(', '),
    line_items_json: JSON.stringify((sh.line_items || []).map(i => ({
      name: i.name,
      title: i.title,
      variantTitle: i.variant_title || '',
      sku: i.sku || '',
      quantity: i.quantity,
      price: parseFloat(i.price) || 0,
      totalPrice: (parseFloat(i.price) || 0) * (i.quantity || 1),
      image: (i.image && i.image.src) ? i.image.src : null,
    }))),
    province: (sh.shipping_address || {}).province_code || '',
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
    addr2: r.addr2 || '',
    province: r.province || '',
    courierId: r.is_bosta ? 'bosta' : r.courier_id,
    isBosta: r.is_bosta || false, status: r.status, paid: r.paid,
    shippingMethod: r.shipping_method, deliveryType: r.delivery_type,
    note: r.note, items: r.items, time: r.time,
    bostaId: r.bosta_id, bostaTrackingNo: r.bosta_tracking,
    bostaAwbUrl: r.bosta_awb_url, bostaAwbBase64: r.bosta_awb_base64,
    bostaStatus: r.bosta_status, hasProblem: r.has_problem || false,
    assignedZone: r.assigned_zone || null,
    bostaExported: r.bosta_exported || false,
    lineItemsJson: r.line_items_json || null,
    subtotalPrice: parseFloat(r.subtotal_price) || 0,
    shippingPrice: parseFloat(r.shipping_price) || 0,
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
  // لو الطلب ملغي وقبل التوزيع = لغيه بس
  if (sh.cancelled_at) {
    const orderId = 'SH-' + sh.order_number;
    try {
      if (DB_ENABLED) {
        const existing = await pool.query('SELECT courier_id, status FROM orders WHERE id=$1', [orderId]);
        if (existing.rows.length) {
          const row = existing.rows[0];
          if (!row.courier_id && row.status !== 'جاري التوصيل' && row.status !== 'مكتمل') {
            await pool.query('UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2', ['ملغي', orderId]);
            console.log('Order auto-cancelled:', orderId);
          }
        }
      } else {
        const o = memOrders.find(x => x.id === orderId);
        if (o && !o.courierId && o.status !== 'جاري التوصيل') o.status = 'ملغي';
      }
    } catch(e) { console.error('Cancel error:', e.message); }
    return res.status(200).json({ received: true });
  }
  const o = mapShopifyOrder(sh);
  try {
    if (DB_ENABLED) {
      await pool.query(`
        INSERT INTO orders (id,shopify_id,src,name,phone,area,addr,addr2,total,subtotal_price,shipping_price,ship,courier_id,status,paid,shipping_method,delivery_type,note,items,line_items_json,time,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
        ON CONFLICT (id) DO UPDATE SET
          name=EXCLUDED.name, phone=EXCLUDED.phone, area=EXCLUDED.area,
          addr=EXCLUDED.addr, addr2=EXCLUDED.addr2, total=EXCLUDED.total,
          subtotal_price=EXCLUDED.subtotal_price, shipping_price=EXCLUDED.shipping_price,
          paid=EXCLUDED.paid, shipping_method=EXCLUDED.shipping_method,
          delivery_type=EXCLUDED.delivery_type, note=EXCLUDED.note,
          items=EXCLUDED.items, line_items_json=EXCLUDED.line_items_json,
          updated_at=NOW(),
          -- حدّث status بس لو الطلب ملغي على Shopify، أو لو لسه مش موزع
          status=CASE
            WHEN EXCLUDED.status='ملغي' THEN 'ملغي'
            WHEN orders.status IN ('جاري التوصيل','مكتمل','ملغي') THEN orders.status
            ELSE EXCLUDED.status
          END
      `, [o.id, o.shopify_id, o.src, o.name, o.phone, o.area, o.addr, o.addr2||'', o.total,
          o.subtotal_price||0, o.shipping_price||0, o.ship,
          o.courier_id, o.status, o.paid, o.shipping_method, o.delivery_type,
          o.note, o.items, o.line_items_json, o.time, o.created_at]);
    } else {
      const idx = memOrders.findIndex(x=>x.id===o.id);
      if (idx<0) memOrders.unshift({...o, shopifyId:o.shopify_id, courierId:null});
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook DB error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== ORDERS API =====
app.get('/api/orders', async (req, res) => {
  if (!DB_ENABLED) return res.json({ orders: memOrders, total: memOrders.length });
  const { rows } = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  res.json({ orders: rows.map(rowToOrder), total: rows.length });
});

app.post('/api/orders', async (req, res) => {
  const o = req.body;
  const id = o.id || 'MN-' + Date.now();
  const now = new Date().toISOString();
  const newOrder = { id, src:o.src||'manual', name:o.name, phone:o.phone||'—', area:o.area, addr:o.addr||o.area, total:o.total||0, ship:o.ship||50, courierId:o.courierId||null, status:o.status||'في الانتظار', paid:o.paid||false, deliveryType:o.deliveryType||'normal', note:o.note||'', items:o.items||'', time:o.time||new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}), createdAt:now };
  if (!DB_ENABLED) {
    if (!memOrders.find(x=>x.id===id)) memOrders.unshift(newOrder);
    return res.json({ order: newOrder });
  }
  await pool.query(`
    INSERT INTO orders (id,src,name,phone,area,addr,total,ship,courier_id,status,paid,delivery_type,note,items,time,created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    ON CONFLICT (id) DO NOTHING
  `, [id, newOrder.src, newOrder.name, newOrder.phone, newOrder.area, newOrder.addr,
      newOrder.total, newOrder.ship, newOrder.courierId, newOrder.status,
      newOrder.paid, newOrder.deliveryType, newOrder.note, newOrder.items,
      newOrder.time, now]);
  const { rows } = await pool.query('SELECT * FROM orders WHERE id=$1', [id]);
  res.json({ order: rowToOrder(rows[0]) });
});

app.patch('/api/orders/:id', async (req, res) => {
  const b = req.body;
  if (!DB_ENABLED) {
    const o = memOrders.find(x=>x.id===req.params.id);
    if (!o) return res.status(404).json({ error: 'not found' });
    Object.assign(o, b);
    return res.json({ order: o });
  }
  const sets = [], vals = [];
  const map = {
    courierId:'courier_id', isBosta:'is_bosta', status:'status', paid:'paid', ship:'ship',
    note:'note', bostaId:'bosta_id', bostaTrackingNo:'bosta_tracking',
    bostaAwbUrl:'bosta_awb_url', bostaAwbBase64:'bosta_awb_base64',
    bostaStatus:'bosta_status', deliveryType:'delivery_type',
    hasProblem:'has_problem',
    assignedZone:'assigned_zone',
    bostaExported:'bosta_exported',
    name:'name', phone:'phone', area:'area', addr:'addr',
    province:'province',
    items:'items', total:'total', lineItemsJson:'line_items_json',
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
  if (!DB_ENABLED) { memOrders = memOrders.filter(o=>o.id!==req.params.id); return res.json({ ok:true }); }
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

    if (!DB_ENABLED) {
      // in-memory fallback
      for (const sh of shopifyOrders) {
        const o = mapShopifyOrder(sh);
        const idx = memOrders.findIndex(x=>x.id===o.id||x.shopifyId===o.shopify_id);
        if (idx < 0) { memOrders.push({...o, shopifyId:o.shopify_id, courierId:null}); imported++; }
        else updated++;
      }
    } else {
      // PostgreSQL - bulk upsert أسرع بكتير
      const mappedOrders = shopifyOrders.map(sh => mapShopifyOrder(sh));
      
      // جيب كل الـ IDs الموجودة مرة واحدة بدل query لكل طلب
      const allIds = mappedOrders.map(o => o.id);
      const allShopifyIds = mappedOrders.map(o => o.shopify_id);
      
      const existingRows = await pool.query(
        'SELECT id, shopify_id, courier_id FROM orders WHERE id = ANY($1) OR shopify_id = ANY($2)',
        [allIds, allShopifyIds]
      );
      const existingMap = {};
      existingRows.rows.forEach(r => {
        existingMap[r.id] = r;
        if (r.shopify_id) existingMap[r.shopify_id] = r;
      });

      // Bulk insert للجديد
      const toInsert = mappedOrders.filter(o => !existingMap[o.id] && !existingMap[o.shopify_id]);
      const toUpdate = mappedOrders.filter(o => {
        const ex = existingMap[o.id] || existingMap[o.shopify_id];
        return ex && !ex.courier_id;
      });

      // Insert الجديد بـ chunks
      const CHUNK = 50;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK);
        for (const o of chunk) {
          await pool.query(`
            INSERT INTO orders (id,shopify_id,src,name,phone,area,addr,total,ship,courier_id,status,paid,shipping_method,delivery_type,note,items,time,created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
            ON CONFLICT (id) DO NOTHING
          `, [o.id, o.shopify_id, o.src, o.name, o.phone, o.area, o.addr, o.total, o.ship,
              null, o.status, o.paid, o.shipping_method, o.delivery_type,
              o.note, o.items, o.time, o.created_at]);
        }
        imported += chunk.length;
      }

      // Update الموجود
      for (const o of toUpdate) {
        await pool.query(`
          UPDATE orders SET name=$1, phone=$2, area=$3, addr=$4, total=$5,
          status=$6, paid=$7, shipping_method=$8, delivery_type=$9,
          note=$10, items=$11, updated_at=NOW() WHERE id=$12
        `, [o.name, o.phone, o.area, o.addr, o.total,
            o.status, o.paid, o.shipping_method, o.delivery_type,
            o.note, o.items, o.id]);
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
  if (!DB_ENABLED) return res.json({ couriers: memCouriers });
  const { rows } = await pool.query('SELECT * FROM couriers ORDER BY id');
  res.json({ couriers: rows.map(r => ({
    id: r.id, name: r.name, phone: r.phone, zone: r.zone,
    vehicle: r.vehicle, ship: parseFloat(r.ship), shipExpress: parseFloat(r.ship_express),
    status: r.status, settled: r.settled,
    settledAt: r.settled_at || null,
  })) });
});

app.post('/api/couriers', async (req, res) => {
  const c = req.body;
  if (!DB_ENABLED) {
    const id = memCouriers.length ? Math.max(...memCouriers.map(x=>x.id))+1 : 1;
    const nc = {id, name:c.name, phone:c.phone, zone:c.zone||'غير محدد', vehicle:c.vehicle||'دراجة بخارية', ship:c.ship||50, shipExpress:c.shipExpress||80, status:c.status||'متاح', settled:false};
    memCouriers.push(nc);
    return res.json({ courier: nc });
  }
  const { rows } = await pool.query(`
    INSERT INTO couriers (name,phone,zone,vehicle,ship,ship_express,status)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [c.name, c.phone, c.zone||'غير محدد', c.vehicle||'دراجة بخارية',
      c.ship||50, c.shipExpress||80, c.status||'متاح']);
  res.json({ courier: rows[0] });
});

app.patch('/api/couriers/:id', async (req, res) => {
  const b = req.body;
  if (!DB_ENABLED) {
    const c = memCouriers.find(x=>x.id==req.params.id);
    if (c) Object.assign(c, b);
    return res.json({ courier: c });
  }
  const map = { name:'name', phone:'phone', zone:'zone', vehicle:'vehicle',
    ship:'ship', shipExpress:'ship_express', status:'status', settled:'settled', settledAt:'settled_at' };
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
  if (!DB_ENABLED) { memCouriers = memCouriers.filter(x=>x.id!=req.params.id); return res.json({ ok:true }); }
  await pool.query('DELETE FROM couriers WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ===== NOTIFICATIONS =====
app.get('/api/notifications', async (req, res) => {
  if (!DB_ENABLED) return res.json({ notifications: memNotifs.slice(0,100) });
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
  if (!DB_ENABLED) {
    const n = {id:Date.now(), icon:icon||'📌', title:title||'', sub:sub||'', read:false, created_at:new Date().toISOString()};
    memNotifs.unshift(n);
    return res.json({ notification: n });
  }
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


// Bosta AWB PDF
app.post('/api/bosta/awb', async (req, res) => {
  const { apiKey, env, deliveryId } = req.body;
  if(!apiKey || !deliveryId) return res.json({success:false, error:'Missing params'});
  const baseUrl = env==='staging' 
    ? 'https://staging.bosta.co/api/v2'
    : 'https://app.bosta.co/api/v2';
  try {
    const data = await httpsRequest(`${baseUrl}/deliveries/${deliveryId}/awb`, {
      headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' }
    });
    if(data && data.base64) return res.json({success:true, base64: data.base64});
    return res.json({success:false, error: JSON.stringify(data).slice(0,200)});
  } catch(e) {
    return res.json({success:false, error: e.message});
  }
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
  // pickupAddress مطلوبة دايماً ببوسطة — لازم يكون فيها firstLine
  if (locationId) {
    payload.pickupAddress = {
      _id: locationId,
      firstLine: order.pickupAddress || 'المحل',
      city: 'القاهرة',
    };
  } else if (order.pickupAddress) {
    payload.pickupAddress = {
      firstLine: order.pickupAddress,
      city: 'القاهرة',
    };
  } else {
    // fallback — اسم المحل كعنوان استلام
    payload.pickupAddress = {
      firstLine: order.businessName || 'المحل',
      city: 'القاهرة',
    };
  }
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

      // حفظ في قاعدة البيانات أو الذاكرة
      if (order.id) {
        if (DB_ENABLED) {
          await pool.query(`
            UPDATE orders SET bosta_id=$1, bosta_tracking=$2, bosta_awb_url=$3,
            bosta_awb_base64=$4, bosta_status='created', updated_at=NOW()
            WHERE id=$5
          `, [deliveryId, trackingNumber, awbUrl, awbBase64, order.id]);
        } else {
          const o = memOrders.find(x=>x.id===order.id);
          if (o) { o.bostaId=deliveryId; o.bostaTrackingNo=trackingNumber; o.bostaAwbBase64=awbBase64; }
        }
      }

      res.json({ success: true, deliveryId, trackingNumber, hasAwb: !!awbBase64 });
    } else {
      res.json({ success: false, error: 'HTTP ' + r.status + ': ' + (r.data.message || r.data.error || JSON.stringify(r.data)) });
    }
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// جلب الـ AWB لطلب موجود
app.get('/api/bosta/awb/:orderId', async (req, res) => {
  if (!DB_ENABLED) {
    const o = memOrders.find(x=>x.id===req.params.orderId);
    if (!o) return res.status(404).json({ error: 'الطلب مش موجود' });
    return o.bostaAwbBase64
      ? res.json({ success:true, awbBase64:o.bostaAwbBase64 })
      : res.json({ success:false, bostaId:o.bostaId, error:'البوليصة مش محفوظة' });
  }
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
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
      timeout: 30000,
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
    req.on('timeout', () => { req.destroy(new Error('Shopify request timeout')); });
    req.end();
  });
}

async function fetchShopifyOrders(shopUrl, accessToken, sinceDate) {
  const host = shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  let path = `/admin/api/2024-10/orders.json?status=any&created_at_min=${encodeURIComponent(sinceDate)}&limit=250&order=created_at+desc`;
  let allOrders = [], pageNum = 1;
  while (path) {
    const { orders, nextUrl } = await fetchPage(host, accessToken, path);
    allOrders = allOrders.concat(orders);
    if (!nextUrl || orders.length === 0 || pageNum >= 20) break;
    path = nextUrl; pageNum++;
  }
  return allOrders;
}

// ===== SHOPIFY DIAGNOSE =====
// جيب line items مع الصور لطلب معين وحدّث الـ DB
app.post('/api/shopify/fetch-line-items', async (req, res) => {
  const { shopUrl, accessToken, shopifyOrderId, orderId } = req.body;
  if (!shopUrl || !accessToken || !shopifyOrderId)
    return res.status(400).json({ error: 'بيانات ناقصة' });
  const host = shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  try {
    const r = await shopifyRequest(host, accessToken,
      `/admin/api/2024-10/orders/${shopifyOrderId}.json?fields=id,line_items,subtotal_price,total_price,shipping_lines`);
    if (r.status !== 200) return res.status(r.status).json({ error: r.data });

    const sh = r.data.order;
    const lineItemsJson = JSON.stringify((sh.line_items || []).map(i => ({
      name: i.name,
      title: i.title,
      variantTitle: i.variant_title || '',
      sku: i.sku || '',
      quantity: i.quantity,
      price: parseFloat(i.price) || 0,
      totalPrice: (parseFloat(i.price) || 0) * (i.quantity || 1),
      image: (i.image && i.image.src) ? i.image.src : null,
    })));
    const subtotalPrice = parseFloat(sh.subtotal_price) || 0;
    const shippingPrice = (sh.shipping_lines || []).reduce((s, l) => s + (parseFloat(l.price) || 0), 0);

    // حدّث الـ DB
    if (DB_ENABLED && orderId) {
      await pool.query(
        'UPDATE orders SET line_items_json=$1, subtotal_price=$2, shipping_price=$3, updated_at=NOW() WHERE id=$4',
        [lineItemsJson, subtotalPrice, shippingPrice, orderId]
      );
    }
    res.json({ success: true, lineItemsJson, subtotalPrice, shippingPrice });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shopify/diagnose', async (req, res) => {
  const { shopUrl, accessToken, shopifyOrderId } = req.body;
  if (!shopUrl || !accessToken || !shopifyOrderId)
    return res.status(400).json({ error: 'بيانات ناقصة' });
  const host = shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  try {
    const orderR = await shopifyRequest(host, accessToken,
      `/admin/api/2024-10/orders/${shopifyOrderId}.json?fields=id,name,order_number,fulfillment_status,tags,financial_status,source_name,line_items,fulfillments`);
    const foR = await shopifyRequest(host, accessToken,
      `/admin/api/2024-10/orders/${shopifyOrderId}/fulfillment_orders.json`);
    const assignedR = await shopifyRequest(host, accessToken,
      `/admin/api/2024-10/assigned_fulfillment_orders.json?assignment_status=fulfillment_unsubmitted`);
    const assignedR2 = await shopifyRequest(host, accessToken,
      `/admin/api/2024-10/assigned_fulfillment_orders.json?assignment_status=fulfillment_requested`);
    console.log('DIAGNOSE order:', JSON.stringify(orderR.data).slice(0,300));
    console.log('DIAGNOSE FOs:', JSON.stringify(foR.data).slice(0,500));
    console.log('DIAGNOSE assigned unsubmitted:', JSON.stringify(assignedR.data).slice(0,500));
    console.log('DIAGNOSE assigned requested:', JSON.stringify(assignedR2.data).slice(0,500));
    const assignedForOrder = [
      ...((assignedR.data.fulfillment_orders||[]).filter(fo=>String(fo.order_id)===String(shopifyOrderId))),
      ...((assignedR2.data.fulfillment_orders||[]).filter(fo=>String(fo.order_id)===String(shopifyOrderId))),
    ];
    res.json({
      shopifyOrderId,
      orderStatus: orderR.status,
      order: orderR.status === 200 ? orderR.data.order : { error: orderR.status, raw: JSON.stringify(orderR.data).slice(0,300) },
      foStatus: foR.status,
      fulfillmentOrders: foR.status === 200 ? foR.data.fulfillment_orders : { error: foR.status, raw: JSON.stringify(foR.data).slice(0,300) },
      assignedFOs: assignedForOrder,
      assignedUnsubmittedCount: (assignedR.data.fulfillment_orders||[]).length,
      assignedRequestedCount: (assignedR2.data.fulfillment_orders||[]).length,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== SHOPIFY ASSIGN: Fulfill + Tag =====
app.post('/api/shopify/assign', async (req, res) => {
  const { shopUrl, accessToken, shopifyOrderId, courierName, orderId } = req.body;
  console.log('shopify/assign called:', { shopUrl: shopUrl?.slice(0,30), shopifyOrderId, courierName, orderId });

  if (!shopUrl || !accessToken || !shopifyOrderId) {
    return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
  }

  const host = shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const errors = [];

  // 1. إضافة Tag باسم المندوب (اختياري — مش بيوقف الـ fulfill لو فشل)
  try {
    const getR = await shopifyRequest(host, accessToken, `/admin/api/2024-10/orders/${shopifyOrderId}.json?fields=id,tags`);
    console.log('Get order tags status:', getR.status);
    if (getR.status === 200 && getR.data.order) {
      const currentTags = getR.data.order.tags || '';
      const newTags = currentTags
        ? currentTags.split(',').map(t=>t.trim()).filter(t=>t).concat(courierName).join(', ')
        : courierName;
      const tagR = await shopifyRequest(host, accessToken, `/admin/api/2024-10/orders/${shopifyOrderId}.json`, 'PUT',
        { order: { id: shopifyOrderId, tags: newTags } });
      console.log('Update tags status:', tagR.status);
      if(tagR.status === 403){
        console.warn('Tag update skipped: missing write_orders scope');
        // مش error — بس warning، الـ fulfill هيكمل
      } else if(tagR.status !== 200){
        console.warn('Tag update failed:', tagR.status, JSON.stringify(tagR.data).slice(0,120));
      }
    }
  } catch (e) { console.warn('Tag (non-blocking):', e.message); }

  // 2. Fulfill الطلب
  try {
    const foR = await shopifyRequest(host, accessToken,
      `/admin/api/2024-10/orders/${shopifyOrderId}/fulfillment_orders.json`);
    console.log('Fulfillment orders status:', foR.status, 'count:', foR.data.fulfillment_orders?.length);

    let fulfilled = false;

    if (foR.status === 200 && foR.data.fulfillment_orders && foR.data.fulfillment_orders.length > 0) {
      const pendingFOs = foR.data.fulfillment_orders.filter(fo =>
        fo.status === 'open' || fo.status === 'in_progress'
      );
      console.log('Pending fulfillment orders:', pendingFOs.length, pendingFOs.map(f=>f.status));

      for (const fo of pendingFOs) {
        const fulfillR = await shopifyRequest(host, accessToken,
          `/admin/api/2024-10/fulfillments.json`, 'POST', {
            fulfillment: {
              line_items_by_fulfillment_order: [{ fulfillment_order_id: fo.id }],
              notify_customer: false,
              tracking_company: courierName,
            }
          });
        console.log('Fulfill (new API) status:', fulfillR.status, JSON.stringify(fulfillR.data).slice(0,200));
        if (fulfillR.status === 200 || fulfillR.status === 201) {
          fulfilled = true;
        } else {
          errors.push('Fulfill HTTP ' + fulfillR.status + ': ' + JSON.stringify(fulfillR.data).slice(0,200));
        }
      }
      if(pendingFOs.length === 0){
        const allClosed = foR.data.fulfillment_orders.every(fo=>fo.status==='closed'||fo.status==='fulfilled');
        if(allClosed){ console.log('Already fulfilled'); fulfilled = true; }
        else { errors.push('No open FOs. Statuses: ' + foR.data.fulfillment_orders.map(f=>f.status).join(', ')); }
      }
    }

    // Fallback 1: جرب merchant managed fulfillment orders
    if (!fulfilled) {
      console.log('Trying merchant managed fulfillment orders...');
      try {
        const mmR = await shopifyRequest(host, accessToken,
          `/admin/api/2024-10/assigned_fulfillment_orders.json?assignment_status=fulfillment_unsubmitted`);
        console.log('MM FOs status:', mmR.status, JSON.stringify(mmR.data).slice(0,400));
        if (mmR.status === 200 && mmR.data.fulfillment_orders) {
          const myFOs = mmR.data.fulfillment_orders.filter(fo =>
            String(fo.order_id) === String(shopifyOrderId)
          );
          console.log('MM FOs for this order:', myFOs.length);
          for (const fo of myFOs) {
            const fulfillR = await shopifyRequest(host, accessToken,
              `/admin/api/2024-10/fulfillments.json`, 'POST', {
                fulfillment: {
                  line_items_by_fulfillment_order: [{ fulfillment_order_id: fo.id }],
                  notify_customer: false,
                  tracking_company: courierName,
                }
              });
            console.log('MM FO fulfill status:', fulfillR.status, JSON.stringify(fulfillR.data).slice(0,200));
            if (fulfillR.status === 200 || fulfillR.status === 201) {
              fulfilled = true;
              errors.length = 0;
            }
          }
        }
      } catch(e5) { console.warn('MM FOs fallback:', e5.message); }
    }

    // Fallback 2: جرب الـ assigned fulfillment orders (requested)
    if (!fulfilled) {
      try {
        const assignedR = await shopifyRequest(host, accessToken,
          `/admin/api/2024-10/assigned_fulfillment_orders.json?assignment_status=fulfillment_requested`);
        console.log('Assigned FOs status:', assignedR.status, JSON.stringify(assignedR.data).slice(0,300));
        if (assignedR.status === 200 && assignedR.data.fulfillment_orders) {
          const myFOs = assignedR.data.fulfillment_orders.filter(fo =>
            String(fo.order_id) === String(shopifyOrderId)
          );
          console.log('My assigned FOs:', myFOs.length);
          for (const fo of myFOs) {
            const fulfillR = await shopifyRequest(host, accessToken,
              `/admin/api/2024-10/fulfillments.json`, 'POST', {
                fulfillment: {
                  line_items_by_fulfillment_order: [{ fulfillment_order_id: fo.id }],
                  notify_customer: false,
                  tracking_company: courierName,
                }
              });
            console.log('Assigned FO fulfill status:', fulfillR.status, JSON.stringify(fulfillR.data).slice(0,200));
            if (fulfillR.status === 200 || fulfillR.status === 201) {
              fulfilled = true;
              errors.length = 0;
            }
          }
        }
      } catch(e3) { console.warn('Assigned FOs fallback:', e3.message); }
    }

    // Fallback 2: legacy fulfillment API
    if (!fulfilled) {
      console.log('Trying legacy fulfillment API...');
      try {
        // جيب الـ line items
        const orderR2 = await shopifyRequest(host, accessToken,
          `/admin/api/2024-10/orders/${shopifyOrderId}.json?fields=id,line_items,fulfillment_status`);
        if (orderR2.status === 200 && orderR2.data.order) {
          const order2 = orderR2.data.order;
          if (order2.fulfillment_status === 'fulfilled') {
            console.log('Already fulfilled (legacy check)');
            fulfilled = true;
          } else {
            const lineItems = (order2.line_items || []).map(li => ({
              id: li.id, quantity: li.fulfillable_quantity || li.quantity
            })).filter(li => li.quantity > 0);

            if (lineItems.length > 0) {
              const legacyR = await shopifyRequest(host, accessToken,
                `/admin/api/2024-10/orders/${shopifyOrderId}/fulfillments.json`, 'POST', {
                  fulfillment: {
                    line_items: lineItems,
                    notify_customer: false,
                    tracking_company: courierName,
                  }
                });
              console.log('Legacy fulfill status:', legacyR.status, JSON.stringify(legacyR.data).slice(0,200));
              if (legacyR.status === 200 || legacyR.status === 201) {
                fulfilled = true;
                errors.length = 0; // مسح الـ errors السابقة
              } else {
                errors.push('Legacy Fulfill HTTP ' + legacyR.status + ': ' + JSON.stringify(legacyR.data).slice(0,200));
              }
            } else {
              errors.push('No fulfillable line items found');
            }
          }
        }
      } catch(e2) { errors.push('Legacy fallback: ' + e2.message); }
    }

    // Fallback 3: محاولة نقل الـ FO لـ app الحالي ثم fulfill
    if (!fulfilled) {
      console.log('Trying fulfillment order move...');
      try {
        const foR2 = await shopifyRequest(host, accessToken,
          `/admin/api/2024-10/orders/${shopifyOrderId}/fulfillment_orders.json`);
        if (foR2.status === 200 && foR2.data.fulfillment_orders) {
          for (const fo of foR2.data.fulfillment_orders) {
            // جرب fulfill مباشرة بغض النظر عن الـ status
            console.log('Force trying FO:', fo.id, 'status:', fo.status);
            const fulfillR = await shopifyRequest(host, accessToken,
              `/admin/api/2024-10/fulfillments.json`, 'POST', {
                fulfillment: {
                  line_items_by_fulfillment_order: [{ fulfillment_order_id: fo.id }],
                  notify_customer: false,
                  tracking_company: courierName,
                }
              });
            console.log('Force fulfill status:', fulfillR.status, JSON.stringify(fulfillR.data).slice(0,300));
            if (fulfillR.status === 200 || fulfillR.status === 201) {
              fulfilled = true;
              errors.length = 0;
              break;
            } else {
              errors.push('Force HTTP ' + fulfillR.status + ': ' + JSON.stringify(fulfillR.data).slice(0,300));
            }
          }
        }
      } catch(e4) { errors.push('Move fallback: ' + e4.message); }
    }

    if (!fulfilled && errors.length === 0) {
      errors.push('تعذّر عمل fulfill — الطلب ربما من channel مختلف لا يسمح بالـ fulfill من Admin API');
    }

  } catch (e) { errors.push('Fulfill error: ' + e.message); }

  console.log('shopify/assign result:', { success: errors.length === 0, errors });
  res.json({ success: errors.length === 0, errors, message: errors.length ? errors.join(' | ') : 'تم بنجاح' });
});

function shopifyRequest(host, accessToken, path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: host, path, method,
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
      timeout: 15000,
    };
    const req = require('https').request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data || '{}') }); }
        catch { resolve({ status: res.statusCode, data: {} }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ===== CHECK BOOKS API =====
app.get('/api/check-books', async (req, res) => {
  if (!DB_ENABLED) return res.json({ books: [] });
  const { rows } = await pool.query('SELECT * FROM check_books ORDER BY created_at');
  res.json({ books: rows.map(r => ({ id:r.id, name:r.name, bank:r.bank, account:r.account, pages:r.pages, note:r.note })) });
});

app.post('/api/check-books', async (req, res) => {
  const { id, name, bank, account, pages, note, firstNum } = req.body;
  if (!DB_ENABLED) return res.json({ book: req.body });
  // إضافة first_num column لو مش موجودة
  try{ await pool.query("ALTER TABLE check_books ADD COLUMN IF NOT EXISTS first_num INTEGER DEFAULT 1"); }catch(e){}
  await pool.query(
    'INSERT INTO check_books (id,name,bank,account,pages,note,first_num) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET name=$2,bank=$3,account=$4,pages=$5,note=$6,first_num=$7',
    [id, name, bank||'', account||'', pages||48, note||'', firstNum||1]
  );
  res.json({ book: req.body });
});

app.delete('/api/check-books/:id', async (req, res) => {
  if (!DB_ENABLED) return res.json({ ok: true });
  await pool.query('DELETE FROM check_books WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ===== CHECKS API =====
app.get('/api/checks', async (req, res) => {
  if (!DB_ENABLED) return res.json({ checks: [] });
  const { rows } = await pool.query('SELECT * FROM checks ORDER BY date ASC');
  res.json({ checks: rows.map(r => ({
    id:r.id, num:r.num, payee:r.payee, amount:parseFloat(r.amount),
    date:r.date ? r.date.toISOString().slice(0,10) : '',
    bookId:r.book_id, invoice:r.invoice, note:r.note,
    img:r.img, status:r.status,
    doneAt:r.done_at, createdAt:r.created_at,
  })) });
});

app.post('/api/checks', async (req, res) => {
  const { id, num, payee, amount, date, bookId, invoice, note, img, status, doneAt } = req.body;
  if (!DB_ENABLED) return res.json({ check: req.body });
  await pool.query(
    `INSERT INTO checks (id,num,payee,amount,date,book_id,invoice,note,img,status,done_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO UPDATE SET
     num=$2,payee=$3,amount=$4,date=$5,book_id=$6,invoice=$7,note=$8,img=$9,status=$10,done_at=$11`,
    [id, num, payee, amount||0, date||null, bookId||null, invoice||'', note||'', img||'', status||'pending', doneAt||null]
  );
  res.json({ check: req.body });
});

app.delete('/api/checks/:id', async (req, res) => {
  if (!DB_ENABLED) return res.json({ ok: true });
  await pool.query('DELETE FROM checks WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// Sync bulk - يستقبل كل الشيكات والدفاتر مرة واحدة
app.post('/api/sync-checks', async (req, res) => {
  const { books, checks } = req.body;
  if (!DB_ENABLED) return res.json({ ok: true });
  try {
    // sync books
    for (const b of (books||[])) {
      await pool.query(
        'INSERT INTO check_books (id,name,bank,account,pages,note) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET name=$2,bank=$3,account=$4,pages=$5,note=$6',
        [b.id, b.name, b.bank||'', b.account||'', b.pages||48, b.note||'']
      );
    }
    // sync checks
    for (const c of (checks||[])) {
      await pool.query(
        `INSERT INTO checks (id,num,payee,amount,date,book_id,invoice,note,img,status,done_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO UPDATE SET
         num=$2,payee=$3,amount=$4,date=$5,book_id=$6,invoice=$7,note=$8,status=$10,done_at=$11`,
        [c.id, c.num, c.payee, c.amount||0, c.date||null, c.bookId||null, c.invoice||'', c.note||'', c.img||'', c.status||'pending', c.doneAt||null]
      );
    }
    res.json({ ok: true, books: (books||[]).length, checks: (checks||[]).length });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== HEALTH =====
app.get('/', async (req, res) => {
  let dbOk = false, orderCount = 0;
  if (DB_ENABLED) {
    try { const r = await pool.query('SELECT COUNT(*) FROM orders'); orderCount = parseInt(r.rows[0].count); dbOk = true; } catch {}
  } else {
    orderCount = memOrders.length;
  }
  res.json({ status: '✅ OrderPro Backend شغال', db: DB_ENABLED ? (dbOk ? '✅ متصل' : '❌ منفصل') : '⚠️ بدون DB', orders: orderCount, uptime: Math.floor(process.uptime()) + ' ثانية' });
});

// ===== START =====
if (DB_ENABLED) {
  // ===== SETTLEMENTS API =====

// جيب كل تسويات مندوب
app.get('/api/settlements/:courierId', async (req, res) => {
  if(!DB_ENABLED) return res.json({settlements:[]});
  try{
    const r = await pool.query(
      'SELECT * FROM settlements WHERE courier_id=$1 ORDER BY ts ASC',
      [req.params.courierId]
    );
    res.json({settlements: r.rows.map(s=>({
      id: s.id,
      courierId: s.courier_id,
      ts: s.ts,
      orderIds: JSON.parse(s.order_ids||'[]'),
      cod: parseFloat(s.cod)||0,
      ship: parseFloat(s.ship)||0,
      notes: s.notes||'',
      adj: JSON.parse(s.adj||'[]'),
      adjTotal: JSON.parse(s.adj||'[]').reduce((sum,a)=>sum+(a.amount||0),0),
    }))});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// جيب كل التسويات
app.get('/api/settlements', async (req, res) => {
  if(!DB_ENABLED) return res.json({settlements:[]});
  try{
    const r = await pool.query('SELECT * FROM settlements ORDER BY ts DESC LIMIT 500');
    res.json({settlements: r.rows.map(s=>({
      id: s.id,
      courierId: s.courier_id,
      ts: s.ts,
      orderIds: JSON.parse(s.order_ids||'[]'),
      cod: parseFloat(s.cod)||0,
      ship: parseFloat(s.ship)||0,
      notes: s.notes||'',
      adj: JSON.parse(s.adj||'[]'),
      adjTotal: JSON.parse(s.adj||'[]').reduce((sum,a)=>sum+(a.amount||0),0),
    }))});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// إضافة تسوية جديدة
app.post('/api/settlements', async (req, res) => {
  const {courierId, ts, orderIds, cod, ship, notes, adj} = req.body;
  if(!courierId) return res.status(400).json({error:'courierId required'});
  if(!DB_ENABLED) return res.json({success:true, id:Date.now()});
  try{
    const r = await pool.query(
      `INSERT INTO settlements(courier_id, ts, order_ids, cod, ship, notes, adj)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [courierId, ts||new Date().toISOString(),
       JSON.stringify(orderIds||[]),
       cod||0, ship||0, notes||'', JSON.stringify(adj||[])]
    );
    // حدّث settled في couriers
    await pool.query(
      'UPDATE couriers SET settled=true WHERE id=$1',
      [courierId]
    );
    res.json({success:true, id:r.rows[0].id});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// حذف تسوية (للتراجع)
app.delete('/api/settlements/:id', async (req, res) => {
  if(!DB_ENABLED) return res.json({success:true});
  try{
    await pool.query('DELETE FROM settlements WHERE id=$1', [req.params.id]);
    res.json({success:true});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// ===== SHOPIFY ORDER UPDATE WEBHOOK =====
app.post('/webhook/shopify/update', async (req, res) => {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '';
  if (secret) {
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const hash = crypto.createHmac('sha256', secret).update(req.body).digest('base64');
    if (hash !== hmac) return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const sh = JSON.parse(req.body);
    const orderId = 'SH-' + sh.order_number;

    if (!DB_ENABLED) {
      res.status(200).json({ received: true });
      return;
    }

    // شوف الطلب موجود في DB
    const existing = await pool.query('SELECT * FROM orders WHERE id=$1', [orderId]);
    if (!existing.rows.length) {
      // طلب جديد - أضفه
      const o = mapShopifyOrder(sh);
      await pool.query(`
        INSERT INTO orders (id,shopify_id,src,name,phone,area,addr,addr2,total,ship,
          courier_id,status,paid,shipping_method,delivery_type,note,items,time,created_at,province)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        ON CONFLICT (id) DO NOTHING`,
        [o.id,o.shopify_id,o.src,o.name,o.phone,o.area,o.addr,o.addr2||'',
         o.total,o.ship,null,o.status,o.paid,o.shipping_method,
         o.delivery_type,o.note,o.items,o.time,o.created_at]);
      return res.status(200).json({ received: true });
    }

    const row = existing.rows[0];

    // لو الطلب ملغي
    if (sh.cancelled_at) {
      // لغيه بس لو مش موزع أو مكتمل
      if (!row.courier_id && row.status !== 'جاري التوصيل' && row.status !== 'مكتمل') {
        await pool.query(
          'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2',
          ['ملغي', orderId]
        );
        console.log('Order cancelled via update webhook:', orderId);
      }
      return res.status(200).json({ received: true });
    }

    // تحديث البيانات القابلة للتغيير فقط
    const shipping = sh.shipping_address || {};
    const customer = sh.customer || {};
    const shippingLine = (sh.shipping_lines || [])[0] || {};

    const newName = shipping.first_name
      ? (shipping.first_name + ' ' + (shipping.last_name || '')).trim()
      : customer.first_name
      ? (customer.first_name + ' ' + (customer.last_name || '')).trim()
      : row.name;

    const newPhone = shipping.phone || customer.phone || row.phone;
    const newArea = [shipping.city, shipping.address1].filter(Boolean).join(' - ') || row.area;
    const newAddr = [shipping.address1, shipping.address2, shipping.city].filter(Boolean).join('، ') || row.addr;
    const newTotal = parseFloat(sh.total_price) || row.total;
    const newPaid = sh.financial_status === 'paid' || sh.financial_status === 'partially_paid';
    const newItems = (sh.line_items || []).map(i => i.name + ' x' + i.quantity).join(', ') || row.items;
    const newLineItemsJson = sh.line_items ? JSON.stringify((sh.line_items || []).map(i => ({
      name: i.name, title: i.title, variantTitle: i.variant_title || '',
      sku: i.sku || '', quantity: i.quantity,
      price: parseFloat(i.price) || 0,
      totalPrice: (parseFloat(i.price) || 0) * (i.quantity || 1),
      image: (i.image && i.image.src) ? i.image.src : null,
    }))) : row.line_items_json;
    const newNote = sh.note || row.note;

    await pool.query(`
      UPDATE orders SET
        name=$1, phone=$2, area=$3, addr=$4,
        total=$5, paid=$6, items=$7, note=$8,
        line_items_json=$9,
        updated_at=NOW()
      WHERE id=$10`,
      [newName, newPhone, newArea, newAddr, newTotal, newPaid, newItems, newNote, newLineItemsJson, orderId]
    );

    console.log('Order updated via webhook:', orderId, {name:newName, total:newTotal});
    res.status(200).json({ received: true });
  } catch(e) {
    console.error('Update webhook error:', e.message);
    res.status(200).json({ received: true });
  }
});

// ===== SHOPIFY CANCEL WEBHOOK =====
app.post('/webhook/shopify/cancel', async (req, res) => {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '';
  if (secret) {
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const hash = crypto.createHmac('sha256', secret).update(req.body).digest('base64');
    if (hash !== hmac) return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const sh = JSON.parse(req.body);
    const orderId = 'SH-' + sh.order_number;
    // بلغي فقط لو الطلب لسه مش موزع (courier_id = null)
    if (DB_ENABLED) {
      const existing = await pool.query(
        'SELECT status, courier_id FROM orders WHERE id=$1', [orderId]
      );
      if (existing.rows.length) {
        const row = existing.rows[0];
        // لو مش موزع بعد = لغيه
        if (!row.courier_id && row.status !== 'جاري التوصيل' && row.status !== 'مكتمل') {
          await pool.query(
            'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2',
            ['ملغي', orderId]
          );
          console.log('Order cancelled from Shopify:', orderId);
        }
      }
    } else {
      const o = memOrders.find(x => x.id === orderId);
      if (o && !o.courierId && o.status !== 'جاري التوصيل' && o.status !== 'مكتمل') {
        o.status = 'ملغي';
      }
    }
    res.status(200).json({ received: true });
  } catch(e) {
    console.error('Cancel webhook error:', e.message);
    res.status(200).json({ received: true }); // دايماً 200 لـ Shopify
  }
});

// ===== USERS API =====
app.get('/api/users', async (req, res) => {
  if(!DB_ENABLED) return res.json({users:[]});
  try{
    const r = await pool.query('SELECT username,name,pass_hash,pages,active FROM users ORDER BY created_at');
    res.json({users: r.rows.map(u=>({
      username: u.username, name: u.name,
      passHash: u.pass_hash,
      pages: JSON.parse(u.pages||'[]'), active: u.active
    }))});
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/users', async (req, res) => {
  const {username, name, passHash, pages, active=true} = req.body;
  if(!username||!name||!passHash) return res.status(400).json({error:'Missing fields'});
  if(!DB_ENABLED) return res.json({success:true});
  try{
    await pool.query(
      `INSERT INTO users(username,name,pass_hash,pages,active) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(username) DO UPDATE SET name=$2,pass_hash=$3,pages=$4,active=$5`,
      [username, name, passHash, JSON.stringify(pages||[]), active]
    );
    res.json({success:true});
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.delete('/api/users/:username', async (req, res) => {
  if(!DB_ENABLED) return res.json({success:true});
  try{
    await pool.query('DELETE FROM users WHERE username=$1', [req.params.username]);
    res.json({success:true});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const {username, passHash} = req.body;
  if(!DB_ENABLED) return res.json({found:false});
  try{
    const r = await pool.query(
      'SELECT username,name,pages,active FROM users WHERE username=$1 AND pass_hash=$2 AND active=true',
      [username, passHash]
    );
    if(r.rows.length){
      const u = r.rows[0];
      res.json({found:true, user:{username:u.username, name:u.name, pages:JSON.parse(u.pages||'[]'), role:'custom', active:true}});
    } else {
      res.json({found:false});
    }
  }catch(e){ res.status(500).json({error:e.message}); }
});

initDB().then(() => {
    app.listen(PORT, () => console.log('🚀 OrderPro Backend شغال على port', PORT));
  });
} else {
  app.listen(PORT, () => console.log('🚀 OrderPro Backend شغال على port', PORT, '(بدون DB)'));
}

// ===== TREASURY =====
async function initTreasuryTables(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS treasuries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    opening NUMERIC DEFAULT 0,
    note TEXT DEFAULT ''
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS treasury_tx (
    id TEXT PRIMARY KEY,
    treasury_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    reason TEXT NOT NULL,
    date TEXT NOT NULL
  )`);
}

// GET all treasuries
app.get('/api/treasuries', async (req, res) => {
  if(!DB_ENABLED) return res.json({treasuries:[]});
  try {
    const client = await pool.connect();
    await initTreasuryTables(client);
    const r = await client.query('SELECT * FROM treasuries ORDER BY name');
    client.release();
    res.json({treasuries: r.rows});
  } catch(e) { res.json({treasuries:[]}); }
});

// POST treasury
app.post('/api/treasuries', async (req, res) => {
  if(!DB_ENABLED) return res.json({ok:true});
  const {id, name, opening, note} = req.body;
  try {
    const client = await pool.connect();
    await initTreasuryTables(client);
    await client.query(
      'INSERT INTO treasuries (id,name,opening,note) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET name=$2,opening=$3,note=$4',
      [id, name, opening||0, note||'']
    );
    client.release();
    res.json({ok:true});
  } catch(e) { res.json({ok:false, error:e.message}); }
});

// DELETE treasury
app.delete('/api/treasuries/:id', async (req, res) => {
  if(!DB_ENABLED) return res.json({ok:true});
  try {
    const client = await pool.connect();
    await client.query('DELETE FROM treasuries WHERE id=$1', [req.params.id]);
    await client.query('DELETE FROM treasury_tx WHERE treasury_id=$1', [req.params.id]);
    client.release();
    res.json({ok:true});
  } catch(e) { res.json({ok:false}); }
});

// GET transactions
app.get('/api/treasury-tx', async (req, res) => {
  if(!DB_ENABLED) return res.json({transactions:[]});
  try {
    const client = await pool.connect();
    await initTreasuryTables(client);
    const r = await client.query('SELECT * FROM treasury_tx ORDER BY date DESC, id DESC');
    client.release();
    res.json({transactions: r.rows.map(x=>({
      id: x.id, treasuryId: x.treasury_id, type: x.type,
      amount: parseFloat(x.amount), reason: x.reason, date: x.date
    }))});
  } catch(e) { res.json({transactions:[]}); }
});

// POST transaction
app.post('/api/treasury-tx', async (req, res) => {
  if(!DB_ENABLED) return res.json({ok:true});
  const {id, treasuryId, type, amount, reason, date} = req.body;
  try {
    const client = await pool.connect();
    await initTreasuryTables(client);
    await client.query(
      'INSERT INTO treasury_tx (id,treasury_id,type,amount,reason,date) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET type=$3,amount=$4,reason=$5,date=$6',
      [id, treasuryId, type, amount, reason, date]
    );
    client.release();
    res.json({ok:true});
  } catch(e) { res.json({ok:false, error:e.message}); }
});

// DELETE transaction
app.delete('/api/treasury-tx/:id', async (req, res) => {
  if(!DB_ENABLED) return res.json({ok:true});
  try {
    const client = await pool.connect();
    await client.query('DELETE FROM treasury_tx WHERE id=$1', [req.params.id]);
    client.release();
    res.json({ok:true});
  } catch(e) { res.json({ok:false}); }
});

// PATCH transaction (edit)
app.patch('/api/treasury-tx/:id', async (req, res) => {
  if(!DB_ENABLED) return res.json({ok:true});
  const {amount, reason, date, type} = req.body;
  try {
    const client = await pool.connect();
    await client.query(
      'UPDATE treasury_tx SET amount=$1,reason=$2,date=$3,type=$4 WHERE id=$5',
      [amount, reason, date, type, req.params.id]
    );
    client.release();
    res.json({ok:true});
  } catch(e) { res.json({ok:false}); }
});
// Check Suppliers
app.get('/api/check-suppliers', async (req, res) => {
  if(!DB_ENABLED) return res.json({suppliers:[]});
  try{
    await pool.query("CREATE TABLE IF NOT EXISTS check_suppliers (id TEXT PRIMARY KEY, name TEXT)");
    const r = await pool.query('SELECT * FROM check_suppliers ORDER BY name');
    res.json({suppliers: r.rows});
  }catch(e){ res.json({suppliers:[]}); }
});

app.post('/api/check-suppliers', async (req, res) => {
  if(!DB_ENABLED) return res.json({ok:true});
  const {id, name} = req.body;
  try{
    await pool.query("CREATE TABLE IF NOT EXISTS check_suppliers (id TEXT PRIMARY KEY, name TEXT)");
    await pool.query('INSERT INTO check_suppliers (id,name) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET name=$2', [id, name]);
    res.json({ok:true});
  }catch(e){ res.json({ok:false}); }
});

app.delete('/api/check-suppliers/:id', async (req, res) => {
  if(!DB_ENABLED) return res.json({ok:true});
  try{
    await pool.query('DELETE FROM check_suppliers WHERE id=$1', [req.params.id]);
    res.json({ok:true});
  }catch(e){ res.json({ok:false}); }
});
