const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');
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
        first_num INTEGER,
        last_num INTEGER,
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
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS zone_manually_set BOOLEAN DEFAULT false",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_note TEXT DEFAULT ''",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_note TEXT DEFAULT ''",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS bosta_awb_url TEXT",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS bosta_awb_base64 TEXT",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS shop_settled BOOLEAN DEFAULT false",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS bosta_exported BOOLEAN DEFAULT false",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS bosta_exported_at TIMESTAMPTZ",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS line_items_json TEXT",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_price NUMERIC DEFAULT 0",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_price NUMERIC DEFAULT 0",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS source_name TEXT DEFAULT ''",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS batch_code TEXT DEFAULT ''",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS merged_into TEXT DEFAULT NULL",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS merged_ids TEXT DEFAULT NULL",
      "ALTER TABLE settlements ADD COLUMN IF NOT EXISTS adj TEXT DEFAULT '[]'",
      "ALTER TABLE check_books ADD COLUMN IF NOT EXISTS first_num INTEGER DEFAULT 1",
      "ALTER TABLE check_books ADD COLUMN IF NOT EXISTS last_num INTEGER",
      `CREATE TABLE IF NOT EXISTS order_history (
        id SERIAL PRIMARY KEY,
        order_id TEXT NOT NULL,
        action TEXT NOT NULL,
        field TEXT,
        old_value TEXT,
        new_value TEXT,
        user_name TEXT,
        ts TIMESTAMPTZ DEFAULT NOW()
      )`,
      "CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id)",
      `CREATE TABLE IF NOT EXISTS invoice_cache (
        order_id TEXT PRIMARY KEY,
        html TEXT NOT NULL,
        generated_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS idx_invoice_cache_expires ON invoice_cache(expires_at)",
      `CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS batches (
        code TEXT PRIMARY KEY,
        batch_date TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        started_at TIMESTAMPTZ DEFAULT NOW(),
        closed_at TIMESTAMPTZ,
        order_count INTEGER DEFAULT 0
      )`,

      // ===== CAFELAX STARS (Courier App) Schema =====
      "ALTER TABLE couriers ADD COLUMN IF NOT EXISTS username TEXT UNIQUE",
      "ALTER TABLE couriers ADD COLUMN IF NOT EXISTS password_hash TEXT",
      "ALTER TABLE couriers ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ",

      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_delivered_at TIMESTAMPTZ",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_note TEXT DEFAULT ''",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS undeliverable_reason TEXT",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_change_requested BOOLEAN DEFAULT false",

      // طلبات المراجعة (تحويل COD لمدفوع، تسويات، إلخ)
      `CREATE TABLE IF NOT EXISTS pending_reviews (
        id SERIAL PRIMARY KEY,
        order_id TEXT,
        courier_id INTEGER,
        type TEXT NOT NULL,
        data JSONB DEFAULT '{}'::jsonb,
        status TEXT DEFAULT 'pending',
        reviewed_by INTEGER,
        reviewed_at TIMESTAMPTZ,
        rejection_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      "CREATE INDEX IF NOT EXISTS idx_pending_reviews_status ON pending_reviews(status)",
      "CREATE INDEX IF NOT EXISTS idx_pending_reviews_courier ON pending_reviews(courier_id)",

      // تسويات المندوب اليومية (قبل الاعتماد من المحاسب)
      `CREATE TABLE IF NOT EXISTS courier_adjustments (
        id SERIAL PRIMARY KEY,
        courier_id INTEGER NOT NULL,
        amount NUMERIC NOT NULL,
        reason TEXT,
        proof_image_base64 TEXT,
        status TEXT DEFAULT 'pending',
        reviewed_by INTEGER,
        reviewed_at TIMESTAMPTZ,
        rejection_reason TEXT,
        settlement_id INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      "CREATE INDEX IF NOT EXISTS idx_courier_adjustments_courier ON courier_adjustments(courier_id)",
      "CREATE INDEX IF NOT EXISTS idx_courier_adjustments_status ON courier_adjustments(status)",

      // صلاحية محاسبة المناديب (للمستخدمين)
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_settle_couriers BOOLEAN DEFAULT false",

      // ===== SHOP STAFF (موظفي المحل في تطبيق Stars) =====
      `CREATE TABLE IF NOT EXISTS shop_users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        active BOOLEAN DEFAULT true,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // ===== تحويلات Pickup → شحن =====
      `CREATE TABLE IF NOT EXISTS shipping_transfers (
        id SERIAL PRIMARY KEY,
        order_id TEXT NOT NULL,
        transferred_by_shop_user_id INTEGER,
        transferred_by_username TEXT,
        status TEXT DEFAULT 'pending',
        accepted_by TEXT,
        accepted_at TIMESTAMPTZ,
        shipping_cost NUMERIC,
        assigned_to TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      "CREATE INDEX IF NOT EXISTS idx_shipping_transfers_status ON shipping_transfers(status)",

      // علّم الطلب نفسه لما يتحول
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS transfer_requested_at TIMESTAMPTZ",

      // Pickup workflow (موظف المحل)
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS shop_note TEXT DEFAULT ''",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_ready_at TIMESTAMPTZ",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS picked_up_by_customer_at TIMESTAMPTZ",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_not_picked_reason TEXT",

      // ===== إلغاء بواسطة المندوب/المحل (بانتظار استلام الإدارة) =====
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_by_field BOOLEAN DEFAULT false",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_by_username TEXT",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_by_source TEXT", // 'courier' | 'shop'
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_received_at TIMESTAMPTZ",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_received_by TEXT",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_sequence INTEGER", // ترتيب التوصيل للمندوب

      // ===== v177: Preparation (Barcode) System =====
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS preparation_status VARCHAR(50)",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS preparation_started_by INTEGER",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS preparation_started_at TIMESTAMPTZ",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS preparation_completed_by INTEGER",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS preparation_completed_at TIMESTAMPTZ",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS scanned_items TEXT",
      "CREATE INDEX IF NOT EXISTS idx_orders_preparation_status ON orders(preparation_status)",
      "CREATE INDEX IF NOT EXISTS idx_orders_preparation_started_by ON orders(preparation_started_by)",
      "ALTER TABLE couriers ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'courier'",
      "UPDATE couriers SET role = 'courier' WHERE role IS NULL",
    ];
    for (const sql of migrations) {
      try { await pool.query(sql); } catch(e) {}
    }
    console.log('✅ Migrations applied');

    // ===== v177: Auto-seed shop courier + setting =====
    try {
      // 1) دور على المحل لو موجود (role='shop' أو phone='shop')
      let shopId = null;
      const existing = await pool.query(
        `SELECT id FROM couriers WHERE role = 'shop' OR phone = 'shop' LIMIT 1`
      );
      if (existing.rows.length) {
        shopId = existing.rows[0].id;
      } else {
        // 2) لو مش موجود، اعمله
        const ins = await pool.query(
          `INSERT INTO couriers (name, phone, email, role, active)
           VALUES ('المحل - Trivium Square', 'shop', 'shop@cafelax.com', 'shop', true)
           RETURNING id`
        );
        shopId = ins.rows[0]?.id;
        console.log('✅ Shop courier created with ID:', shopId);
      }
      // 3) احفظ shop_courier_id في app_settings
      if (shopId) {
        await pool.query(
          `INSERT INTO app_settings (key, value)
           VALUES ('shop_courier_id', $1)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [String(shopId)]
        );
        console.log('✅ shop_courier_id setting:', shopId);
      }
    } catch (e) {
      console.log('⚠️ Shop courier auto-seed skipped:', e.message);
    }

  } catch (err) {
    console.error('❌ DB init error:', err.message);
  }
}

// ===== MIDDLEWARE =====
app.use(cors({ origin: '*' }));
app.use('/webhook/shopify', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));

// ===== SERVE BOSTA TEMPLATE =====
app.get('/bosta-template.xlsx', (req, res) => {
  const templatePath = path.join(__dirname, 'bosta-template.xlsx');
  if (fs.existsSync(templatePath)) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(templatePath);
  } else {
    res.status(404).json({ error: 'Template not found' });
  }
});

// ===== AI CHAT =====
app.post('/api/ai/chat', async (req, res) => {
  const { message, history, context } = req.body;
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY غير مضبوط' });
  }
  if (!message) return res.status(400).json({ error: 'رسالة فارغة' });

  const systemPrompt = `أنت مساعد ذكي لنظام OrderPro الخاص بـ CAFELAX لإدارة التوصيل. تتحدث العربية العامية المصرية بشكل ودود ومختصر.

مهامك:
- تجاوب أسئلة عن الطلبات والمناديب والإحصائيات
- تساعد في تحليل البيانات واقتراح تحسينات
- تكتب رسائل للعملاء لما تطلب منك
- تقترح حلول للمشاكل

قواعد:
- ردود مختصرة (2-4 جمل عادةً)
- أرقام ومعلومات من البيانات الحقيقية فقط
- لو مش عارف إجابة قول "مش متأكد"
- استخدم emojis باعتدال
- لا تخترع أرقام

بيانات النظام الحالية:
${JSON.stringify(context || {}, null, 2)}`;

  try {
    const payload = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        ...(history || []).slice(-6),
        { role: 'user', content: message }
      ]
    };
    const body = JSON.stringify(payload);
    const result = await new Promise((resolve, reject) => {
      const req2 = https.request({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (r) => {
        let data = '';
        r.on('data', c => data += c);
        r.on('end', () => {
          try { resolve({ status: r.statusCode, data: JSON.parse(data) }); }
          catch(e) { resolve({ status: r.statusCode, data: { error: data } }); }
        });
      });
      req2.on('error', reject);
      req2.write(body);
      req2.end();
    });
    if (result.status !== 200) {
      console.error('AI error:', result.data);
      return res.status(500).json({ error: result.data?.error?.message || 'AI service error' });
    }
    const text = result.data.content?.[0]?.text || '';
    res.json({ text, usage: result.data.usage });
  } catch (e) {
    console.error('AI chat error:', e);
    res.status(500).json({ error: e.message });
  }
});

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
    source_name: sh.source_name || '',
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
    // customer_note: ملاحظة العميل الأصلية من Shopify (read-only، تفضل زي ما هي)
    customer_note: sh.note || '',
    // order_note: ملاحظة داخلية — نسخ من Shopify أول مرة، الموظف يقدر يعدلها
    order_note: sh.note || '',
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
    zoneManuallySet: r.zone_manually_set || false,
    orderNote: r.order_note || '',
    customerNote: r.customer_note || '',
    bostaExported: r.bosta_exported || false,
    bostaExportedAt: r.bosta_exported_at || null,
    lineItemsJson: r.line_items_json || null,
    subtotalPrice: parseFloat(r.subtotal_price) || 0,
    shippingPrice: parseFloat(r.shipping_price) || 0,
    sourceName: r.source_name || '',
    batchCode: r.batch_code || '',
    mergedInto: r.merged_into || null,
    mergedIds: r.merged_ids ? JSON.parse(r.merged_ids) : null,
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

  // ✨ جيب صور المنتجات قبل الحفظ
  try {
    const creds = await getShopifyCredentials();
    const shopUrl = creds.shopUrl;
    const accessToken = creds.accessToken;
    if (shopUrl && accessToken && sh.line_items && sh.line_items.length) {
      const host = shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const enriched = await enrichLineItemsWithImages(sh.line_items, host, accessToken);
      o.line_items_json = JSON.stringify(enriched);
    }
  } catch(e) { console.warn('Webhook image fetch failed:', e.message); }

  try {
    if (DB_ENABLED) {
      await pool.query(`
        INSERT INTO orders (id,shopify_id,src,name,phone,area,addr,addr2,total,subtotal_price,shipping_price,ship,courier_id,status,paid,shipping_method,delivery_type,note,items,line_items_json,source_name,time,created_at,customer_note,order_note)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
        ON CONFLICT (id) DO UPDATE SET
          name=EXCLUDED.name, phone=EXCLUDED.phone, area=EXCLUDED.area,
          addr=EXCLUDED.addr, addr2=EXCLUDED.addr2, total=EXCLUDED.total,
          subtotal_price=EXCLUDED.subtotal_price, shipping_price=EXCLUDED.shipping_price,
          source_name=EXCLUDED.source_name,
          paid=EXCLUDED.paid, shipping_method=EXCLUDED.shipping_method,
          delivery_type=EXCLUDED.delivery_type, note=EXCLUDED.note,
          items=EXCLUDED.items, line_items_json=EXCLUDED.line_items_json,
          customer_note=EXCLUDED.customer_note,
          -- order_note: نحفظ اللي موجود لو الموظف عدل عليه، وإلا نحط اللي من Shopify
          order_note=CASE
            WHEN orders.order_note IS NOT NULL AND orders.order_note <> '' AND orders.order_note <> orders.customer_note THEN orders.order_note
            ELSE EXCLUDED.order_note
          END,
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
          o.note, o.items, o.line_items_json, o.source_name||'', o.time, o.created_at,
          o.customer_note || '', o.order_note || '']);
    } else {
      const idx = memOrders.findIndex(x=>x.id===o.id);
      if (idx<0) memOrders.unshift({...o, shopifyId:o.shopify_id, courierId:null});
    }
    res.status(200).json({ received: true });
    // Trigger invoice cache generation asynchronously (don't block webhook response)
    setImmediate(() => cacheInvoiceForOrder(o.id).catch(e => console.warn('webhook cache:', e.message)));
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
  // ولّد الفاتورة في الخلفية
  setImmediate(() => cacheInvoiceForOrder(id).catch(e => console.warn('manual order cache:', e.message)));
});

// helper — سجل حدث في تاريخ الطلب
async function logOrderHistory(orderId, action, details={}) {
  if (!DB_ENABLED) return;
  try {
    await pool.query(
      'INSERT INTO order_history (order_id, action, field, old_value, new_value, user_name) VALUES ($1,$2,$3,$4,$5,$6)',
      [orderId, action, details.field||null, details.old||null, details.new||null, details.user||'system']
    );
  } catch(e) { console.warn('logOrderHistory:', e.message); }
}

// ===== MERGE ORDERS =====
app.post('/api/orders/merge', async (req, res) => {
  const { primaryId, secondaryIds, mergedTotal, mergedItems, mergedLineItemsJson, shipMode, shipCost } = req.body;
  if (!primaryId || !secondaryIds?.length) return res.status(400).json({ error: 'بيانات ناقصة' });
  if (!DB_ENABLED) return res.json({ ok: true });
  try {
    // حدّث الطلب الرئيسي
    const allIds = [primaryId, ...secondaryIds];
    const mergedLabel = allIds.join(' + ');
    await pool.query(
      `UPDATE orders SET total=$1, items=$2, line_items_json=$3, ship=$4, merged_ids=$5, updated_at=NOW() WHERE id=$6`,
      [mergedTotal, mergedItems, mergedLineItemsJson||null, shipCost||50, JSON.stringify(allIds), primaryId]
    );
    // الطلبات الثانوية → حالة "مدمج"
    for (const sid of secondaryIds) {
      await pool.query(
        `UPDATE orders SET status='مدمج', merged_into=$1, updated_at=NOW() WHERE id=$2`,
        [primaryId, sid]
      );
    }
    // سجل في التاريخ
    await logOrderHistory(primaryId, 'دمج طلبات', {
      field: 'merged', new: secondaryIds.join(', '), user: req.body._user||'مستخدم'
    });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
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
    zoneManuallySet:'zone_manually_set',
    orderNote:'order_note',
    customerNote:'customer_note',
    bostaExported:'bosta_exported',
    bostaExportedAt:'bosta_exported_at',
    name:'name', phone:'phone', area:'area', addr:'addr',
    province:'province',
    items:'items', total:'total', lineItemsJson:'line_items_json',
    batchCode:'batch_code', sourceName:'source_name',
    mergedInto:'merged_into', mergedIds:'merged_ids',
  };

  // جيب القيم القديمة للـ history
  const { rows: oldRows } = await pool.query('SELECT * FROM orders WHERE id=$1', [req.params.id]);
  const oldRow = oldRows[0] || {};

  Object.entries(b).forEach(([k, v]) => {
    if (map[k]) { sets.push(`${map[k]}=$${vals.length+1}`); vals.push(v); }
  });
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
  sets.push(`updated_at=NOW()`);
  vals.push(req.params.id);
  await pool.query(`UPDATE orders SET ${sets.join(',')} WHERE id=$${vals.length}`, vals);

  // سجل في الـ history
  const userName = b._user || 'مستخدم';
  if (b.status && b.status !== oldRow.status) {
    await logOrderHistory(req.params.id, 'تغيير الحالة', {field:'status', old:oldRow.status, new:b.status, user:userName});
  }
  if (b.courierId !== undefined && String(b.courierId) !== String(oldRow.courier_id)) {
    const newCourier = b.courierId || (b.isBosta ? 'بوسطة' : 'غير معيّن');
    await logOrderHistory(req.params.id, 'تعيين مندوب', {field:'courier', old:oldRow.courier_id||'—', new:newCourier, user:userName});
  }
  if (b.name && b.name !== oldRow.name) {
    await logOrderHistory(req.params.id, 'تعديل البيانات', {field:'name', old:oldRow.name, new:b.name, user:userName});
  }
  if (b.paid !== undefined && b.paid !== oldRow.paid) {
    await logOrderHistory(req.params.id, 'تغيير حالة الدفع', {field:'paid', old:String(oldRow.paid), new:String(b.paid), user:userName});
  }

  const { rows } = await pool.query('SELECT * FROM orders WHERE id=$1', [req.params.id]);
  res.json({ order: rows[0] ? rowToOrder(rows[0]) : null });
  // حدّث الفاتورة في الخلفية — امسح القديمة وولّد جديدة
  setImmediate(async () => {
    try {
      await pool.query('DELETE FROM invoice_cache WHERE order_id=$1', [req.params.id]);
      await cacheInvoiceForOrder(req.params.id);
    } catch(e) { console.warn('patch invoice cache:', e.message); }
  });
});

// ===== ORDER HISTORY =====
app.get('/api/orders/:id/history', async (req, res) => {
  if (!DB_ENABLED) return res.json({ history: [] });
  try {
    const { rows } = await pool.query(
      'SELECT * FROM order_history WHERE order_id=$1 ORDER BY ts DESC LIMIT 50',
      [req.params.id]
    );
    res.json({ history: rows.map(r => ({
      id: r.id,
      action: r.action,
      field: r.field,
      oldValue: r.old_value,
      newValue: r.new_value,
      userName: r.user_name,
      ts: r.ts,
    })) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// تسجيل حدث يدوي من الفرونتند
app.post('/api/orders/:id/history', async (req, res) => {
  const { action, field, oldValue, newValue, userName } = req.body;
  await logOrderHistory(req.params.id, action, { field, old:oldValue, new:newValue, user:userName||'مستخدم' });
  res.json({ ok: true });
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

      // ✨ جيب صور المنتجات لكل طلب
      const host = shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      for (let i = 0; i < shopifyOrders.length; i++) {
        const sh = shopifyOrders[i];
        if (sh.line_items && sh.line_items.length) {
          try {
            const enriched = await enrichLineItemsWithImages(sh.line_items, host, accessToken);
            mappedOrders[i].line_items_json = JSON.stringify(enriched);
          } catch(e) { console.warn('Image fetch for', mappedOrders[i].id, ':', e.message); }
        }
      }

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

    // Pre-generate invoices for all imported orders in background
    setImmediate(async () => {
      for (const sh of shopifyOrders) {
        const orderId = 'SH-' + sh.order_number;
        try { await cacheInvoiceForOrder(orderId); } catch(e) {}
      }
      console.log('✅ Pre-generated invoices for', shopifyOrders.length, 'imported orders');
    });
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
    role: r.role || 'courier',
    username: r.username || null,
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
    ship:'ship', shipExpress:'ship_express', status:'status', settled:'settled', settledAt:'settled_at',
    role:'role', email:'email', username:'username' };
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
// ===== BACKFILL IMAGES FOR EXISTING ORDERS =====
app.post('/api/shopify/backfill-images', async (req, res) => {
  const { shopUrl, accessToken, limit = 50 } = req.body;
  if (!shopUrl || !accessToken) return res.status(400).json({ error: 'بيانات ناقصة' });
  if (!DB_ENABLED) return res.json({ done: 0, skipped: 0, error: 'DB not enabled' });
  const host = shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  try {
    // جيب الطلبات من Shopify اللي مش عندها صور كاملة
    const { rows } = await pool.query(
      "SELECT id, shopify_id, line_items_json FROM orders WHERE src='shopify' AND shopify_id IS NOT NULL ORDER BY created_at DESC LIMIT $1",
      [limit]
    );

    let done = 0, skipped = 0, failed = 0;
    for (const row of rows) {
      try {
        // تحقق لو الطلب فعلاً محتاج صور
        let items = [];
        try { items = JSON.parse(row.line_items_json || '[]'); } catch(e) {}
        const hasAllImages = items.length > 0 && items.every(i => i.image);
        if (hasAllImages) { skipped++; continue; }

        const r = await shopifyRequest(host, accessToken,
          `/admin/api/2024-10/orders/${row.shopify_id}.json?fields=line_items,subtotal_price,shipping_lines`);
        if (r.status !== 200) { failed++; continue; }

        const sh = r.data.order;
        const enriched = await enrichLineItemsWithImages(sh.line_items || [], host, accessToken);
        const lineItemsJson = JSON.stringify(enriched);
        const subtotalPrice = parseFloat(sh.subtotal_price) || 0;
        const shippingPrice = (sh.shipping_lines || []).reduce((s, l) => s + (parseFloat(l.price) || 0), 0);

        await pool.query(
          'UPDATE orders SET line_items_json=$1, subtotal_price=$2, shipping_price=$3, updated_at=NOW() WHERE id=$4',
          [lineItemsJson, subtotalPrice, shippingPrice, row.id]
        );
        done++;
      } catch(e) { console.warn('Backfill', row.id, e.message); failed++; }
    }

    res.json({ total: rows.length, done, skipped, failed });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

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
    const enriched = await enrichLineItemsWithImages(sh.line_items || [], host, accessToken);
    const lineItemsJson = JSON.stringify(enriched);
    const subtotalPrice = parseFloat(sh.subtotal_price) || 0;
    const shippingPrice = (sh.shipping_lines || []).reduce((s, l) => s + (parseFloat(l.price) || 0), 0);

    if (DB_ENABLED && orderId) {
      await pool.query(
        'UPDATE orders SET line_items_json=$1, subtotal_price=$2, shipping_price=$3, updated_at=NOW() WHERE id=$4',
        [lineItemsJson, subtotalPrice, shippingPrice, orderId]
      );
    }
    res.json({ success: true, lineItemsJson, subtotalPrice, shippingPrice });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shopify/price-check', async (req, res) => {
  const { shopUrl, accessToken, shopifyOrderId } = req.body;
  if (!shopUrl || !accessToken || !shopifyOrderId)
    return res.status(400).json({ error: 'بيانات ناقصة' });
  const host = shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  try {
    const r = await shopifyRequest(host, accessToken,
      `/admin/api/2024-10/orders/${shopifyOrderId}.json`);
    if (r.status !== 200) return res.status(r.status).json({ error: r.data });

    const o = r.data.order;
    const lineItemsSum = (o.line_items||[]).reduce((s,i)=>s + (parseFloat(i.price)||0)*(i.quantity||1), 0);
    const shippingTotal = (o.shipping_lines||[]).reduce((s,l)=>s + (parseFloat(l.price)||0), 0);
    const taxTotal = parseFloat(o.total_tax) || 0;
    const discountTotal = parseFloat(o.total_discounts) || 0;

    res.json({
      orderName: o.name,
      orderNumber: o.order_number,
      currency: o.currency,
      subtotalPrice: parseFloat(o.subtotal_price),
      totalShipping: shippingTotal,
      totalTax: taxTotal,
      totalDiscounts: discountTotal,
      totalPrice: parseFloat(o.total_price),
      totalOutstanding: parseFloat(o.total_outstanding),
      financialStatus: o.financial_status,
      lineItemsSum,
      lineItems: (o.line_items||[]).map(i=>({
        name: i.name,
        price: parseFloat(i.price)||0,
        quantity: i.quantity,
        total: (parseFloat(i.price)||0)*(i.quantity||1),
        totalDiscount: parseFloat(i.total_discount)||0,
      })),
      shippingLines: (o.shipping_lines||[]).map(l=>({
        title: l.title,
        price: parseFloat(l.price)||0,
      })),
      taxLines: o.tax_lines || [],
      discountApplications: o.discount_applications || [],
      discountCodes: o.discount_codes || [],
      note: o.note,
      noteAttributes: o.note_attributes,
    });
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
  let { shopUrl, accessToken, shopifyOrderId, courierName, orderId } = req.body;
  let credsSource = 'body';

  // لو الفرونتند مبعتش credentials (مستخدم مش مدير)، جيبها من DB
  if (!shopUrl || !accessToken) {
    const creds = await getShopifyCredentials();
    shopUrl = shopUrl || creds.shopUrl;
    accessToken = accessToken || creds.accessToken;
    credsSource = creds.fromDb ? 'database' : 'env';
  }

  console.log('shopify/assign called:', { orderId, shopifyOrderId, courierName, credsSource, tokenLen: accessToken?.length, tokenStart: accessToken?.slice(0,10) });

  if (!shopUrl || !accessToken || !shopifyOrderId) {
    return res.status(400).json({ success: false, error: 'بيانات ناقصة — الـ credentials مش محفوظة على السيرفر' });
  }

  const host = shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const errors = [];
  const logs = [];
  logs.push(`creds from: ${credsSource}, host: ${host}, token: ${accessToken.slice(0,10)}... (${accessToken.length} chars)`);

  // ======= 1. إضافة Tag المندوب =======
  let tagSuccess = false;
  try {
    const getR = await shopifyRequest(host, accessToken, `/admin/api/2024-10/orders/${shopifyOrderId}.json?fields=id,tags`);
    logs.push(`GET order HTTP ${getR.status}${getR.status !== 200 ? ' — body: ' + JSON.stringify(getR.data).slice(0,200) : ''}`);
    if (getR.status === 200 && getR.data.order) {
      const currentTags = (getR.data.order.tags || '').split(',').map(t=>t.trim()).filter(t=>t);
      if (!currentTags.includes(courierName)) {
        const newTags = [...currentTags, courierName].join(', ');
        const tagR = await shopifyRequest(host, accessToken,
          `/admin/api/2024-10/orders/${shopifyOrderId}.json`, 'PUT',
          { order: { id: shopifyOrderId, tags: newTags } });
        if (tagR.status === 200) {
          tagSuccess = true;
          logs.push(`✅ Tag added: ${courierName}`);
        } else {
          logs.push(`⚠️ Tag PUT failed HTTP ${tagR.status} — ${JSON.stringify(tagR.data).slice(0,200)}`);
          if(tagR.status === 403) errors.push('Token needs write_orders scope for tags');
        }
      } else {
        tagSuccess = true;
        logs.push('✅ Tag already exists');
      }
    } else if (getR.status === 401) {
      errors.push('Shopify 401 Unauthorized — الـ Access Token غير صالح أو منتهي');
      logs.push('❌ HTTP 401 — token invalid');
    } else if (getR.status === 404) {
      errors.push('الطلب مش موجود في Shopify (ID: ' + shopifyOrderId + ')');
    } else {
      errors.push(`Shopify GET failed HTTP ${getR.status}`);
    }
  } catch (e) { logs.push('Tag error: ' + e.message); errors.push('Tag exception: ' + e.message); }

  // ======= 2. Fulfillment Strategy =======
  let fulfilled = false;
  let fulfillErrors = [];

  try {
    // جيب كل الـ fulfillment orders للطلب
    const foR = await shopifyRequest(host, accessToken,
      `/admin/api/2024-10/orders/${shopifyOrderId}/fulfillment_orders.json`);

    logs.push(`FO list HTTP ${foR.status}, count: ${foR.data.fulfillment_orders?.length || 0}`);

    if (foR.status !== 200 || !foR.data.fulfillment_orders || !foR.data.fulfillment_orders.length) {
      fulfillErrors.push('No fulfillment orders found');
    } else {
      const allFOs = foR.data.fulfillment_orders;

      // جيب locations المتجر
      const locR = await shopifyRequest(host, accessToken, `/admin/api/2024-10/locations.json`);
      const merchantLocations = (locR.data.locations || []).filter(l => l.active);
      const defaultLocation = merchantLocations[0];
      logs.push(`Merchant locations: ${merchantLocations.length}`);

      for (const fo of allFOs) {
        logs.push(`FO ${fo.id} status=${fo.status} assigned_to=${fo.assigned_location_id}`);

        // لو الـ FO مقفول بالفعل، نعتبره مكتمل
        if (fo.status === 'closed' || fo.status === 'fulfilled') {
          logs.push(`FO ${fo.id} already closed/fulfilled`);
          fulfilled = true;
          continue;
        }

        // STEP 1: لو الـ FO معين لـ third-party app، نحاول نرجعه لـ merchant
        // بنحاول release + move
        if (fo.assigned_location_id && defaultLocation && fo.assigned_location_id !== defaultLocation.id) {
          // جرب release من الـ third-party
          try {
            const releaseR = await shopifyRequest(host, accessToken,
              `/admin/api/2024-10/fulfillment_orders/${fo.id}/release.json`, 'POST', {});
            logs.push(`Release FO ${fo.id} HTTP ${releaseR.status}`);
          } catch(eR) { logs.push(`Release err: ${eR.message}`); }

          // جرب move للـ merchant location
          try {
            const moveR = await shopifyRequest(host, accessToken,
              `/admin/api/2024-10/fulfillment_orders/${fo.id}/move.json`, 'POST', {
                fulfillment_order: { new_location_id: defaultLocation.id }
              });
            logs.push(`Move FO ${fo.id} HTTP ${moveR.status}`);
          } catch(eM) { logs.push(`Move err: ${eM.message}`); }
        }

        // STEP 2: جرب fulfill
        const fulfillR = await shopifyRequest(host, accessToken,
          `/admin/api/2024-10/fulfillments.json`, 'POST', {
            fulfillment: {
              line_items_by_fulfillment_order: [{ fulfillment_order_id: fo.id }],
              notify_customer: false,
              tracking_info: { company: courierName },
            }
          });
        logs.push(`Fulfill FO ${fo.id} HTTP ${fulfillR.status}`);

        if (fulfillR.status === 200 || fulfillR.status === 201) {
          fulfilled = true;
          logs.push(`✅ Fulfilled FO ${fo.id}`);
        } else {
          const errBody = JSON.stringify(fulfillR.data).slice(0,300);
          fulfillErrors.push(`FO ${fo.id}: HTTP ${fulfillR.status} — ${errBody}`);

          // STEP 3: لو فشل، جرب بدون tracking info
          const simpleR = await shopifyRequest(host, accessToken,
            `/admin/api/2024-10/fulfillments.json`, 'POST', {
              fulfillment: {
                line_items_by_fulfillment_order: [{ fulfillment_order_id: fo.id }],
                notify_customer: false,
              }
            });
          logs.push(`Simple fulfill FO ${fo.id} HTTP ${simpleR.status}`);

          if (simpleR.status === 200 || simpleR.status === 201) {
            fulfilled = true;
            logs.push(`✅ Fulfilled FO ${fo.id} (simple)`);
            fulfillErrors = [];
          }
        }
      }
    }

    if (!fulfilled && fulfillErrors.length) {
      errors.push(...fulfillErrors);
    }

  } catch (e) { errors.push('Fulfill exception: ' + e.message); }

  // طباعة كل الـ logs للـ debugging
  console.log('=== shopify/assign logs ===');
  logs.forEach(l => console.log('  ', l));
  console.log('=== Result ===', { tagSuccess, fulfilled, errors });

  // نجاح كامل لو الاتنين نجحوا
  const success = tagSuccess && fulfilled;
  res.json({
    success,
    tagSuccess,
    fulfilled,
    errors,
    logs, // هنرجعها كمان عشان debugging من الفرونتند
    message: success ? 'تم بنجاح' : (errors.join(' | ') || 'فشل جزئي')
  });
});

// ===== ENRICH LINE ITEMS WITH PRODUCT IMAGES =====
// بيجيب صور المنتجات من Products API ويربطهم بالـ line_items
// ===== INVOICE HTML GENERATOR (CACHED) =====
// بيبني HTML كامل للفاتورة مع الصور كـ base64 inline
// النتيجة بتتحفظ في DB لمدة أسبوع، وبتتولد تلقائياً عند إنشاء/تعديل الطلب

// بيجيب Shopify credentials من DB أو من env vars
async function getShopifyCredentials() {
  // جرّب DB أولاً
  if (DB_ENABLED) {
    try {
      const { rows } = await pool.query(
        "SELECT key, value FROM app_settings WHERE key IN ('shopify_url', 'shopify_token')"
      );
      const map = {};
      rows.forEach(r => map[r.key] = r.value);
      if (map.shopify_url && map.shopify_token) {
        return { shopUrl: map.shopify_url, accessToken: map.shopify_token, fromDb: true };
      }
    } catch(e) {}
  }
  // fallback env
  return {
    shopUrl: process.env.SHOPIFY_SHOP_URL || '',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
    fromDb: false
  };
}

function fetchImageAsBase64(imageUrl) {
  return new Promise((resolve) => {
    if (!imageUrl || !imageUrl.startsWith('http')) return resolve(null);
    try {
      const url = new URL(imageUrl);
      const mod = url.protocol === 'https:' ? require('https') : require('http');
      // timeout 15 ثانية — Shopify CDN ساعات بيكون بطيء
      const req = mod.get(imageUrl, { timeout: 15000 }, (res) => {
        if (res.statusCode !== 200) { res.resume(); return resolve(null); }
        const chunks = [];
        let totalSize = 0;
        res.on('data', (c) => {
          totalSize += c.length;
          // لو الصورة كبيرة جداً (>1.5MB)، ألغي عشان ما نملأش الـ DB
          if (totalSize > 1500 * 1024) { req.destroy(); return resolve(null); }
          chunks.push(c);
        });
        res.on('end', () => {
          try {
            const buf = Buffer.concat(chunks);
            const mime = res.headers['content-type'] || 'image/jpeg';
            resolve('data:' + mime + ';base64,' + buf.toString('base64'));
          } catch(e) { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    } catch(e) { resolve(null); }
  });
}

async function generateInvoiceHtml(order, couriersArr) {
  // جيب line items مع الصور (مرّة واحدة) وحوّلهم لـ base64
  let lineItems = [];
  try { lineItems = JSON.parse(order.line_items_json || order.lineItemsJson || '[]'); } catch(e) {}

  // للطلبات Shopify: تأكد إن الصور موجودة، وإن لم تكن - جيبها
  if (order.src === 'shopify' && (order.shopify_id || order.shopifyId)) {
    const hasAllImages = lineItems.length > 0 && lineItems.every(i => i.image);
    if (!hasAllImages) {
      const creds = await getShopifyCredentials();
      const shopUrl = creds.shopUrl;
      const accessToken = creds.accessToken;
      if (shopUrl && accessToken) {
        try {
          const host = shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
          const r = await shopifyRequest(host, accessToken,
            `/admin/api/2024-10/orders/${order.shopify_id || order.shopifyId}.json?fields=line_items`);
          if (r.status === 200 && r.data.order) {
            lineItems = await enrichLineItemsWithImages(r.data.order.line_items || [], host, accessToken);
          }
        } catch(e) { console.warn('fetch images for invoice:', e.message); }
      }
    }
  }

  // fallback لو مفيش line items
  if (!lineItems.length && order.items) {
    lineItems = order.items.split(',').map(s=>{
      s=s.trim();
      const m=s.match(/^(.+?)\s+x(\d+)$/i);
      if(m) return {name:m[1].trim(), quantity:parseInt(m[2]), price:0, totalPrice:0};
      return {name:s, quantity:1, price:0, totalPrice:0};
    }).filter(i=>i.name);
  }
  if (!lineItems.length) lineItems = [{name: order.details || '—', quantity: 1, price: order.total || 0, totalPrice: order.total || 0}];

  // حوّل الصور لـ base64 (مع تحديد وقت max 12 ثانية للصورة الواحدة)
  const imagePromises = lineItems.map(i => {
    if (!i.image) return Promise.resolve(null);
    // لو الصورة مش URL صحيح أو بالفعل data:، سيبها زي ما هي
    if (typeof i.image !== 'string' || !i.image.startsWith('http')) return Promise.resolve(i.image);
    return fetchImageAsBase64(i.image);
  });
  const base64Images = await Promise.all(imagePromises);
  lineItems.forEach((i, idx) => {
    if (base64Images[idx]) {
      i.image = base64Images[idx];
    }
    // لو الـ fetch فشل، نحتفظ بـ i.image الأصلي (URL) بدل ما نخليها null
    // عشان المتصفح يحاول يحمل الصورة وقت الطباعة
  });

  // بيانات العنوان بدون تكرار
  const addrParts = [];
  if (order.addr) addrParts.push(order.addr);
  if (order.area && !(order.addr||'').includes(order.area)) addrParts.push(order.area);
  const addr1 = addrParts.filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join('<br>') || (order.area||'');

  const courierName = order.courier_id || order.courierId
    ? (couriersArr.find(c=>String(c.id)===String(order.courier_id || order.courierId))?.name||'—')
    : null;
  const deliveryLabel = order.is_bosta || order.isBosta ? 'Bosta'
    : (order.delivery_type||order.deliveryType)==='pickup' ? 'Store Pickup'
    : courierName ? courierName : '—';
  const _src = order.src||'';
  const _sn = String(order.source_name || order.sourceName || '');
  const sourceLabel = _src==='manual' ? 'Manual'
    : _src!=='shopify' ? (_src||'—')
    : _sn==='web' || _sn==='' ? 'Website'
    : _sn==='shopify_draft_orders' ? 'Draft Order'
    : _sn==='pos' ? 'POS'
    : /^\d+$/.test(_sn) ? 'Mobile App'
    : _sn;

  const totalItems = lineItems.reduce((s,i)=>s+(i.quantity||1),0);
  const uniqueItems = lineItems.length;
  const orderNum = (order.id || '').toString().replace('SH-','').replace('MN-','');
  const orderDate = order.created_at || order.createdAt
    ? new Date(order.created_at || order.createdAt).toLocaleDateString('en-GB',{year:'numeric',month:'long',day:'numeric'})
    : new Date().toLocaleDateString('en-GB',{year:'numeric',month:'long',day:'numeric'});
  const subtotal = parseFloat(order.subtotal_price || order.subtotalPrice) > 0
    ? parseFloat(order.subtotal_price || order.subtotalPrice)
    : lineItems.reduce((s,i)=>s+(i.totalPrice || (i.price*(i.quantity||1)) || 0),0) || parseFloat(order.total||0);
  const shippingCost = parseFloat(order.shipping_price || order.shippingPrice || 0);
  const total = parseFloat(order.total || subtotal);
  const fmtMoney = n => `EGP ${(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  const qtyFreq = {};
  lineItems.forEach(i=>{ const q=i.quantity||1; qtyFreq[q]=(qtyFreq[q]||0)+1; });
  const commonQty = parseInt(Object.entries(qtyFreq).sort((a,b)=>b[1]-a[1])[0][0]);

  const itemsHtml = lineItems.map(i=>{
    const qty = i.quantity || 1;
    const lineTotal = i.totalPrice || (i.price*qty) || 0;
    const isDiff = lineItems.length > 1 && qty > commonQty;
    const imgHtml = i.image
      ? `<div style="width:64px;height:64px"><img src="${i.image}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:4px"></div>`
      : `<div style="width:64px;height:64px;background:#fafbfc;display:flex;align-items:center;justify-content:center;font-size:22px;border-radius:4px">📦</div>`;
    const qtyHtml = isDiff
      ? `<div style="min-width:40px;text-align:center;border:2.5px solid #000;border-radius:4px;padding:2px 4px"><div style="font-size:28px;font-weight:900;line-height:1;color:#000">${qty}</div><div style="font-size:8px;font-weight:700;color:#000;margin-top:1px">!!</div></div>`
      : `<div style="font-size:15px;font-weight:400;width:40px;text-align:left;color:#555">${qty} ×</div>`;
    const rowStyle = isDiff ? 'border:2px solid #000;border-radius:4px;margin:4px -4px;padding:6px 4px;' : '';
    return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #e5e7eb;${rowStyle}">${qtyHtml}${imgHtml}<div style="flex:1"><div style="${isDiff?'font-weight:700;':''}font-size:14px">${(i.name||'').replace(/[<>]/g,'')}</div>${i.variantTitle?`<div style="font-size:11px;color:#6b7280">${i.variantTitle}</div>`:''}${i.sku?`<div style="font-size:11px;color:#6b7280">SKU: ${i.sku}</div>`:''}${i.price>0?`<div style="font-size:11px;color:#6b7280">${fmtMoney(i.price)}</div>`:''}</div><div style="text-align:left;font-weight:700;font-size:14px">${lineTotal>0?fmtMoney(lineTotal):''}</div></div>`;
  }).join('');

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>Order ${orderNum}</title>
<style>
  body{font-size:15px;margin:0;padding:0;font-family:"Noto Sans",Arial,sans-serif;font-weight:400}
  *{box-sizing:border-box}
  .wrapper{width:831px;margin:auto;padding:3em}
  .header{display:flex;justify-content:space-between;align-items:start;margin-bottom:20px}
  .brand{font-size:28px;font-weight:800}
  .order-info{text-align:left;font-size:13px}
  .order-info .code{font-weight:700}
  .ship-to{margin-bottom:20px}
  .ship-label{font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:6px}
  .summary-box{margin:1.2em 0.7em 0;border:1.5px solid #000;border-radius:4px;padding:10px 14px;font-size:11px;page-break-inside:avoid;break-inside:avoid}
  .footer-thanks{text-align:center;margin-top:30px;font-size:12px;color:#555}
  .print-btn{display:inline-block;background:#000;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:14px;cursor:pointer;margin-top:10px}
  @media print { .no-print{display:none!important} @page{margin:1cm} }
</style></head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="brand">CAFELAX</div>
    <div class="order-info"><div class="code">Order ${orderNum}</div><div>${orderDate}</div>${order.batch_code || order.batchCode ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">${order.batch_code || order.batchCode}</div>`:''}</div>
  </div>
  <div class="ship-to">
    <div class="ship-label">Ship to</div>
    <div style="font-size:14px;line-height:1.8"><strong>${(order.name||'').replace(/[<>]/g,'')}</strong><br>${addr1}<br>Egypt<br><span style="direction:ltr;unicode-bidi:plaintext">${order.phone||''}</span></div>
  </div>
  <hr>
  <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;text-transform:uppercase;padding-bottom:8px;border-bottom:1px solid #e5e7eb;margin-bottom:8px">
    <div style="width:100px">Quantity</div>
    <div style="flex:1;margin-left:60px">Items</div>
    <div style="text-align:left">Total</div>
  </div>
  ${itemsHtml}
  <div style="text-align:left;margin-top:15px;font-size:14px;font-weight:700;line-height:2">
    Subtotal ${fmtMoney(subtotal)}<br>
    Shipping ${fmtMoney(shippingCost)}<br>
    Total ${fmtMoney(total)}
  </div>
  <hr>
  <div class="summary-box">
    <div style="display:flex;flex-wrap:wrap;gap:10px 28px;align-items:flex-start">
      <div style="min-width:80px"><div style="text-transform:uppercase;font-size:9px;font-weight:700;letter-spacing:.06em;color:#555;margin-bottom:3px">Delivery</div><strong style="font-size:14px">${deliveryLabel}</strong></div>
      <div style="min-width:80px"><div style="text-transform:uppercase;font-size:9px;font-weight:700;letter-spacing:.06em;color:#555;margin-bottom:3px">Source</div><strong style="font-size:14px">${sourceLabel}</strong></div>
      <div style="min-width:80px"><div style="text-transform:uppercase;font-size:9px;font-weight:700;letter-spacing:.06em;color:#555;margin-bottom:3px">Unique Items</div><strong style="font-size:14px">${uniqueItems} items</strong></div>
      <div style="border-right:2.5px solid #000;padding-right:16px"><div style="text-transform:uppercase;font-size:9px;font-weight:700;letter-spacing:.06em;color:#555;margin-bottom:3px">Total Pieces</div><strong style="font-size:22px">${totalItems} pcs</strong></div>
    </div>
  </div>
  <div class="footer-thanks">
    <h2 style="margin:10px 0">Thank you for shopping with us!</h2>
    <p style="margin:4px 0"><strong>CAFELAX</strong><br>info@cafelax.com<br>www.cafelax.com</p>
    <button class="print-btn no-print" onclick="window.print()">Print / Save PDF</button>
  </div>
</div>
</body></html>`;
}

async function cacheInvoiceForOrder(orderId) {
  if (!DB_ENABLED) return;
  try {
    // اقرأ الطلب من الـ DB
    const { rows } = await pool.query('SELECT * FROM orders WHERE id=$1', [orderId]);
    if (!rows.length) return;
    const order = rows[0];

    // اقرأ المناديب عشان نعرف اسم المندوب
    const { rows: couriersRows } = await pool.query('SELECT * FROM couriers').catch(()=>({rows:[]}));

    const html = await generateInvoiceHtml(order, couriersRows);
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // أسبوع

    await pool.query(`
      INSERT INTO invoice_cache (order_id, html, generated_at, expires_at)
      VALUES ($1, $2, NOW(), $3)
      ON CONFLICT (order_id) DO UPDATE SET
        html = EXCLUDED.html,
        generated_at = NOW(),
        expires_at = EXCLUDED.expires_at
    `, [orderId, html, expires]);

    console.log('✅ Invoice cached:', orderId);
  } catch(e) { console.warn('cacheInvoiceForOrder:', orderId, e.message); }
}

// امسح الفواتير المنتهية (tombstone cleanup)
async function cleanupExpiredInvoices() {
  if (!DB_ENABLED) return;
  try {
    const r = await pool.query('DELETE FROM invoice_cache WHERE expires_at < NOW() RETURNING order_id');
    if (r.rowCount > 0) console.log('🧹 Cleaned', r.rowCount, 'expired invoice caches');
  } catch(e) {}
}
setInterval(cleanupExpiredInvoices, 6 * 60 * 60 * 1000); // كل 6 ساعات

// ===== APP SETTINGS ENDPOINTS =====
// GET /api/settings → يرجع كل المفاتيح المحفوظة
app.get('/api/settings', async (req, res) => {
  if (!DB_ENABLED) return res.json({});
  try {
    const { rows } = await pool.query('SELECT key, value FROM app_settings');
    const settings = {};
    rows.forEach(r => {
      // خبي الـ token في الرد (أرجع أول 10 حروف + طول الـ token)
      if (key_is_token(r.key)) {
        settings[r.key] = r.value ? r.value.slice(0,10) + '...' + ` (${r.value.length} chars)` : '';
      } else {
        settings[r.key] = r.value;
      }
    });
    res.json(settings);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

function key_is_token(k){ return /token|password|secret|key/i.test(k); }

// GET /api/shopify/test — يختبر إذا كانت الـ credentials شغالة
app.get('/api/shopify/test', async (req, res) => {
  try {
    const creds = await getShopifyCredentials();
    if (!creds.shopUrl || !creds.accessToken) {
      return res.json({ 
        ok: false, 
        reason: 'no_credentials',
        message: 'الـ credentials مش محفوظة في السيرفر',
        source: 'none'
      });
    }
    const host = creds.shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const r = await shopifyRequest(host, creds.accessToken, `/admin/api/2024-10/shop.json`);
    if (r.status === 200 && r.data.shop) {
      return res.json({
        ok: true,
        source: creds.fromDb ? 'database' : 'env',
        shopName: r.data.shop.name,
        shopEmail: r.data.shop.email,
        plan: r.data.shop.plan_name,
        host
      });
    }
    return res.json({
      ok: false,
      reason: 'auth_failed',
      status: r.status,
      response: JSON.stringify(r.data).slice(0,200),
      message: r.status === 401 ? 'الـ Token غير صالح أو منتهي' : 'فشل في الاتصال',
      host
    });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/settings → يحفظ مفتاح واحد أو أكتر
app.post('/api/settings', async (req, res) => {
  if (!DB_ENABLED) return res.status(503).json({ error: 'DB unavailable' });
  try {
    const body = req.body || {};
    const keys = Object.keys(body);
    if (!keys.length) return res.status(400).json({ error: 'no keys' });
    for (const key of keys) {
      const value = String(body[key] || '');
      await pool.query(`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = NOW()
      `, [key, value]);
    }
    res.json({ ok: true, saved: keys.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== BATCHES ENDPOINTS =====
// GET /api/batches → كل الدفعات (أحدث أولاً)
app.get('/api/batches', async (req, res) => {
  if (!DB_ENABLED) return res.json([]);
  try {
    const { rows } = await pool.query(
      'SELECT code, batch_date, status, started_at, closed_at, order_count FROM batches ORDER BY started_at DESC LIMIT 200'
    );
    res.json(rows.map(r => ({
      code: r.code,
      date: r.batch_date,
      status: r.status,
      startedAt: r.started_at,
      closedAt: r.closed_at,
      orderCount: r.order_count || 0
    })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/batches/current → الدفعة المفتوحة حالياً (آخر واحدة status=open)
app.get('/api/batches/current', async (req, res) => {
  if (!DB_ENABLED) return res.json(null);
  try {
    const { rows } = await pool.query(
      "SELECT code, batch_date, status, started_at FROM batches WHERE status='open' ORDER BY started_at DESC LIMIT 1"
    );
    if (!rows.length) return res.json(null);
    const r = rows[0];
    res.json({
      code: r.code,
      date: r.batch_date,
      status: r.status,
      startedAt: r.started_at
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/batches → أنشئ دفعة جديدة
app.post('/api/batches', async (req, res) => {
  if (!DB_ENABLED) return res.status(503).json({ error: 'DB unavailable' });
  try {
    const { code, date, status, startedAt } = req.body || {};
    if (!code || !date) return res.status(400).json({ error: 'code and date required' });
    await pool.query(`
      INSERT INTO batches (code, batch_date, status, started_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (code) DO NOTHING
    `, [code, date, status || 'open', startedAt || new Date().toISOString()]);
    res.json({ ok: true, code });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/batches/:code → حدّث الدفعة (إقفال، تعديل عدد الطلبات)
app.patch('/api/batches/:code', async (req, res) => {
  if (!DB_ENABLED) return res.status(503).json({ error: 'DB unavailable' });
  try {
    const { status, closedAt, orderCount } = req.body || {};
    const sets = [];
    const vals = [];
    let i = 1;
    if (status !== undefined) { sets.push(`status=$${i++}`); vals.push(status); }
    if (closedAt !== undefined) { sets.push(`closed_at=$${i++}`); vals.push(closedAt); }
    if (orderCount !== undefined) { sets.push(`order_count=$${i++}`); vals.push(orderCount); }
    if (!sets.length) return res.status(400).json({ error: 'no fields' });
    vals.push(req.params.code);
    await pool.query(`UPDATE batches SET ${sets.join(', ')} WHERE code=$${i}`, vals);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// ===== INVOICE CACHE ENDPOINTS =====
// GET /api/orders/:id/invoice → يرجع الـ HTML جاهز للفاتورة
app.get('/api/orders/:id/invoice', async (req, res) => {
  if (!DB_ENABLED) return res.status(503).send('DB unavailable');
  try {
    // جرّب الكاش أولاً
    const { rows } = await pool.query(
      'SELECT html, generated_at, expires_at FROM invoice_cache WHERE order_id=$1 AND expires_at > NOW()',
      [req.params.id]
    );
    if (rows.length) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Invoice-Cached', 'true');
      res.setHeader('X-Invoice-Generated', rows[0].generated_at);
      return res.send(rows[0].html);
    }

    // مش موجود → ولّد جديد
    await cacheInvoiceForOrder(req.params.id);
    const r2 = await pool.query('SELECT html FROM invoice_cache WHERE order_id=$1', [req.params.id]);
    if (!r2.rows.length) return res.status(404).send('Order not found');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Invoice-Cached', 'false');
    res.send(r2.rows[0].html);
  } catch(e) {
    console.error('invoice endpoint:', e);
    res.status(500).send('Error: ' + e.message);
  }
});

// POST /api/orders/:id/invoice/refresh → يعيد توليد الفاتورة يدوياً
app.post('/api/orders/:id/invoice/refresh', async (req, res) => {
  try {
    await pool.query('DELETE FROM invoice_cache WHERE order_id=$1', [req.params.id]).catch(()=>{});
    await cacheInvoiceForOrder(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/invoices/batch-generate → يولّد عدة فواتير مرة واحدة (بالـ parallel)
app.post('/api/invoices/batch-generate', async (req, res) => {
  const { orderIds } = req.body;
  if (!Array.isArray(orderIds) || !orderIds.length) return res.status(400).json({ error: 'orderIds مطلوبة' });

  const CONCURRENCY = 5; // معالجة 5 فواتير في نفس الوقت
  let generated = 0, cached = 0, failed = 0;
  const startTs = Date.now();

  // فلتر أولاً الطلبات اللي عندها cache صالح
  const needsGen = [];
  for (const id of orderIds) {
    try {
      const r = await pool.query(
        'SELECT 1 FROM invoice_cache WHERE order_id=$1 AND expires_at > NOW()',
        [id]
      );
      if (r.rows.length) { cached++; }
      else needsGen.push(id);
    } catch(e) { failed++; }
  }

  console.log(`batch-generate: ${orderIds.length} total, ${cached} cached, ${needsGen.length} need generation`);

  // عالج الـ orders الناقصة في مجموعات متوازية
  const runOne = async (id) => {
    try {
      await cacheInvoiceForOrder(id);
      generated++;
    } catch(e) {
      console.warn('batch-generate failed for', id, ':', e.message);
      failed++;
    }
  };

  // نفّذ بـ chunks
  for (let i = 0; i < needsGen.length; i += CONCURRENCY) {
    const chunk = needsGen.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(runOne));
  }

  const took = ((Date.now() - startTs) / 1000).toFixed(1);
  console.log(`batch-generate done in ${took}s: ${generated} generated, ${cached} cached, ${failed} failed`);

  res.json({ total: orderIds.length, generated, cached, failed, tookSec: parseFloat(took) });
});

// POST /api/invoices/batch-html → يرجع كل الـ HTML للفواتير في response واحد (أسرع بكتير من 30 fetch)
app.post('/api/invoices/batch-html', async (req, res) => {
  const { orderIds } = req.body;
  if (!Array.isArray(orderIds) || !orderIds.length) return res.status(400).json({ error: 'orderIds مطلوبة' });
  if (orderIds.length > 200) return res.status(400).json({ error: 'max 200 orders per request' });

  const startTs = Date.now();
  try {
    // جيب كل الفواتير المحفوظة في الكاش في query واحد
    const { rows } = await pool.query(
      `SELECT order_id, html FROM invoice_cache
       WHERE order_id = ANY($1) AND expires_at > NOW()`,
      [orderIds]
    );

    const cacheMap = {};
    rows.forEach(r => { cacheMap[r.order_id] = r.html; });

    // حدد الـ orders اللي ناقصين في الكاش
    const missing = orderIds.filter(id => !cacheMap[id]);

    // ولّد المفقودة في parallel (5 بنفس الوقت)
    if (missing.length) {
      console.log(`batch-html: ${missing.length} orders need generation`);
      const CONCURRENCY = 5;
      for (let i = 0; i < missing.length; i += CONCURRENCY) {
        const chunk = missing.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(async (id) => {
          try {
            await cacheInvoiceForOrder(id);
            const r = await pool.query('SELECT html FROM invoice_cache WHERE order_id=$1', [id]);
            if (r.rows.length) cacheMap[id] = r.rows[0].html;
          } catch(e) {
            console.warn('batch-html gen failed for', id, ':', e.message);
          }
        }));
      }
    }

    const took = ((Date.now() - startTs) / 1000).toFixed(1);
    console.log(`batch-html: ${orderIds.length} orders returned in ${took}s`);

    // ارجع array مرتب حسب ترتيب المدخلات
    const result = orderIds.map(id => ({
      orderId: id,
      html: cacheMap[id] || null,
    }));

    res.json({
      invoices: result,
      tookSec: parseFloat(took),
      totalOrders: orderIds.length,
      missing: orderIds.length - Object.keys(cacheMap).length
    });
  } catch(e) {
    console.error('batch-html error:', e);
    res.status(500).json({ error: e.message });
  }
});

async function enrichLineItemsWithImages(lineItems, host, accessToken) {
  if (!lineItems || !lineItems.length || !host || !accessToken) return lineItems;

  const productImageCache = {};
  const variantImageCache = {};
  const productIds = [...new Set(lineItems.filter(i => !(i.image && i.image.src)).map(i => i.product_id).filter(Boolean))];

  for (const pid of productIds) {
    try {
      const pr = await shopifyRequest(host, accessToken,
        `/admin/api/2024-10/products/${pid}.json?fields=id,image,images,variants`);
      if (pr.status === 200 && pr.data.product) {
        const p = pr.data.product;
        if (p.image && p.image.src) productImageCache[pid] = p.image.src;
        (p.images || []).forEach(img => {
          (img.variant_ids || []).forEach(vid => {
            variantImageCache[vid] = img.src;
          });
        });
      }
    } catch(e) { console.warn('enrich product img:', pid, e.message); }
  }

  return lineItems.map(i => {
    let imageUrl = (i.image && i.image.src) ? i.image.src : null;
    if (!imageUrl && i.variant_id && variantImageCache[i.variant_id]) imageUrl = variantImageCache[i.variant_id];
    if (!imageUrl && i.product_id && productImageCache[i.product_id]) imageUrl = productImageCache[i.product_id];
    return {
      name: i.name,
      title: i.title,
      variantTitle: i.variant_title || '',
      sku: i.sku || '',
      quantity: i.quantity,
      price: parseFloat(i.price) || 0,
      totalPrice: (parseFloat(i.price) || 0) * (i.quantity || 1),
      image: imageUrl,
      productId: i.product_id,
      variantId: i.variant_id,
    };
  });
}

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
  res.json({ books: rows.map(r => ({
    id:r.id, name:r.name, bank:r.bank, account:r.account,
    pages:r.pages, note:r.note,
    firstNum: r.first_num||1, lastNum: r.last_num||null
  })) });
});

app.post('/api/check-books', async (req, res) => {
  try {
    const { id, name, bank, account, pages, note, firstNum, lastNum } = req.body;
    console.log('📘 POST /api/check-books:', { id, name, bank, pages, firstNum, lastNum });
    
    if (!DB_ENABLED){
      console.log('⚠️ DB not enabled, returning mock response');
      return res.json({ book: req.body });
    }
    
    // إضافة first_num و last_num columns لو مش موجودة
    try{ 
      await pool.query("ALTER TABLE check_books ADD COLUMN IF NOT EXISTS first_num INTEGER DEFAULT 1"); 
      await pool.query("ALTER TABLE check_books ADD COLUMN IF NOT EXISTS last_num INTEGER");
    }catch(e){ console.warn('alter check_books:', e.message); }
    
    console.log('💾 Inserting book into DB...');
    const result = await pool.query(
      'INSERT INTO check_books (id,name,bank,account,pages,note,first_num,last_num) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET name=$2,bank=$3,account=$4,pages=$5,note=$6,first_num=$7,last_num=$8 RETURNING *',
      [id, name, bank||'', account||'', pages||48, note||'', firstNum||1, lastNum||null]
    );
    
    console.log('✅ Book saved successfully:', result.rows[0]);
    res.json({ book: result.rows[0] });
  } catch(e) {
    console.error('❌ check-books POST error:', e.message, e.stack);
    res.status(500).json({ error: e.message });
  }
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
  const { books, checks, suppliers } = req.body;
  if (!DB_ENABLED) return res.json({ ok: true });
  try {
    let booksCount = 0, checksCount = 0;
    
    // sync books first
    for (const b of (books||[])) {
      try{
        await pool.query(
          `INSERT INTO check_books (id,name,bank,account,pages,note,first_num,last_num)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (id) DO UPDATE SET
           name=$2,bank=$3,account=$4,pages=$5,note=$6,first_num=$7,last_num=$8`,
          [b.id, b.name||'', b.bank||'', b.account||'', b.pages||48, b.note||'', b.firstNum||1, b.lastNum||null]
        );
        booksCount++;
      }catch(e){
        console.error('sync book error:', b.id, e.message);
      }
    }
    
    // sync checks (skip if book_id doesn't exist)
    for (const c of (checks||[])) {
      try{
        // تحقق من وجود الدفتر أول
        if(c.bookId){
          const bookCheck = await pool.query('SELECT id FROM check_books WHERE id=$1', [c.bookId]);
          if(!bookCheck.rows.length){
            console.warn('Check skipped - book not found:', c.id, 'book:', c.bookId);
            continue;
          }
        }
        
        await pool.query(
          `INSERT INTO checks (id,num,payee,amount,date,book_id,invoice,note,img,status,done_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (id) DO UPDATE SET
           num=$2,payee=$3,amount=$4,date=$5,book_id=$6,invoice=$7,note=$8,img=$9,status=$10,done_at=$11`,
          [c.id, c.num, c.payee||'', c.amount||0, c.date||null, c.bookId||null,
           c.invoice||'', c.note||'', c.img||'', c.status||'pending', c.doneAt||null]
        );
        checksCount++;
      }catch(e){
        console.error('sync check error:', c.id, e.message);
      }
    }
    
    // sync suppliers
    if (suppliers && suppliers.length) {
      try {
        await pool.query("CREATE TABLE IF NOT EXISTS check_suppliers (id TEXT PRIMARY KEY, name TEXT)");
        for (const s of suppliers) {
          const sid = s.id || (Date.now()+'_sup');
          const sname = s.name || s;
          if (sname) await pool.query(
            'INSERT INTO check_suppliers (id,name) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET name=$2',
            [sid, sname]
          );
        }
      } catch(e) { console.warn('sync suppliers:', e.message); }
    }
    
    res.json({ ok: true, books: booksCount, checks: checksCount });
  } catch(e) {
    console.error('sync-checks error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ===== HEALTH =====
const SERVER_VERSION = 'v55-2026-04-25';
app.get('/', async (req, res) => {
  let dbOk = false, orderCount = 0, hasPreparation = false, shopCourierId = null;
  if (DB_ENABLED) {
    try { const r = await pool.query('SELECT COUNT(*) FROM orders'); orderCount = parseInt(r.rows[0].count); dbOk = true; } catch {}
    // تحقق إن أعمدة التحضير موجودة
    try {
      const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name='preparation_status'`);
      hasPreparation = cols.rows.length > 0;
    } catch {}
    try {
      const s = await pool.query(`SELECT value FROM app_settings WHERE key='shop_courier_id'`);
      shopCourierId = s.rows[0]?.value || null;
    } catch {}
  } else {
    orderCount = memOrders.length;
  }
  res.json({
    status: '✅ OrderPro Backend شغال',
    version: SERVER_VERSION,
    db: DB_ENABLED ? (dbOk ? '✅ متصل' : '❌ منفصل') : '⚠️ بدون DB',
    orders: orderCount,
    preparationSystem: hasPreparation ? '✅ migrated' : '❌ migration needed',
    shopCourierId,
    uptime: Math.floor(process.uptime()) + ' ثانية'
  });
});

// ===== START =====
// (wrapper removed: each endpoint checks DB_ENABLED individually)
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

// ============================================================
// ===== CAFELAX STARS — Courier Mobile App Endpoints =====
// ============================================================

// Simple courier session tokens (in-memory, 24h TTL)
const _courierSessions = new Map(); // token -> {courierId, expires}
const _shopSessions = new Map(); // token -> {shopUserId, username, expires}

function _generateToken(){
  return crypto.randomBytes(32).toString('hex');
}

function _cleanupExpiredSessions(){
  const now = Date.now();
  for(const [token, session] of _courierSessions.entries()){
    if(session.expires < now) _courierSessions.delete(token);
  }
  for(const [token, session] of _shopSessions.entries()){
    if(session.expires < now) _shopSessions.delete(token);
  }
}
setInterval(_cleanupExpiredSessions, 60 * 60 * 1000); // every hour

// Middleware: validates courier token
function courierAuth(req, res, next){
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if(!token) return res.status(401).json({error: 'No token'});

  const session = _courierSessions.get(token);
  if(!session) return res.status(401).json({error: 'Invalid or expired token'});

  if(session.expires < Date.now()){
    _courierSessions.delete(token);
    return res.status(401).json({error: 'Session expired'});
  }

  req.courierId = session.courierId;
  next();
}

// POST /api/courier/login — login بـ username + password hash
app.post('/api/courier/login', async (req, res) => {
  if(!DB_ENABLED) return res.status(503).json({error: 'DB unavailable'});
  const {username, passHash} = req.body || {};
  if(!username || !passHash) return res.status(400).json({error: 'username و password مطلوبين'});

  try{
    const r = await pool.query(
      `SELECT id, name, phone, zone, username, role FROM couriers
       WHERE username=$1 AND password_hash=$2 AND (status IS NULL OR status != 'غير نشط')`,
      [username, passHash]
    );
    if(!r.rows.length) return res.json({success: false, error: 'خطأ في اسم المستخدم أو كلمة المرور'});

    const courier = r.rows[0];
    const token = _generateToken();
    const expires = Date.now() + 24 * 60 * 60 * 1000; // 24h
    _courierSessions.set(token, {courierId: courier.id, expires});

    // سجل آخر دخول
    await pool.query('UPDATE couriers SET last_login_at=NOW() WHERE id=$1', [courier.id]).catch(()=>{});

    res.json({
      success: true,
      token,
      courier: {
        id: courier.id,
        name: courier.name,
        phone: courier.phone,
        zone: courier.zone,
        username: courier.username,
        role: courier.role || 'courier'
      }
    });
  }catch(e){ res.status(500).json({error: e.message}); }
});

// GET /api/courier/me — معلومات المندوب الحالي
app.get('/api/courier/me', courierAuth, async (req, res) => {
  try{
    const r = await pool.query(
      'SELECT id, name, phone, zone, username, role FROM couriers WHERE id=$1',
      [req.courierId]
    );
    if(!r.rows.length) return res.status(404).json({error: 'Courier not found'});
    const c = r.rows[0];
    if (!c.role) c.role = 'courier';
    res.json(c);
  }catch(e){ res.status(500).json({error: e.message}); }
});

// GET /api/courier/my-orders — كل طلبات المندوب مقسمة حسب الحالة
app.get('/api/courier/my-orders', courierAuth, async (req, res) => {
  try{
    // الطلبات النشطة (جاري التوصيل، مع/في المحل)
    const r = await pool.query(
      `SELECT * FROM orders
       WHERE courier_id=$1
         AND status IN ('جاري التوصيل', 'جديد')
         AND (merged_into IS NULL OR merged_into = '')
         AND (cancelled_by_field IS NOT TRUE)
       ORDER BY 
         CASE WHEN picked_up_at IS NOT NULL THEN delivery_sequence END ASC NULLS LAST,
         picked_up_at ASC NULLS LAST, 
         created_at ASC`,
      [req.courierId]
    );

    const withMe = [];
    const newOrders = [];
    const completed = [];

    r.rows.forEach(o => {
      const mapped = _mapOrderForCourier(o);
      if(o.status === 'جاري التوصيل' && o.picked_up_at){
        withMe.push(mapped);
      } else if(o.status === 'جاري التوصيل' && !o.picked_up_at){
        newOrders.push(mapped);
      }
    });

    // الطلبات اللي سلمها النهاردة (للمراجعة)
    const todayR = await pool.query(
      `SELECT * FROM orders
       WHERE courier_id=$1
         AND courier_delivered_at IS NOT NULL
         AND courier_delivered_at::date = CURRENT_DATE
       ORDER BY courier_delivered_at DESC`,
      [req.courierId]
    );
    todayR.rows.forEach(o => completed.push(_mapOrderForCourier(o)));

    // ✨ الطلبات الملغية بانتظار استلام الإدارة
    const cancelledR = await pool.query(
      `SELECT * FROM orders
       WHERE courier_id=$1
         AND cancelled_by_field=true
         AND cancellation_received_at IS NULL
       ORDER BY cancelled_at DESC`,
      [req.courierId]
    );
    const cancelled = cancelledR.rows.map(o => _mapOrderForCourier(o));

    res.json({withMe, newOrders, completed, cancelled});
  }catch(e){ console.error('my-orders:', e); res.status(500).json({error: e.message}); }
});

// Helper: ترجمة صف الطلب للشكل المناسب لتطبيق المندوب
function _mapOrderForCourier(r){
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    area: r.area,
    addr: r.addr,
    addr2: r.addr2,
    governorate: r.governorate,
    city: r.city,
    total: parseFloat(r.total) || 0,
    ship: parseFloat(r.ship) || 0,
    paid: r.paid,
    status: r.status,
    deliveryType: r.delivery_type,
    assignedZone: r.assigned_zone,
    batchCode: r.batch_code,
    orderNote: r.order_note || '',
    customerNote: r.customer_note || '',
    courierNote: r.courier_note || '',
    items: r.items,
    pickedUpAt: r.picked_up_at,
    deliveredAt: r.courier_delivered_at,
    deliverySequence: r.delivery_sequence,
    undeliverableReason: r.undeliverable_reason,
    paymentChangeRequested: r.payment_change_requested || false,
    createdAt: r.created_at,
    // إلغاء (field cancellation)
    cancelledByField: r.cancelled_by_field || false,
    cancelledAt: r.cancelled_at,
    cancellationReason: r.cancellation_reason,
    cancellationReceivedAt: r.cancellation_received_at,
    // للعرض فقط، مش للـ fulfillment
    shopifyId: r.shopify_id,
    src: r.src,
  };
}

// POST /api/courier/orders/:id/deliver — تم التسليم
// body: {collectedCash: boolean} — هل حصّل فلوس؟ (للـ COD)
app.post('/api/courier/orders/:id/deliver', courierAuth, async (req, res) => {
  const {id} = req.params;
  try{
    // تحقق إن الطلب فعلاً للمندوب ده
    const chk = await pool.query('SELECT courier_id, status, paid FROM orders WHERE id=$1', [id]);
    if(!chk.rows.length) return res.status(404).json({error: 'الطلب غير موجود'});
    const o = chk.rows[0];
    if(String(o.courier_id) !== String(req.courierId)){
      return res.status(403).json({error: 'الطلب ده مش ليك'});
    }
    if(o.status !== 'جاري التوصيل'){
      return res.status(400).json({error: 'الطلب لا يمكن تسليمه في حالته الحالية'});
    }

    // ✓ تم التسليم → status = 'تحت التسوية'
    await pool.query(
      `UPDATE orders SET
        status='تحت التسوية',
        courier_delivered_at=NOW(),
        updated_at=NOW()
       WHERE id=$1`,
      [id]
    );

    // log history
    await pool.query(
      `INSERT INTO order_history (order_id, action, user_name, new_value)
       VALUES ($1, 'courier_delivered', $2, 'delivered')`,
      [id, 'Courier #' + req.courierId]
    ).catch(()=>{});

    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/courier/orders/:id/cancel — إلغاء الطلب (العميل رفض نهائياً)
// body: {reason: string}
app.post('/api/courier/orders/:id/cancel', courierAuth, async (req, res) => {
  const {id} = req.params;
  const {reason} = req.body || {};
  if(!reason || !reason.trim()) return res.status(400).json({error: 'السبب مطلوب'});

  try{
    const chk = await pool.query(
      'SELECT courier_id, status, cancelled_by_field, cancellation_received_at FROM orders WHERE id=$1',
      [id]
    );
    if(!chk.rows.length) return res.status(404).json({error: 'الطلب غير موجود'});
    const o = chk.rows[0];
    if(String(o.courier_id) !== String(req.courierId)){
      return res.status(403).json({error: 'الطلب ده مش ليك'});
    }
    if(o.status !== 'جاري التوصيل'){
      return res.status(400).json({error: 'الطلب لا يمكن إلغاؤه في حالته الحالية'});
    }
    if(o.cancelled_by_field){
      return res.status(400).json({error: 'الطلب ملغي بالفعل'});
    }

    // اسم المندوب للـ log
    const cR = await pool.query('SELECT name FROM couriers WHERE id=$1', [req.courierId]);
    const courierName = cR.rows[0]?.name || ('Courier #' + req.courierId);

    await pool.query(
      `UPDATE orders SET
        cancelled_by_field=true,
        cancelled_by_username=$2,
        cancelled_by_source='courier',
        cancelled_at=NOW(),
        cancellation_reason=$3,
        updated_at=NOW()
       WHERE id=$1`,
      [id, courierName, reason.trim()]
    );

    await pool.query(
      `INSERT INTO order_history (order_id, action, user_name, new_value)
       VALUES ($1, 'courier_cancelled', $2, $3)`,
      [id, courierName, reason.trim()]
    ).catch(()=>{});

    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/courier/orders/:id/uncancel — إرجاع الطلب الملغي لطلبات المندوب
// (مسموح فقط لو الإدارة لسه ما أكدتش الاستلام)
app.post('/api/courier/orders/:id/uncancel', courierAuth, async (req, res) => {
  const {id} = req.params;
  try{
    const chk = await pool.query(
      `SELECT courier_id, cancelled_by_field, cancellation_received_at, cancelled_by_source
       FROM orders WHERE id=$1`,
      [id]
    );
    if(!chk.rows.length) return res.status(404).json({error: 'الطلب غير موجود'});
    const o = chk.rows[0];
    if(String(o.courier_id) !== String(req.courierId)){
      return res.status(403).json({error: 'الطلب ده مش ليك'});
    }
    if(!o.cancelled_by_field){
      return res.status(400).json({error: 'الطلب ليس ملغي'});
    }
    if(o.cancellation_received_at){
      return res.status(400).json({error: 'الإدارة أكدت الاستلام بالفعل — لا يمكن التراجع'});
    }
    if(o.cancelled_by_source !== 'courier'){
      return res.status(403).json({error: 'الإلغاء تم من المحل — لا يمكن تراجعه من هنا'});
    }

    await pool.query(
      `UPDATE orders SET
        cancelled_by_field=false,
        cancelled_by_username=NULL,
        cancelled_by_source=NULL,
        cancelled_at=NULL,
        cancellation_reason=NULL,
        updated_at=NOW()
       WHERE id=$1`,
      [id]
    );

    const cR = await pool.query('SELECT name FROM couriers WHERE id=$1', [req.courierId]);
    await pool.query(
      `INSERT INTO order_history (order_id, action, user_name, new_value)
       VALUES ($1, 'courier_uncancelled', $2, 'reverted')`,
      [id, cR.rows[0]?.name || ('Courier #' + req.courierId)]
    ).catch(()=>{});

    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/courier/orders/:id/undeliverable — لم يتم التسليم (مؤقت، مش إلغاء)
// body: {reason: string}
app.post('/api/courier/orders/:id/undeliverable', courierAuth, async (req, res) => {
  const {id} = req.params;
  const {reason} = req.body || {};
  if(!reason) return res.status(400).json({error: 'السبب مطلوب'});

  try{
    const chk = await pool.query('SELECT courier_id, status FROM orders WHERE id=$1', [id]);
    if(!chk.rows.length) return res.status(404).json({error: 'الطلب غير موجود'});
    const o = chk.rows[0];
    if(String(o.courier_id) !== String(req.courierId)){
      return res.status(403).json({error: 'الطلب ده مش ليك'});
    }

    await pool.query(
      `UPDATE orders SET
        undeliverable_reason=$2,
        updated_at=NOW()
       WHERE id=$1`,
      [id, reason]
    );

    await pool.query(
      `INSERT INTO order_history (order_id, action, user_name, new_value)
       VALUES ($1, 'undeliverable', $2, $3)`,
      [id, 'Courier #' + req.courierId, reason]
    ).catch(()=>{});

    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/courier/orders/:id/pickup — المندوب يعلّم إنه استلم الطلب من المحل
app.post('/api/courier/orders/:id/pickup', courierAuth, async (req, res) => {
  const {id} = req.params;
  try{
    const chk = await pool.query(
      'SELECT courier_id, status, picked_up_at FROM orders WHERE id=$1',
      [id]
    );
    if(!chk.rows.length) return res.status(404).json({error: 'الطلب غير موجود'});
    const o = chk.rows[0];
    if(String(o.courier_id) !== String(req.courierId)){
      return res.status(403).json({error: 'الطلب ده مش ليك'});
    }
    if(o.status !== 'جاري التوصيل'){
      return res.status(400).json({error: 'الطلب لا يمكن استلامه في حالته الحالية'});
    }
    if(o.picked_up_at){
      return res.status(400).json({error: 'الطلب مستلم بالفعل'});
    }

    await pool.query(
      `UPDATE orders SET picked_up_at=NOW(), updated_at=NOW() WHERE id=$1`,
      [id]
    );

    const cR = await pool.query('SELECT name FROM couriers WHERE id=$1', [req.courierId]);
    await pool.query(
      `INSERT INTO order_history (order_id, action, user_name, new_value)
       VALUES ($1, 'courier_picked_up_self', $2, 'picked up from shop')`,
      [id, cR.rows[0]?.name || ('Courier #' + req.courierId)]
    ).catch(()=>{});

    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/courier/orders/:id/sequence — تحديد ترتيب التوصيل
// body: {sequence: number}
app.post('/api/courier/orders/:id/sequence', courierAuth, async (req, res) => {
  const {id} = req.params;
  const {sequence} = req.body || {};
  
  if(typeof sequence !== 'number' || sequence < 0){
    return res.status(400).json({error: 'sequence لازم يكون رقم موجب'});
  }
  
  try{
    const chk = await pool.query('SELECT courier_id FROM orders WHERE id=$1', [id]);
    if(!chk.rows.length) return res.status(404).json({error: 'الطلب غير موجود'});
    if(String(chk.rows[0].courier_id) !== String(req.courierId)){
      return res.status(403).json({error: 'الطلب ده مش ليك'});
    }
    
    await pool.query(
      'UPDATE orders SET delivery_sequence=$1, updated_at=NOW() WHERE id=$2',
      [sequence || null, id]
    );
    
    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/courier/orders/auto-sequence — ترتيب تلقائي حسب المنطقة
app.post('/api/courier/orders/auto-sequence', courierAuth, async (req, res) => {
  try{
    // جيب كل طلبات المندوب اللي معاه
    const {rows} = await pool.query(
      `SELECT id, governorate, area, city 
       FROM orders 
       WHERE courier_id=$1 AND status='جاري التوصيل' AND picked_up_at IS NOT NULL
       ORDER BY governorate, area, city, id`,
      [req.courierId]
    );
    
    if(!rows.length) return res.json({success: true, count: 0});
    
    // رقّم الطلبات بالترتيب
    let seq = 1;
    for(const order of rows){
      await pool.query(
        'UPDATE orders SET delivery_sequence=$1 WHERE id=$2',
        [seq++, order.id]
      );
    }
    
    res.json({success: true, count: rows.length});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/courier/orders/:id/note — إضافة/تعديل ملاحظة المندوب
// body: {note: string}
app.post('/api/courier/orders/:id/note', courierAuth, async (req, res) => {
  const {id} = req.params;
  const {note} = req.body || {};
  try{
    const chk = await pool.query('SELECT courier_id FROM orders WHERE id=$1', [id]);
    if(!chk.rows.length) return res.status(404).json({error: 'الطلب غير موجود'});
    if(String(chk.rows[0].courier_id) !== String(req.courierId)){
      return res.status(403).json({error: 'الطلب ده مش ليك'});
    }

    await pool.query(
      `UPDATE orders SET courier_note=$2, updated_at=NOW() WHERE id=$1`,
      [id, note || '']
    );

    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/courier/orders/:id/zone — تعديل المنطقة المصنفة (assigned_zone)
// body: {zone: string}
app.post('/api/courier/orders/:id/zone', courierAuth, async (req, res) => {
  const {id} = req.params;
  const {zone} = req.body || {};
  if(!zone || !zone.trim()) return res.status(400).json({error: 'المنطقة مطلوبة'});

  try{
    const chk = await pool.query('SELECT courier_id, assigned_zone FROM orders WHERE id=$1', [id]);
    if(!chk.rows.length) return res.status(404).json({error: 'الطلب غير موجود'});
    const o = chk.rows[0];
    if(String(o.courier_id) !== String(req.courierId)){
      return res.status(403).json({error: 'الطلب ده مش ليك'});
    }

    const oldZone = o.assigned_zone || '';
    const newZone = zone.trim();

    await pool.query(
      `UPDATE orders SET assigned_zone=$2, zone_manually_set=true, updated_at=NOW() WHERE id=$1`,
      [id, newZone]
    );

    // log في order_history (عشان الأدمن يشوف التغيير)
    await pool.query(
      `INSERT INTO order_history (order_id, action, field, old_value, new_value, user_name)
       VALUES ($1, 'zone_changed_by_courier', 'assigned_zone', $2, $3, $4)`,
      [id, oldZone, newZone, 'Courier #' + req.courierId]
    ).catch(()=>{});

    res.json({success: true, zone: newZone});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/courier/orders/:id/request-payment-change
// طلب تحويل الطلب من COD لمدفوع (مع صورة دليل)
// body: {proofImageBase64: string, note: string}
app.post('/api/courier/orders/:id/request-payment-change', courierAuth, async (req, res) => {
  const {id} = req.params;
  const {proofImageBase64, note} = req.body || {};
  if(!proofImageBase64) return res.status(400).json({error: 'صورة الدليل مطلوبة'});
  // حد أقصى 5MB للـ base64
  if(proofImageBase64.length > 5 * 1024 * 1024 * 1.4){
    return res.status(400).json({error: 'الصورة كبيرة جداً (الحد الأقصى 5MB)'});
  }

  try{
    const chk = await pool.query('SELECT courier_id, paid, status FROM orders WHERE id=$1', [id]);
    if(!chk.rows.length) return res.status(404).json({error: 'الطلب غير موجود'});
    const o = chk.rows[0];
    if(String(o.courier_id) !== String(req.courierId)){
      return res.status(403).json({error: 'الطلب ده مش ليك'});
    }
    if(o.paid){
      return res.status(400).json({error: 'الطلب مدفوع بالفعل'});
    }

    // أنشئ طلب مراجعة
    await pool.query(
      `INSERT INTO pending_reviews (order_id, courier_id, type, data, status)
       VALUES ($1, $2, 'payment_change', $3, 'pending')`,
      [id, req.courierId, JSON.stringify({proofImageBase64, note: note || ''})]
    );

    // علّم الطلب
    await pool.query(
      `UPDATE orders SET payment_change_requested=true, updated_at=NOW() WHERE id=$1`,
      [id]
    );

    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/courier/adjustments — يضيف تسوية إضافية
// body: {amount: number, reason: string, proofImageBase64?: string}
app.post('/api/courier/adjustments', courierAuth, async (req, res) => {
  const {amount, reason, proofImageBase64} = req.body || {};
  if(amount === undefined || amount === null) return res.status(400).json({error: 'المبلغ مطلوب'});
  if(!reason || !reason.trim()) return res.status(400).json({error: 'السبب مطلوب'});

  try{
    const r = await pool.query(
      `INSERT INTO courier_adjustments (courier_id, amount, reason, proof_image_base64, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, created_at`,
      [req.courierId, parseFloat(amount), reason.trim(), proofImageBase64 || null]
    );
    res.json({success: true, id: r.rows[0].id, createdAt: r.rows[0].created_at});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// GET /api/courier/adjustments — قائمة تسويات المندوب الحالية (pending فقط)
app.get('/api/courier/adjustments', courierAuth, async (req, res) => {
  try{
    const r = await pool.query(
      `SELECT id, amount, reason, status, rejection_reason, created_at,
              CASE WHEN proof_image_base64 IS NOT NULL THEN true ELSE false END as has_proof
       FROM courier_adjustments
       WHERE courier_id=$1 AND settlement_id IS NULL
       ORDER BY created_at DESC`,
      [req.courierId]
    );
    res.json(r.rows.map(a => ({
      id: a.id,
      amount: parseFloat(a.amount),
      reason: a.reason,
      status: a.status,
      rejectionReason: a.rejection_reason,
      createdAt: a.created_at,
      hasProof: a.has_proof
    })));
  }catch(e){ res.status(500).json({error: e.message}); }
});

// DELETE /api/courier/adjustments/:id — حذف تسوية (لو لسه pending)
app.delete('/api/courier/adjustments/:id', courierAuth, async (req, res) => {
  try{
    const r = await pool.query(
      `DELETE FROM courier_adjustments
       WHERE id=$1 AND courier_id=$2 AND status='pending' AND settlement_id IS NULL
       RETURNING id`,
      [req.params.id, req.courierId]
    );
    if(!r.rows.length) return res.status(404).json({error: 'لا يمكن حذف هذه التسوية'});
    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// GET /api/courier/my-statement — كشف الحساب (الطلبات المسلمة + التسويات)
app.get('/api/courier/my-statement', courierAuth, async (req, res) => {
  try{
    // الطلبات تحت التسوية (اللي المندوب سلمها ولسه ما اتسوّتش)
    const ordersR = await pool.query(
      `SELECT id, name, total, ship, paid, courier_delivered_at, delivery_type
       FROM orders
       WHERE courier_id=$1
         AND status='تحت التسوية'
         AND (merged_into IS NULL OR merged_into = '')
       ORDER BY courier_delivered_at DESC`,
      [req.courierId]
    );

    const orders = ordersR.rows.map(o => ({
      id: o.id,
      name: o.name,
      total: parseFloat(o.total) || 0,
      ship: parseFloat(o.ship) || 0,
      paid: o.paid,
      deliveredAt: o.courier_delivered_at,
      deliveryType: o.delivery_type
    }));

    const totalCod = orders.filter(o => !o.paid).reduce((s, o) => s + o.total, 0);
    const totalShip = orders.reduce((s, o) => s + o.ship, 0);

    // التسويات الإضافية
    const adjR = await pool.query(
      `SELECT id, amount, reason, status, created_at
       FROM courier_adjustments
       WHERE courier_id=$1 AND settlement_id IS NULL
       ORDER BY created_at DESC`,
      [req.courierId]
    );
    const adjustments = adjR.rows.map(a => ({
      id: a.id,
      amount: parseFloat(a.amount),
      reason: a.reason,
      status: a.status,
      createdAt: a.created_at
    }));

    // احسب التسويات المعتمدة فقط
    const approvedAdjTotal = adjustments
      .filter(a => a.status === 'approved')
      .reduce((s, a) => s + a.amount, 0);

    // صافي الحساب: COD - الشحن + التسويات المعتمدة
    const net = totalCod - totalShip + approvedAdjTotal;

    res.json({
      orders,
      adjustments,
      summary: {
        orderCount: orders.length,
        totalCod,
        totalShip,
        approvedAdjTotal,
        netAmount: net
      }
    });
  }catch(e){ console.error('my-statement:', e); res.status(500).json({error: e.message}); }
});

// ====== ADMIN/ACCOUNTANT ENDPOINTS ======

// POST /api/orders/bulk-pickup — تسجيل استلام عدة طلبات من المحل دفعة واحدة
app.post('/api/orders/bulk-pickup', async (req, res) => {
  const { orderIds } = req.body;
  if (!Array.isArray(orderIds) || !orderIds.length) {
    return res.status(400).json({ error: 'orderIds مطلوبة' });
  }
  if (!DB_ENABLED) return res.json({ ok: true });
  
  try {
    await pool.query(
      `UPDATE orders 
       SET status = 'مكتمل', 
           picked_up_at = NOW(),
           updated_at = NOW()
       WHERE id = ANY($1::text[])`,
      [orderIds]
    );
    
    // سجّل في الـ history
    for (const id of orderIds) {
      await pool.query(
        `INSERT INTO order_history (order_id, action, user_name, new_value)
         VALUES ($1, 'bulk_pickup', 'shop_staff', 'picked up from shop')`,
        [id]
      ).catch(() => {});
    }
    
    res.json({ success: true, count: orderIds.length });
  } catch(e) {
    console.error('bulk-pickup error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/couriers/:id/mark-picked-up
// لما المحاسب يطبع ورقة توصيل، بنعلم الطلبات إنها اتسلمت للمندوب
// body: {orderIds: string[]}
app.post('/api/couriers/:id/mark-picked-up', async (req, res) => {
  const {orderIds} = req.body || {};
  if(!Array.isArray(orderIds) || !orderIds.length){
    return res.status(400).json({error: 'orderIds مطلوبة'});
  }
  try{
    await pool.query(
      `UPDATE orders SET picked_up_at=NOW(), updated_at=NOW()
       WHERE courier_id=$1 AND id = ANY($2::text[]) AND picked_up_at IS NULL`,
      [req.params.id, orderIds]
    );
    res.json({success: true, count: orderIds.length});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/couriers/:id/set-credentials — الأدمن يحدد username/password للمندوب
// body: {username, passHash}
app.post('/api/couriers/:id/set-credentials', async (req, res) => {
  const {username, passHash} = req.body || {};
  if(!username || !passHash) return res.status(400).json({error: 'username و password مطلوبين'});
  try{
    // تحقق إن الـ username مش مستخدم لمندوب آخر
    const conflict = await pool.query(
      'SELECT id FROM couriers WHERE username=$1 AND id != $2',
      [username, req.params.id]
    );
    if(conflict.rows.length){
      return res.status(400).json({error: 'اسم المستخدم مستخدم بالفعل لمندوب آخر'});
    }

    await pool.query(
      'UPDATE couriers SET username=$1, password_hash=$2 WHERE id=$3',
      [username, passHash, req.params.id]
    );
    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// GET /api/pending-reviews — المراجعات المعلقة (للمحاسب)
app.get('/api/pending-reviews', async (req, res) => {
  try{
    const r = await pool.query(
      `SELECT pr.id, pr.order_id, pr.courier_id, pr.type, pr.data, pr.status,
              pr.created_at, c.name as courier_name,
              o.name as customer_name, o.total, o.paid
       FROM pending_reviews pr
       LEFT JOIN couriers c ON c.id = pr.courier_id
       LEFT JOIN orders o ON o.id = pr.order_id
       WHERE pr.status='pending'
       ORDER BY pr.created_at ASC`
    );
    res.json(r.rows.map(row => ({
      id: row.id,
      orderId: row.order_id,
      courierId: row.courier_id,
      courierName: row.courier_name,
      customerName: row.customer_name,
      orderTotal: parseFloat(row.total) || 0,
      orderPaid: row.paid,
      type: row.type,
      data: row.data,
      status: row.status,
      createdAt: row.created_at
    })));
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/pending-reviews/:id/approve
app.post('/api/pending-reviews/:id/approve', async (req, res) => {
  const {reviewedBy} = req.body || {};
  try{
    const r = await pool.query(
      `SELECT * FROM pending_reviews WHERE id=$1 AND status='pending'`,
      [req.params.id]
    );
    if(!r.rows.length) return res.status(404).json({error: 'المراجعة غير موجودة أو تمت'});
    const pr = r.rows[0];

    // طبّق الإجراء بناءً على النوع
    if(pr.type === 'payment_change'){
      // حوّل الطلب لـ paid=true
      await pool.query(
        'UPDATE orders SET paid=true, payment_change_requested=false, updated_at=NOW() WHERE id=$1',
        [pr.order_id]
      );
    }

    await pool.query(
      `UPDATE pending_reviews SET status='approved', reviewed_by=$1, reviewed_at=NOW() WHERE id=$2`,
      [reviewedBy || null, req.params.id]
    );

    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/pending-reviews/:id/reject
app.post('/api/pending-reviews/:id/reject', async (req, res) => {
  const {reviewedBy, reason} = req.body || {};
  try{
    const r = await pool.query(
      `SELECT * FROM pending_reviews WHERE id=$1 AND status='pending'`,
      [req.params.id]
    );
    if(!r.rows.length) return res.status(404).json({error: 'المراجعة غير موجودة أو تمت'});
    const pr = r.rows[0];

    if(pr.type === 'payment_change'){
      await pool.query(
        'UPDATE orders SET payment_change_requested=false, updated_at=NOW() WHERE id=$1',
        [pr.order_id]
      );
    }

    await pool.query(
      `UPDATE pending_reviews SET status='rejected', reviewed_by=$1, reviewed_at=NOW(),
       rejection_reason=$2 WHERE id=$3`,
      [reviewedBy || null, reason || '', req.params.id]
    );

    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// GET /api/pending-reviews/:id/proof — جيب صورة الدليل
app.get('/api/pending-reviews/:id/proof', async (req, res) => {
  try{
    const r = await pool.query(
      'SELECT data FROM pending_reviews WHERE id=$1',
      [req.params.id]
    );
    if(!r.rows.length) return res.status(404).send('Not found');
    const data = r.rows[0].data || {};
    if(!data.proofImageBase64) return res.status(404).send('No proof');

    // الـ base64 يبدأ بـ data:image/... — ابعث HTML بسيط يعرض الصورة
    res.send(`<!DOCTYPE html><html><head><title>Proof</title><style>body{margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh}img{max-width:100%;max-height:100vh}</style></head><body><img src="${data.proofImageBase64}"></body></html>`);
  }catch(e){ res.status(500).send(e.message); }
});

// GET /api/courier-adjustments/pending — تسويات المناديب المعلقة (للمحاسب)
app.get('/api/courier-adjustments/pending', async (req, res) => {
  try{
    const r = await pool.query(
      `SELECT ca.id, ca.courier_id, ca.amount, ca.reason, ca.status, ca.created_at,
              CASE WHEN ca.proof_image_base64 IS NOT NULL THEN true ELSE false END as has_proof,
              c.name as courier_name
       FROM courier_adjustments ca
       LEFT JOIN couriers c ON c.id = ca.courier_id
       WHERE ca.status='pending' AND ca.settlement_id IS NULL
       ORDER BY ca.created_at ASC`
    );
    res.json(r.rows.map(a => ({
      id: a.id,
      courierId: a.courier_id,
      courierName: a.courier_name,
      amount: parseFloat(a.amount),
      reason: a.reason,
      status: a.status,
      hasProof: a.has_proof,
      createdAt: a.created_at
    })));
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/courier-adjustments/:id/approve
app.post('/api/courier-adjustments/:id/approve', async (req, res) => {
  const {reviewedBy} = req.body || {};
  try{
    await pool.query(
      `UPDATE courier_adjustments SET status='approved', reviewed_by=$1, reviewed_at=NOW()
       WHERE id=$2 AND status='pending'`,
      [reviewedBy || null, req.params.id]
    );
    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/courier-adjustments/:id/reject
app.post('/api/courier-adjustments/:id/reject', async (req, res) => {
  const {reviewedBy, reason} = req.body || {};
  try{
    await pool.query(
      `UPDATE courier_adjustments SET status='rejected', reviewed_by=$1, reviewed_at=NOW(),
       rejection_reason=$2 WHERE id=$3 AND status='pending'`,
      [reviewedBy || null, reason || '', req.params.id]
    );
    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// GET /api/courier-adjustments/:id/proof
app.get('/api/courier-adjustments/:id/proof', async (req, res) => {
  try{
    const r = await pool.query(
      'SELECT proof_image_base64 FROM courier_adjustments WHERE id=$1',
      [req.params.id]
    );
    if(!r.rows.length || !r.rows[0].proof_image_base64){
      return res.status(404).send('Not found');
    }
    res.send(`<!DOCTYPE html><html><head><title>Proof</title><style>body{margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh}img{max-width:100%;max-height:100vh}</style></head><body><img src="${r.rows[0].proof_image_base64}"></body></html>`);
  }catch(e){ res.status(500).send(e.message); }
});

// ============================================================
// ===== CAFELAX STARS — SHOP MODE (موظف المحل) =====
// ============================================================

function shopAuth(req, res, next){
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if(!token) return res.status(401).json({error: 'No token'});
  const session = _shopSessions.get(token);
  if(!session) return res.status(401).json({error: 'Invalid or expired token'});
  if(session.expires < Date.now()){
    _shopSessions.delete(token);
    return res.status(401).json({error: 'Session expired'});
  }
  req.shopUserId = session.shopUserId;
  req.shopUsername = session.username;
  next();
}

// POST /api/shop/login — login لموظفي المحل
app.post('/api/shop/login', async (req, res) => {
  if(!DB_ENABLED) return res.status(503).json({error: 'DB unavailable'});
  const {username, passHash} = req.body || {};
  if(!username || !passHash) return res.status(400).json({error: 'username و password مطلوبين'});
  try{
    const r = await pool.query(
      `SELECT id, username, display_name FROM shop_users
       WHERE username=$1 AND password_hash=$2 AND active=true`,
      [username, passHash]
    );
    if(!r.rows.length) return res.json({success: false, error: 'خطأ في اسم المستخدم أو كلمة المرور'});
    const u = r.rows[0];
    const token = _generateToken();
    const expires = Date.now() + 24 * 60 * 60 * 1000;
    _shopSessions.set(token, {shopUserId: u.id, username: u.username, expires});
    await pool.query('UPDATE shop_users SET last_login_at=NOW() WHERE id=$1', [u.id]).catch(()=>{});
    res.json({
      success: true,
      token,
      user: {
        id: u.id,
        username: u.username,
        displayName: u.display_name || u.username,
        role: 'shop'
      }
    });
  }catch(e){ res.status(500).json({error: e.message}); }
});

// GET /api/shop/me
app.get('/api/shop/me', shopAuth, async (req, res) => {
  try{
    const r = await pool.query(
      'SELECT id, username, display_name FROM shop_users WHERE id=$1',
      [req.shopUserId]
    );
    if(!r.rows.length) return res.status(404).json({error: 'User not found'});
    res.json({
      id: r.rows[0].id,
      username: r.rows[0].username,
      displayName: r.rows[0].display_name || r.rows[0].username,
      role: 'shop'
    });
  }catch(e){ res.status(500).json({error: e.message}); }
});

// Helper: map order for shop view
function _mapOrderForShop(r){
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    area: r.area,
    addr: r.addr,
    addr2: r.addr2,
    total: parseFloat(r.total) || 0,
    ship: parseFloat(r.ship) || 0,
    paid: r.paid,
    status: r.status,
    deliveryType: r.delivery_type,
    orderNote: r.order_note || '',
    customerNote: r.customer_note || '',
    shopNote: r.shop_note || '',
    items: r.items,
    pickupReadyAt: r.pickup_ready_at,
    pickedUpByCustomerAt: r.picked_up_by_customer_at,
    pickupNotPickedReason: r.pickup_not_picked_reason,
    paymentChangeRequested: r.payment_change_requested || false,
    transferRequestedAt: r.transfer_requested_at,
    createdAt: r.created_at,
    // إلغاء (field cancellation)
    cancelledByField: r.cancelled_by_field || false,
    cancelledAt: r.cancelled_at,
    cancellationReason: r.cancellation_reason,
    cancellationReceivedAt: r.cancellation_received_at,
    src: r.src,
    shopifyId: r.shopify_id,
  };
}

// GET /api/shop/my-orders — طلبات الاستلام من المحل
app.get('/api/shop/my-orders', shopAuth, async (req, res) => {
  try{
    const r = await pool.query(
      `SELECT * FROM orders
       WHERE delivery_type='pickup'
         AND (merged_into IS NULL OR merged_into = '')
         AND (transfer_requested_at IS NULL)
         AND (cancelled_by_field IS NOT TRUE)
         AND status IN ('جديد', 'جاري التوصيل', 'تحت التسوية')
       ORDER BY created_at ASC`
    );
    const todayR = await pool.query(
      `SELECT * FROM orders
       WHERE delivery_type='pickup'
         AND status IN ('مكتمل', 'ملغي')
         AND updated_at::date = CURRENT_DATE
       ORDER BY updated_at DESC`
    );

    const waiting = [];
    const completed = [];

    r.rows.forEach(o => waiting.push(_mapOrderForShop(o)));
    todayR.rows.forEach(o => completed.push(_mapOrderForShop(o)));

    // ✨ الإلغاءات بانتظار استلام الإدارة
    const cancelledR = await pool.query(
      `SELECT * FROM orders
       WHERE delivery_type='pickup'
         AND cancelled_by_field=true
         AND cancellation_received_at IS NULL
       ORDER BY cancelled_at DESC`
    );
    const cancelled = cancelledR.rows.map(o => _mapOrderForShop(o));

    res.json({waiting, completed, cancelled});
  }catch(e){ console.error('shop my-orders:', e); res.status(500).json({error: e.message}); }
});

// POST /api/shop/orders/:id/picked-up — العميل استلم الطلب
// body: {collectedCash: boolean}
app.post('/api/shop/orders/:id/picked-up', shopAuth, async (req, res) => {
  const {id} = req.params;
  try{
    const chk = await pool.query('SELECT delivery_type, status, paid FROM orders WHERE id=$1', [id]);
    if(!chk.rows.length) return res.status(404).json({error: 'الطلب غير موجود'});
    const o = chk.rows[0];
    if(o.delivery_type !== 'pickup'){
      return res.status(400).json({error: 'هذا الطلب ليس pickup'});
    }
    if(o.status === 'مكتمل' || o.status === 'ملغي'){
      return res.status(400).json({error: 'الطلب تم التعامل معه بالفعل'});
    }

    // status = 'تحت التسوية' (مثل المندوب بالظبط)
    await pool.query(
      `UPDATE orders SET
        status='تحت التسوية',
        picked_up_by_customer_at=NOW(),
        updated_at=NOW()
       WHERE id=$1`,
      [id]
    );

    await pool.query(
      `INSERT INTO order_history (order_id, action, user_name, new_value)
       VALUES ($1, 'shop_picked_up', $2, 'picked_up')`,
      [id, 'Shop: ' + req.shopUsername]
    ).catch(()=>{});

    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/shop/orders/:id/not-picked — العميل لم يحضر
app.post('/api/shop/orders/:id/not-picked', shopAuth, async (req, res) => {
  const {id} = req.params;
  const {reason} = req.body || {};
  if(!reason) return res.status(400).json({error: 'السبب مطلوب'});
  try{
    const chk = await pool.query('SELECT delivery_type FROM orders WHERE id=$1', [id]);
    if(!chk.rows.length) return res.status(404).json({error: 'الطلب غير موجود'});
    if(chk.rows[0].delivery_type !== 'pickup'){
      return res.status(400).json({error: 'هذا الطلب ليس pickup'});
    }

    await pool.query(
      `UPDATE orders SET
        pickup_not_picked_reason=$2,
        updated_at=NOW()
       WHERE id=$1`,
      [id, reason]
    );

    await pool.query(
      `INSERT INTO order_history (order_id, action, user_name, new_value)
       VALUES ($1, 'shop_not_picked', $2, $3)`,
      [id, 'Shop: ' + req.shopUsername, reason]
    ).catch(()=>{});

    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/shop/orders/:id/note — ملاحظة الموظف
app.post('/api/shop/orders/:id/note', shopAuth, async (req, res) => {
  const {id} = req.params;
  const {note} = req.body || {};
  try{
    await pool.query(
      `UPDATE orders SET shop_note=$2, updated_at=NOW() WHERE id=$1 AND delivery_type='pickup'`,
      [id, note || '']
    );
    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/shop/orders/:id/request-payment-change — تحويل لمدفوع مع صورة
app.post('/api/shop/orders/:id/request-payment-change', shopAuth, async (req, res) => {
  const {id} = req.params;
  const {proofImageBase64, note} = req.body || {};
  if(!proofImageBase64) return res.status(400).json({error: 'صورة الدليل مطلوبة'});
  if(proofImageBase64.length > 5 * 1024 * 1024 * 1.4){
    return res.status(400).json({error: 'الصورة كبيرة جداً'});
  }
  try{
    const chk = await pool.query('SELECT delivery_type, paid FROM orders WHERE id=$1', [id]);
    if(!chk.rows.length) return res.status(404).json({error: 'الطلب غير موجود'});
    if(chk.rows[0].delivery_type !== 'pickup'){
      return res.status(400).json({error: 'هذا الطلب ليس pickup'});
    }
    if(chk.rows[0].paid) return res.status(400).json({error: 'الطلب مدفوع بالفعل'});

    // نحطها في نفس جدول pending_reviews (نوع: payment_change)
    // بس مع courier_id = NULL ونحط shop_user_id في الـ data
    await pool.query(
      `INSERT INTO pending_reviews (order_id, courier_id, type, data, status)
       VALUES ($1, NULL, 'payment_change', $2, 'pending')`,
      [id, JSON.stringify({
        proofImageBase64,
        note: note || '',
        source: 'shop',
        shopUsername: req.shopUsername
      })]
    );

    await pool.query(
      `UPDATE orders SET payment_change_requested=true, updated_at=NOW() WHERE id=$1`,
      [id]
    );

    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/shop/orders/:id/cancel — إلغاء الطلب (العميل رفض الاستلام)
// body: {reason: string}
app.post('/api/shop/orders/:id/cancel', shopAuth, async (req, res) => {
  const {id} = req.params;
  const {reason} = req.body || {};
  if(!reason || !reason.trim()) return res.status(400).json({error: 'السبب مطلوب'});

  try{
    const chk = await pool.query(
      `SELECT delivery_type, status, cancelled_by_field FROM orders WHERE id=$1`,
      [id]
    );
    if(!chk.rows.length) return res.status(404).json({error: 'الطلب غير موجود'});
    const o = chk.rows[0];
    if(o.delivery_type !== 'pickup'){
      return res.status(400).json({error: 'هذا الطلب ليس pickup'});
    }
    if(o.status === 'مكتمل'){
      return res.status(400).json({error: 'الطلب مكتمل بالفعل'});
    }
    if(o.cancelled_by_field){
      return res.status(400).json({error: 'الطلب ملغي بالفعل'});
    }

    await pool.query(
      `UPDATE orders SET
        cancelled_by_field=true,
        cancelled_by_username=$2,
        cancelled_by_source='shop',
        cancelled_at=NOW(),
        cancellation_reason=$3,
        updated_at=NOW()
       WHERE id=$1`,
      [id, req.shopUsername, reason.trim()]
    );

    await pool.query(
      `INSERT INTO order_history (order_id, action, user_name, new_value)
       VALUES ($1, 'shop_cancelled', $2, $3)`,
      [id, 'Shop: ' + req.shopUsername, reason.trim()]
    ).catch(()=>{});

    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/shop/orders/:id/uncancel — إرجاع الطلب الملغي
app.post('/api/shop/orders/:id/uncancel', shopAuth, async (req, res) => {
  const {id} = req.params;
  try{
    const chk = await pool.query(
      `SELECT delivery_type, cancelled_by_field, cancellation_received_at, cancelled_by_source
       FROM orders WHERE id=$1`,
      [id]
    );
    if(!chk.rows.length) return res.status(404).json({error: 'الطلب غير موجود'});
    const o = chk.rows[0];
    if(o.delivery_type !== 'pickup'){
      return res.status(400).json({error: 'هذا الطلب ليس pickup'});
    }
    if(!o.cancelled_by_field){
      return res.status(400).json({error: 'الطلب ليس ملغي'});
    }
    if(o.cancellation_received_at){
      return res.status(400).json({error: 'الإدارة أكدت الاستلام بالفعل'});
    }
    if(o.cancelled_by_source !== 'shop'){
      return res.status(403).json({error: 'الإلغاء تم من المندوب'});
    }

    await pool.query(
      `UPDATE orders SET
        cancelled_by_field=false,
        cancelled_by_username=NULL,
        cancelled_by_source=NULL,
        cancelled_at=NULL,
        cancellation_reason=NULL,
        updated_at=NOW()
       WHERE id=$1`,
      [id]
    );

    await pool.query(
      `INSERT INTO order_history (order_id, action, user_name, new_value)
       VALUES ($1, 'shop_uncancelled', $2, 'reverted')`,
      [id, 'Shop: ' + req.shopUsername]
    ).catch(()=>{});

    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/shop/orders/:id/transfer-to-shipping — تحويل pickup لشحن
app.post('/api/shop/orders/:id/transfer-to-shipping', shopAuth, async (req, res) => {
  const {id} = req.params;
  try{
    const chk = await pool.query('SELECT delivery_type, transfer_requested_at, status FROM orders WHERE id=$1', [id]);
    if(!chk.rows.length) return res.status(404).json({error: 'الطلب غير موجود'});
    const o = chk.rows[0];
    if(o.delivery_type !== 'pickup'){
      return res.status(400).json({error: 'هذا الطلب ليس pickup'});
    }
    if(o.transfer_requested_at){
      return res.status(400).json({error: 'تم إرسال التحويل من قبل'});
    }
    if(o.status === 'مكتمل' || o.status === 'ملغي'){
      return res.status(400).json({error: 'الطلب تم التعامل معه'});
    }

    // علّم الطلب + أنشئ سجل تحويل
    await pool.query(
      `UPDATE orders SET transfer_requested_at=NOW(), updated_at=NOW() WHERE id=$1`,
      [id]
    );

    await pool.query(
      `INSERT INTO shipping_transfers (order_id, transferred_by_shop_user_id, transferred_by_username, status)
       VALUES ($1, $2, $3, 'pending')`,
      [id, req.shopUserId, req.shopUsername]
    );

    await pool.query(
      `INSERT INTO order_history (order_id, action, user_name, new_value)
       VALUES ($1, 'transfer_to_shipping', $2, 'pending')`,
      [id, 'Shop: ' + req.shopUsername]
    ).catch(()=>{});

    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// ===== ADMIN: shipping transfers management =====

// GET /api/shipping-transfers — قائمة التحويلات (filter by status)
app.get('/api/shipping-transfers', async (req, res) => {
  const status = req.query.status || 'pending';
  try{
    const r = await pool.query(
      `SELECT st.id, st.order_id, st.transferred_by_username, st.status,
              st.shipping_cost, st.assigned_to, st.accepted_by, st.accepted_at,
              st.created_at,
              o.name, o.phone, o.area, o.addr, o.addr2, o.total, o.paid,
              o.customer_note, o.order_note, o.shop_note, o.delivery_type
       FROM shipping_transfers st
       LEFT JOIN orders o ON o.id = st.order_id
       WHERE st.status = $1
       ORDER BY st.created_at ASC`,
      [status]
    );
    res.json(r.rows.map(row => ({
      id: row.id,
      orderId: row.order_id,
      transferredByUsername: row.transferred_by_username,
      status: row.status,
      shippingCost: row.shipping_cost != null ? parseFloat(row.shipping_cost) : null,
      assignedTo: row.assigned_to,
      acceptedBy: row.accepted_by,
      acceptedAt: row.accepted_at,
      createdAt: row.created_at,
      order: {
        id: row.order_id,
        name: row.name,
        phone: row.phone,
        area: row.area,
        addr: row.addr,
        addr2: row.addr2,
        total: parseFloat(row.total) || 0,
        paid: row.paid,
        customerNote: row.customer_note,
        orderNote: row.order_note,
        shopNote: row.shop_note,
        deliveryType: row.delivery_type
      }
    })));
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/shipping-transfers/:id/accept-and-assign
// body: {shippingCost, target: 'bosta' | 'courier:<id>', acceptedBy}
app.post('/api/shipping-transfers/:id/accept-and-assign', async (req, res) => {
  const {shippingCost, target, acceptedBy} = req.body || {};
  if(shippingCost == null || isNaN(parseFloat(shippingCost))){
    return res.status(400).json({error: 'سعر الشحن مطلوب'});
  }
  if(!target) return res.status(400).json({error: 'الوجهة مطلوبة (bosta أو courier)'});

  try{
    const trR = await pool.query(
      `SELECT * FROM shipping_transfers WHERE id=$1 AND status='pending'`,
      [req.params.id]
    );
    if(!trR.rows.length) return res.status(404).json({error: 'التحويل غير موجود أو تم معالجته'});
    const tr = trR.rows[0];

    // حدد الوجهة
    let isBosta = false;
    let courierId = null;
    let assignedLabel = '';

    if(target === 'bosta'){
      isBosta = true;
      assignedLabel = 'Bosta';
    } else if(target.startsWith('courier:')){
      courierId = parseInt(target.split(':')[1]);
      if(isNaN(courierId)) return res.status(400).json({error: 'courier id غير صحيح'});
      const cR = await pool.query('SELECT name FROM couriers WHERE id=$1', [courierId]);
      if(!cR.rows.length) return res.status(404).json({error: 'المندوب غير موجود'});
      assignedLabel = cR.rows[0].name;
    } else {
      return res.status(400).json({error: 'الوجهة غير صحيحة'});
    }

    const cost = parseFloat(shippingCost);

    // حدّث الطلب: غيّر delivery_type لـ 'normal' + عيّن الشحن + عيّن المندوب/Bosta
    const updates = [
      `delivery_type='normal'`,
      `ship=$2`,
      `status='جاري التوصيل'`,
      `updated_at=NOW()`,
    ];
    const params = [tr.order_id, cost];
    if(isBosta){
      updates.push(`is_bosta=true`, `courier_id=NULL`);
    } else {
      updates.push(`is_bosta=false`, `courier_id=$3`);
      params.push(courierId);
    }
    await pool.query(
      `UPDATE orders SET ${updates.join(', ')} WHERE id=$1`,
      params
    );

    // حدّث سجل التحويل
    await pool.query(
      `UPDATE shipping_transfers SET
        status='accepted',
        shipping_cost=$2,
        assigned_to=$3,
        accepted_by=$4,
        accepted_at=NOW()
       WHERE id=$1`,
      [req.params.id, cost, assignedLabel, acceptedBy || null]
    );

    // log في history
    await pool.query(
      `INSERT INTO order_history (order_id, action, user_name, new_value)
       VALUES ($1, 'transfer_accepted_and_assigned', $2, $3)`,
      [tr.order_id, acceptedBy || 'admin', `${assignedLabel} — shipping: ${cost}`]
    ).catch(()=>{});

    res.json({
      success: true,
      orderId: tr.order_id,
      assignedTo: assignedLabel,
      shippingCost: cost,
      isBosta
    });
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/shipping-transfers/:id/reject — رفض التحويل (الطلب يرجع pickup عادي)
app.post('/api/shipping-transfers/:id/reject', async (req, res) => {
  const {reason, rejectedBy} = req.body || {};
  try{
    const trR = await pool.query(
      `SELECT order_id FROM shipping_transfers WHERE id=$1 AND status='pending'`,
      [req.params.id]
    );
    if(!trR.rows.length) return res.status(404).json({error: 'التحويل غير موجود'});

    // ارجع الطلب لحالته كـ pickup
    await pool.query(
      `UPDATE orders SET transfer_requested_at=NULL, updated_at=NOW() WHERE id=$1`,
      [trR.rows[0].order_id]
    );

    await pool.query(
      `UPDATE shipping_transfers SET status='rejected', accepted_by=$2, accepted_at=NOW() WHERE id=$1`,
      [req.params.id, rejectedBy || null]
    );

    await pool.query(
      `INSERT INTO order_history (order_id, action, user_name, new_value)
       VALUES ($1, 'transfer_rejected', $2, $3)`,
      [trR.rows[0].order_id, rejectedBy || 'admin', reason || 'rejected']
    ).catch(()=>{});

    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/shop-users — admin creates shop user
app.post('/api/shop-users', async (req, res) => {
  const {username, passHash, displayName} = req.body || {};
  if(!username || !passHash) return res.status(400).json({error: 'username و password مطلوبين'});
  try{
    const r = await pool.query(
      `INSERT INTO shop_users (username, password_hash, display_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (username) DO UPDATE SET password_hash=$2, display_name=$3
       RETURNING id, username, display_name`,
      [username, passHash, displayName || username]
    );
    res.json({success: true, user: r.rows[0]});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// GET /api/shop-users — list
app.get('/api/shop-users', async (req, res) => {
  try{
    const r = await pool.query(
      'SELECT id, username, display_name, active, last_login_at, created_at FROM shop_users ORDER BY created_at DESC'
    );
    res.json(r.rows);
  }catch(e){ res.status(500).json({error: e.message}); }
});

// ===== Field Cancellations (إلغاءات بانتظار استلام الإدارة) =====

// GET /api/field-cancellations — list all pending cancellations
app.get('/api/field-cancellations', async (req, res) => {
  try{
    const r = await pool.query(
      `SELECT o.id, o.name, o.phone, o.area, o.addr, o.addr2, o.total, o.paid,
              o.delivery_type, o.cancelled_by_username, o.cancelled_by_source,
              o.cancelled_at, o.cancellation_reason, o.courier_id,
              c.name as courier_name
       FROM orders o
       LEFT JOIN couriers c ON c.id = o.courier_id
       WHERE o.cancelled_by_field=true
         AND o.cancellation_received_at IS NULL
       ORDER BY o.cancelled_at ASC`
    );
    res.json(r.rows.map(row => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      area: row.area,
      addr: row.addr,
      addr2: row.addr2,
      total: parseFloat(row.total) || 0,
      paid: row.paid,
      deliveryType: row.delivery_type,
      cancelledByUsername: row.cancelled_by_username,
      cancelledBySource: row.cancelled_by_source,
      cancelledAt: row.cancelled_at,
      cancellationReason: row.cancellation_reason,
      courierId: row.courier_id,
      courierName: row.courier_name,
    })));
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/field-cancellations/:orderId/confirm-receive
// الإدارة أكدت إنها استلمت الطلب من المندوب/المحل
// body: {receivedBy: string}
app.post('/api/field-cancellations/:orderId/confirm-receive', async (req, res) => {
  const {orderId} = req.params;
  const {receivedBy} = req.body || {};
  try{
    const chk = await pool.query(
      `SELECT cancelled_by_field, cancellation_received_at FROM orders WHERE id=$1`,
      [orderId]
    );
    if(!chk.rows.length) return res.status(404).json({error: 'الطلب غير موجود'});
    const o = chk.rows[0];
    if(!o.cancelled_by_field){
      return res.status(400).json({error: 'الطلب ليس ملغي'});
    }
    if(o.cancellation_received_at){
      return res.status(400).json({error: 'تم تأكيد الاستلام من قبل'});
    }

    await pool.query(
      `UPDATE orders SET
        cancellation_received_at=NOW(),
        cancellation_received_by=$2,
        status='ملغي',
        updated_at=NOW()
       WHERE id=$1`,
      [orderId, receivedBy || null]
    );

    await pool.query(
      `INSERT INTO order_history (order_id, action, user_name, new_value)
       VALUES ($1, 'cancellation_received', $2, 'admin confirmed')`,
      [orderId, receivedBy || 'admin']
    ).catch(()=>{});

    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/field-cancellations/:orderId/revert
// الإدارة قررت ترجع الطلب (الإلغاء كان بالغلط)
app.post('/api/field-cancellations/:orderId/revert', async (req, res) => {
  const {orderId} = req.params;
  const {revertedBy} = req.body || {};
  try{
    const chk = await pool.query(
      `SELECT cancelled_by_field, cancellation_received_at FROM orders WHERE id=$1`,
      [orderId]
    );
    if(!chk.rows.length) return res.status(404).json({error: 'الطلب غير موجود'});
    if(!chk.rows[0].cancelled_by_field){
      return res.status(400).json({error: 'الطلب ليس ملغي'});
    }
    if(chk.rows[0].cancellation_received_at){
      return res.status(400).json({error: 'تم تأكيد الاستلام بالفعل'});
    }

    await pool.query(
      `UPDATE orders SET
        cancelled_by_field=false,
        cancelled_by_username=NULL,
        cancelled_by_source=NULL,
        cancelled_at=NULL,
        cancellation_reason=NULL,
        updated_at=NOW()
       WHERE id=$1`,
      [orderId]
    );

    await pool.query(
      `INSERT INTO order_history (order_id, action, user_name, new_value)
       VALUES ($1, 'cancellation_reverted_by_admin', $2, 'reverted')`,
      [orderId, revertedBy || 'admin']
    ).catch(()=>{});

    res.json({success: true});
  }catch(e){ res.status(500).json({error: e.message}); }
});

// ============================================================
// ===== END: CAFELAX STARS ENDPOINTS =====
// ============================================================

// Server startup
if (DB_ENABLED) {
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

// ===== BARCODE VERIFICATION SYSTEM =====

app.post('/api/preparation/start', async (req, res) => {
  if (!DB_ENABLED) return res.json({ ok: true });
  const { orderId, preparerId } = req.body;
  if (!orderId || !preparerId) return res.status(400).json({ error: 'orderId and preparerId required' });
  try {
    await pool.query('UPDATE orders SET preparation_started_by=$1, preparation_started_at=NOW(), preparation_status=$2, updated_at=NOW() WHERE id=$3', [preparerId, 'in_progress', orderId]);
    await pool.query('INSERT INTO order_history (order_id, action, user_name, new_value) VALUES ($1, $2, $3, $4)', [orderId, 'preparation_started', 'Preparer #' + preparerId, 'in_progress']).catch(() => {});
    console.log('Preparation started for order:', orderId, 'by preparer:', preparerId);
    res.json({ ok: true });
  } catch (e) {
    console.error('Preparation start error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/preparation/scan', async (req, res) => {
  if (!DB_ENABLED) return res.json({ ok: true, matched: true });
  const { orderId, barcode, preparerId } = req.body;
  if (!orderId || !barcode) return res.status(400).json({ error: 'orderId and barcode required' });
  try {
    const orderRes = await pool.query('SELECT id, items, scanned_items FROM orders WHERE id=$1', [orderId]);
    if (!orderRes.rows.length) return res.status(404).json({ error: 'Order not found' });
    const order = orderRes.rows[0];
    const items = order.items ? JSON.parse(order.items) : [];
    const scannedItems = order.scanned_items ? JSON.parse(order.scanned_items) : {};
    let matched = false;
    let matchedItem = null;
    for (const item of items) {
      if (!item.barcode) continue;
      const barcodes = item.barcode.split(',').map(b => b.trim());
      if (barcodes.includes(barcode)) {
        matched = true;
        matchedItem = item;
        const itemKey = item.sku || item.name;
        scannedItems[itemKey] = (scannedItems[itemKey] || 0) + 1;
        break;
      }
    }
    if (!matched) {
      console.log('Barcode not found:', barcode, 'in order:', orderId);
      return res.json({ ok: true, matched: false, error: 'الباركود غير موجود في الطلب' });
    }
    await pool.query('UPDATE orders SET scanned_items=$1, updated_at=NOW() WHERE id=$2', [JSON.stringify(scannedItems), orderId]);
    await pool.query('INSERT INTO order_history (order_id, action, user_name, new_value) VALUES ($1, $2, $3, $4)', [orderId, 'barcode_scanned', 'Preparer #' + preparerId, barcode]).catch(() => {});
    console.log('Barcode scanned:', barcode, 'for order:', orderId);
    res.json({ ok: true, matched: true, item: matchedItem, scannedItems });
  } catch (e) {
    console.error('Scan error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/preparation/complete', async (req, res) => {
  if (!DB_ENABLED) return res.json({ ok: true });
  const { orderId, preparerId, preparerName } = req.body;
  if (!orderId || !preparerId) return res.status(400).json({ error: 'orderId and preparerId required' });
  try {
    const orderRes = await pool.query('SELECT id, items, scanned_items, shopify_id FROM orders WHERE id=$1', [orderId]);
    if (!orderRes.rows.length) return res.status(404).json({ error: 'Order not found' });
    const order = orderRes.rows[0];
    const items = order.items ? JSON.parse(order.items) : [];
    const scannedItems = order.scanned_items ? JSON.parse(order.scanned_items) : {};
    let allScanned = true;
    const missing = [];
    for (const item of items) {
      const itemKey = item.sku || item.name;
      const scannedQty = scannedItems[itemKey] || 0;
      const requiredQty = item.quantity || 1;
      if (scannedQty < requiredQty) {
        allScanned = false;
        missing.push({ name: item.name, required: requiredQty, scanned: scannedQty, missing: requiredQty - scannedQty });
      }
    }
    if (!allScanned) {
      console.log('Order incomplete:', orderId, 'missing:', missing);
      return res.status(400).json({ error: 'الطلب غير مكتمل', missing });
    }
    await pool.query('UPDATE orders SET preparation_status=$1, preparation_completed_at=NOW(), preparation_completed_by=$2, updated_at=NOW() WHERE id=$3', ['completed', preparerId, orderId]);
    await pool.query('INSERT INTO order_history (order_id, action, user_name, new_value) VALUES ($1, $2, $3, $4)', [orderId, 'preparation_completed', 'Preparer: ' + (preparerName || preparerId), 'completed']).catch(() => {});

    // ===== Shopify tag: prepared_by_<name> =====
    let tagResult = null;
    if (order.shopify_id && preparerName) {
      try {
        const creds = await getShopifyCredentials();
        if (creds.shopUrl && creds.accessToken) {
          const host = creds.shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
          const tag = 'prepared_by_' + String(preparerName).trim().replace(/\s+/g, '_');
          const getR = await shopifyRequest(host, creds.accessToken, `/admin/api/2024-10/orders/${order.shopify_id}.json?fields=id,tags`);
          if (getR.status === 200 && getR.data.order) {
            const currentTags = (getR.data.order.tags || '').split(',').map(t => t.trim()).filter(t => t);
            if (!currentTags.includes(tag)) {
              const newTags = [...currentTags, tag].join(', ');
              const putR = await shopifyRequest(host, creds.accessToken,
                `/admin/api/2024-10/orders/${order.shopify_id}.json`, 'PUT',
                { order: { id: order.shopify_id, tags: newTags } });
              tagResult = putR.status === 200 ? 'added' : 'failed_' + putR.status;
            } else {
              tagResult = 'already_exists';
            }
          }
        }
      } catch (e) {
        console.error('Shopify tag error:', e.message);
        tagResult = 'error';
      }
    }

    console.log('Preparation completed for order:', orderId, 'by:', preparerName || preparerId, 'tag:', tagResult);
    res.json({ ok: true, shopifyTag: tagResult });
  } catch (e) {
    console.error('Complete preparation error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/preparation/orders', async (req, res) => {
  if (!DB_ENABLED) return res.json({ orders: [] });
  const { preparerId } = req.query;
  try {
    // SELECT أعمدة معينة بس (ليس *) عشان نتجنب bosta_awb_base64 الضخم
    // وفلترة أدق: الطلبات اللي محتاجة تحضير فقط (مش completed)، ومش ملغية
    const result = await pool.query(`
      SELECT o.id, o.shopify_id, o.name, o.phone, o.area, o.addr, o.total, o.paid,
             o.items, o.scanned_items, o.status, o.created_at,
             o.preparation_status, o.preparation_started_by, o.preparation_started_at
      FROM orders o
      WHERE (o.preparation_status IS NULL OR o.preparation_status = 'in_progress')
        AND o.status NOT IN ('ملغي', 'مسوّى')
        AND (o.preparation_started_by IS NULL OR o.preparation_started_by = $1)
      ORDER BY o.created_at DESC
      LIMIT 50
    `, [preparerId]);
    const orders = result.rows.map(row => ({
      id: row.id,
      shopifyId: row.shopify_id,
      name: row.name,
      phone: row.phone,
      area: row.area,
      addr: row.addr,
      total: parseFloat(row.total) || 0,
      paid: row.paid || false,
      items: row.items,
      scannedItems: row.scanned_items,
      status: row.status,
      preparationStatus: row.preparation_status,
      preparationStartedBy: row.preparation_started_by,
      preparationStartedAt: row.preparation_started_at,
      createdAt: row.created_at
    }));
    res.json({ orders });
  } catch (e) {
    console.error('Get preparation orders error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ===== STATE VALIDATION SYSTEM =====

const STATE_MACHINE = {
  'جديد': ['تم التعيين', 'جاري التوصيل', 'ملغي'],
  'تم التعيين': ['جاري التوصيل', 'جديد', 'ملغي'],
  'جاري التوصيل': ['تم التسليم', 'تحت التسوية', 'مرتجع', 'تم التعيين', 'ملغي'],
  'تم التسليم': ['تحت التسوية', 'مرتجع'],
  'مرتجع': ['تحت التسوية', 'جديد', 'جاري التوصيل'],
  'تحت التسوية': ['مسوّى', 'تم التسليم', 'جاري التوصيل', 'ملغي'],
  'مسوّى': [],
  'ملغي': ['جديد']
};

function validateStateTransition(currentStatus, newStatus) {
  if (currentStatus === newStatus) return { valid: true };
  const allowed = STATE_MACHINE[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    return {
      valid: false,
      error: 'لا يمكن تغيير الحالة من "' + currentStatus + '" إلى "' + newStatus + '"'
    };
  }
  return { valid: true };
}

function canSettle(order) {
  if (!order) return { valid: false, error: 'الطلب غير موجود' };
  const validStatuses = ['تم التسليم', 'مرتجع'];
  if (!validStatuses.includes(order.status)) {
    return {
      valid: false,
      error: 'لا يمكن تسوية طلب بحالة "' + order.status + '". يجب أن يكون "تم التسليم" أو "مرتجع"'
    };
  }
  if (!order.courier_id) {
    return { valid: false, error: 'الطلب غير معيّن لمندوب' };
  }
  if (order.courier_delivered_at && order.status === 'تم التسليم') {
    return { valid: true };
  }
  if (order.courier_returned_at && order.status === 'مرتجع') {
    return { valid: true };
  }
  return { valid: false, error: 'بيانات التسليم غير مكتملة' };
}

app.get('/api/orders/:id/state-info', async (req, res) => {
  if (!DB_ENABLED) return res.json({ error: 'Database not enabled' });
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT id, status, courier_id, courier_delivered_at, courier_returned_at FROM orders WHERE id = $1', [id]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = result.rows[0];
    const allowedTransitions = STATE_MACHINE[order.status] || [];
    const canSettleResult = canSettle(order);
    res.json({
      orderId: id,
      currentStatus: order.status,
      allowedTransitions,
      canSettle: canSettleResult.valid,
      settleError: canSettleResult.error,
      courierId: order.courier_id,
      deliveredAt: order.courier_delivered_at,
      returnedAt: order.courier_returned_at
    });
  } catch (e) {
    console.error('State info error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/orders/:id/fix-state', async (req, res) => {
  if (!DB_ENABLED) return res.json({ ok: true });
  try {
    const { id } = req.params;
    const { newStatus, adminName, reason } = req.body;
    if (!newStatus || !adminName || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = result.rows[0];
    await pool.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [newStatus, id]);
    await pool.query('INSERT INTO order_history (order_id, action, user_name, old_value, new_value, notes) VALUES ($1, $2, $3, $4, $5, $6)', [id, 'admin_state_override', adminName, order.status, newStatus, reason]).catch(() => {});
    console.log('Admin override: Order', id, order.status, '->', newStatus, 'by', adminName, ':', reason);
    res.json({ ok: true });
  } catch (e) {
    console.error('Fix state error:', e);
    res.status(500).json({ error: e.message });
  }
});

});
