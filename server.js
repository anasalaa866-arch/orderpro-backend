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

      CREATE TABLE IF NOT EXISTS vendors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        phone TEXT,
        note TEXT,
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

      // 🆕 v101: جدول طلبات تحويل الشحن (المندوب يطلب تحويل لمندوب تاني/بوسطة)
      `CREATE TABLE IF NOT EXISTS shipping_transfer_requests (
        id SERIAL PRIMARY KEY,
        order_id TEXT NOT NULL,
        from_courier_id INTEGER NOT NULL,
        target_type TEXT NOT NULL,
        target_courier_id INTEGER,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        reviewed_by TEXT,
        reviewed_at TIMESTAMPTZ,
        rejection_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      "CREATE INDEX IF NOT EXISTS idx_str_status ON shipping_transfer_requests(status)",
      "CREATE INDEX IF NOT EXISTS idx_str_order ON shipping_transfer_requests(order_id)",

      // 🆕 v106: cache لتقييم مخاطر العملاء من Shopify
      `CREATE TABLE IF NOT EXISTS customer_risk_cache (
        phone TEXT PRIMARY KEY,
        shopify_customer_id TEXT,
        customer_name TEXT,
        total_orders INTEGER DEFAULT 0,
        cancelled_orders INTEGER DEFAULT 0,
        refunded_orders INTEGER DEFAULT 0,
        successful_orders INTEGER DEFAULT 0,
        total_spent NUMERIC DEFAULT 0,
        risk_percentage NUMERIC DEFAULT 0,
        last_order_at TIMESTAMPTZ,
        first_order_at TIMESTAMPTZ,
        tags TEXT,
        notes TEXT,
        cached_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      "CREATE INDEX IF NOT EXISTS idx_crc_risk ON customer_risk_cache(risk_percentage DESC)",
      "CREATE INDEX IF NOT EXISTS idx_crc_cached ON customer_risk_cache(cached_at)",

      // 🆕 v106: إعدادات تقييم المخاطر (key/value)
      `CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,

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
      // v66: indexes حرجة لتحسين سرعة الـ /api/orders والـ /api/courier/my-orders
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS governorate TEXT",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS city TEXT",
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS province TEXT",
      // 🆕 v92: العمود اللي كان ناقص — ده اللي خلى الطلبات تفضل "جاري التوصيل" بعد التسوية
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ",
      // v71: غيّر reviewed_by في pending_reviews إلى TEXT (كان INTEGER لكن الـ frontend بيبعت username string)
      "ALTER TABLE pending_reviews ALTER COLUMN reviewed_by TYPE TEXT USING reviewed_by::TEXT",
      // v72: نفس الإصلاح لـ courier_adjustments
      "ALTER TABLE courier_adjustments ALTER COLUMN reviewed_by TYPE TEXT USING reviewed_by::TEXT",
      // 🆕 v110: backfill - إصلاح الطلبات اللي عندها is_bosta=true ALSO courier_id رقم
      // ده تناقض حصل في v106- لما الـ PATCH ما كانش بيعمل is_bosta=false عند assign لمندوب
      // الطلب الواقعي مع المندوب، فلازم is_bosta=false
      `UPDATE orders 
       SET is_bosta=false, updated_at=NOW()
       WHERE is_bosta=true 
         AND courier_id IS NOT NULL`,
      
      // 🆕 v110: backfill - إصلاح الشحن للطلبات المستعجلة المُعيَّنة لمناديب
      // لو الطلب express والمندوب عنده ship_express أعلى من الـ ship الحالي، نحدثه
      `UPDATE orders o
       SET ship = c.ship_express, updated_at=NOW()
       FROM couriers c
       WHERE o.courier_id = c.id
         AND o.delivery_type = 'express'
         AND o.status IN ('جديد', 'جاري التوصيل', 'تحت التسوية')
         AND c.ship_express IS NOT NULL
         AND c.ship_express > 0
         AND o.ship < c.ship_express
         AND (o.settled_at IS NULL)`,
      // v74: إصلاح طلبات المحل اللي اتوزعت بدون delivery_type='pickup'
      // كل الطلبات اللي عندها courier_id يساوي SHOP_COURIER_ID لازم delivery_type='pickup'
      // ده backfill لمرة واحدة (سيشتغل بدون أي ضرر لو الطلبات صح بالفعل)
      `DO $$
       DECLARE shop_id INTEGER;
       DECLARE shop_id_text TEXT;
       BEGIN
         SELECT value INTO shop_id_text FROM app_settings WHERE key='shop_courier_id';
         IF shop_id_text IS NOT NULL AND shop_id_text ~ '^[0-9]+$' THEN
           shop_id := shop_id_text::INTEGER;
           UPDATE orders
           SET delivery_type='pickup', updated_at=NOW()
           WHERE courier_id = shop_id
             AND delivery_type != 'pickup'
             AND status IN ('جديد', 'جاري التوصيل', 'تحت التسوية', 'مسوّى', 'مرتجع');
         END IF;
       EXCEPTION WHEN OTHERS THEN
         NULL; -- تجاهل أي خطأ، الـ migration ده اختياري
       END $$`,
      "CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_orders_courier_id ON orders(courier_id)",
      "CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)",
      "CREATE INDEX IF NOT EXISTS idx_orders_delivery_type ON orders(delivery_type)",
      "CREATE INDEX IF NOT EXISTS idx_orders_courier_status ON orders(courier_id, status)",
      // v88: نقل الموردين الموجودين من checks.payee لجدول vendors
      // ده backfill لمرة واحدة (آمن لو اشتغل أكثر من مرة بسبب ON CONFLICT)
      `INSERT INTO vendors (id, name, created_at)
       SELECT
         'v_' || md5(TRIM(payee)) AS id,
         TRIM(payee) AS name,
         MIN(created_at) AS created_at
       FROM checks
       WHERE payee IS NOT NULL AND TRIM(payee) != ''
       GROUP BY TRIM(payee)
       ON CONFLICT (name) DO NOTHING`,
      // v88: نقل الموردين كمان من جدول check_suppliers القديم (لو موجود)
      `DO $$
       BEGIN
         IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='check_suppliers') THEN
           INSERT INTO vendors (id, name, created_at)
           SELECT
             COALESCE(id, 'v_' || md5(TRIM(name))) AS id,
             TRIM(name) AS name,
             NOW() AS created_at
           FROM check_suppliers
           WHERE name IS NOT NULL AND TRIM(name) != ''
           ON CONFLICT (name) DO NOTHING;
         END IF;
       EXCEPTION WHEN OTHERS THEN NULL;
       END $$`,
      // v90: إصلاح الطلبات اللي اتسوّت لكن status لسة "جاري التوصيل" (race condition)
      // ده backfill لمرة واحدة، آمن (UPDATE فقط للـ orders اللي فعلاً موجودة في settlements)
      `DO $$
       BEGIN
         UPDATE orders
         SET status='مسوّى',
             settled_at=COALESCE(settled_at, NOW()),
             updated_at=NOW()
         WHERE id IN (
           SELECT DISTINCT jsonb_array_elements_text(order_ids::jsonb)
           FROM settlements
         )
         AND status IN ('جاري التوصيل', 'مرتجع', 'تحت التسوية');
       EXCEPTION WHEN OTHERS THEN
         NULL;
       END $$`,
      // 🆕 v96: ربط الـ approved adjustments المعلقة بأقرب تسوية بعد تاريخ موافقتها
      // ده backfill يصلح الحالة اللي حصلت (تعديلات معتمدة لكن مش مرتبطة بتسوية)
      `DO $$
       BEGIN
         UPDATE courier_adjustments ca
         SET settlement_id = (
           SELECT s.id
           FROM settlements s
           WHERE s.courier_id = ca.courier_id
             AND s.ts >= COALESCE(ca.reviewed_at, ca.created_at)
           ORDER BY s.ts ASC
           LIMIT 1
         )
         WHERE ca.status = 'approved'
           AND ca.settlement_id IS NULL;
       EXCEPTION WHEN OTHERS THEN
         NULL;
       END $$`,
    ];
    for (const sql of migrations) {
      try {
        await pool.query(sql);
      } catch(e) {
        // اطبع الـ migrations الفاشلة للـ debugging
        const shortSql = sql.length > 100 ? sql.slice(0, 100) + '...' : sql;
        console.warn('⚠️ Migration failed (continuing):', e.message, '|', shortSql);
      }
    }
    console.log('✅ Migrations applied');

    // ===== v177: Auto-seed shop courier + setting =====
    try {
      // 1) دور على المحل لو موجود (role='shop' أو phone='shop' أو username='shop')
      let shopId = null;
      const existing = await pool.query(
        `SELECT id FROM couriers WHERE role = 'shop' OR phone = 'shop' OR username = 'shop' LIMIT 1`
      );
      if (existing.rows.length) {
        shopId = existing.rows[0].id;
        // تأكد إن دوره shop
        await pool.query(`UPDATE couriers SET role='shop' WHERE id=$1 AND (role IS NULL OR role != 'shop')`, [shopId]).catch(()=>{});
        console.log('✅ Shop courier already exists, ID:', shopId);
      } else {
        // 2) لو مش موجود، اعمله — استخدم بس الأعمدة المضمونة الوجود
        const ins = await pool.query(
          `INSERT INTO couriers (name, phone, zone, vehicle, ship, role, status)
           VALUES ('المحل - Trivium Square', 'shop', 'المحل', 'استلام', 0, 'shop', 'متاح')
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
        console.log('✅ shop_courier_id setting saved:', shopId);
      } else {
        console.log('⚠️ Could not determine shop_courier_id');
      }
    } catch (e) {
      console.error('❌ Shop courier auto-seed FAILED:', e.message, e.stack);
    }

    // ===== v60: امسح invoice cache عشان الفواتير القديمة تتعمل regenerate مع QR code =====
    try {
      const lastVerRes = await pool.query(`SELECT value FROM app_settings WHERE key='last_invoice_template_version'`);
      const currentTpl = 'compact-a4-v5';  // v77: إصلاح Shopify CDN resize URL
      if (lastVerRes.rows[0]?.value !== currentTpl) {
        const cleared = await pool.query('DELETE FROM invoice_cache RETURNING order_id');
        await pool.query(
          `INSERT INTO app_settings (key, value) VALUES ('last_invoice_template_version', $1)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [currentTpl]
        );
        console.log(`✅ Invoice cache cleared (${cleared.rowCount} entries) — template upgraded to ${currentTpl}`);
      }
    } catch(e) {
      console.warn('Invoice cache clear skipped:', e.message);
    }

  } catch (err) {
    console.error('❌ DB init error:', err.message);
  }
}

// ===== MIDDLEWARE =====
app.use(cors({ origin: '*' }));
app.use('/webhook/shopify', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));

// 🔒 v103: منع الفهرسة من محركات البحث وحجب AI crawlers
// list of known AI/scraper user agents to block
const _BLOCKED_BOTS = [
  'gptbot', 'chatgpt-user', 'oai-searchbot',           // OpenAI
  'claudebot', 'claude-web', 'anthropic-ai',           // Anthropic
  'perplexitybot', 'perplexity-user',                  // Perplexity
  'google-extended', 'googleother',                    // Google AI training
  'ccbot',                                             // Common Crawl (used by many AI)
  'bytespider',                                        // ByteDance/TikTok
  'amazonbot',                                         // Amazon
  'applebot-extended',                                 // Apple AI
  'cohere-ai',                                         // Cohere
  'meta-externalagent', 'facebookbot',                 // Meta AI
  'mistralai-user',                                    // Mistral
  'youbot',                                            // You.com
  'diffbot',                                           // Diffbot
  'omgili', 'omgilibot',                               // Webz.io
  'magpie-crawler', 'twitterbot',                      // Various
  'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot',     // SEO scrapers
];

app.use((req, res, next) => {
  // 1) ابعت X-Robots-Tag في كل response
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex');

  // 2) احجب الـ AI/scraper bots
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  if(_BLOCKED_BOTS.some(bot => ua.includes(bot))){
    return res.status(403).send('Access denied');
  }
  next();
});

// 🔒 v103: robots.txt — يقول لكل الـ bots متفهرسش حاجة
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Disallow: /

# Block known AI training crawlers
User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: OAI-SearchBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Claude-Web
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: Perplexity-User
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: ByteSpider
Disallow: /

User-agent: Amazonbot
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: cohere-ai
Disallow: /

User-agent: Meta-ExternalAgent
Disallow: /

User-agent: FacebookBot
Disallow: /

User-agent: MistralAI-User
Disallow: /

User-agent: YouBot
Disallow: /

User-agent: Diffbot
Disallow: /

User-agent: omgili
Disallow: /
`);
});

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
app.post('/api/ai/chat', adminAuth, async (req, res) => {
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
      barcode: i.barcode || '',
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
  const out = {
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
    bostaAwbUrl: r.bosta_awb_url,
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
  // لو الـ awb base64 موجود في الـ row (عند الـ fetch المخصوص)، رجّعه
  if (r.bosta_awb_base64) out.bostaAwbBase64 = r.bosta_awb_base64;
  return out;
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
          -- 🆕 v95: نحافظ على settled_at كمان (مش بيتغير من webhook)
          status=CASE
            WHEN orders.status='مسوّى' THEN 'مسوّى'
            WHEN orders.settled_at IS NOT NULL THEN orders.status
            WHEN EXCLUDED.status='ملغي' THEN 'ملغي'
            WHEN orders.status IN ('جاري التوصيل','مكتمل','ملغي','تحت التسوية','مسوّى','مرتجع','ملغي بالميدان','مدمج','تم التسليم') THEN orders.status
            WHEN orders.courier_id IS NOT NULL THEN orders.status
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
app.get('/api/orders', adminAuth, async (req, res) => {
  if (!DB_ENABLED) return res.json({ orders: memOrders, total: memOrders.length });
  try {
    // 🆕 v99: conditional GET — لو مفيش تغيير منذ آخر طلب، نرجع 304 Not Modified
    // ده بيوفر bandwidth و CPU بشكل كبير لما الـ frontend بيـ poll كل 30 ثانية
    const ifModifiedSince = req.headers['if-modified-since'];

    // جيب آخر تحديث في الـ DB (سريع جداً مع الـ index)
    const lastUpdR = await pool.query(
      'SELECT MAX(updated_at) as last_upd FROM orders LIMIT 1'
    );
    const lastUpd = lastUpdR.rows[0]?.last_upd;

    if (ifModifiedSince && lastUpd) {
      const clientTime = new Date(ifModifiedSince).getTime();
      const serverTime = new Date(lastUpd).getTime();
      // round to second precision (HTTP date precision)
      if (Math.floor(clientTime / 1000) >= Math.floor(serverTime / 1000)) {
        return res.status(304).end();
      }
    }

    // ⚠️ مهم: نشيل الـ columns الضخمة من الـ list response (مش بيتاجها الـ frontend للـ table)
    // - bosta_awb_base64 (100KB+ لكل طلب) — تتجاب من /api/orders/:id/awb
    // - line_items_json (50KB+ مع base64 صور) — تتجاب وقت الفاتورة فقط
    // 🆕 v109: رفع LIMIT من 5000 لـ 10000 لتجنب فقدان طلبات
    const { rows } = await pool.query(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 10000`);
    rows.forEach(r => {
      delete r.bosta_awb_base64;
      delete r.line_items_json; // ⭐ فرق كبير في الأداء
    });

    // أضف Last-Modified header للـ response
    if (lastUpd) {
      res.set('Last-Modified', new Date(lastUpd).toUTCString());
      res.set('Cache-Control', 'private, must-revalidate');
    }

    res.json({ orders: rows.map(rowToOrder), total: rows.length });
  } catch (e) {
    console.error('GET /api/orders error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// 🆕 v109: GET /api/orders/:id/debug — معلومات تشخيصية عن طلب معين
// بيرجع الطلب من الـ DB مباشرة + معلومات إضافية للتشخيص
app.get('/api/orders/:id/debug', adminAuth, async (req, res) => {
  if (!DB_ENABLED) return res.status(503).json({ error: 'DB unavailable' });
  try {
    const id = req.params.id;
    
    // جرّب البحث بـ id كامل + بدون SH- prefix
    const variants = [id, id.replace(/^SH-/i, ''), 'SH-' + id.replace(/^SH-/i, '')];
    let foundRow = null;
    let foundBy = null;
    
    for(const v of variants){
      const r = await pool.query('SELECT * FROM orders WHERE id=$1', [v]);
      if(r.rows.length){
        foundRow = r.rows[0];
        foundBy = v;
        break;
      }
    }
    
    if(!foundRow){
      // ابحث بـ shopify_id كمان
      const idNum = id.replace(/^SH-/i, '');
      const r2 = await pool.query('SELECT * FROM orders WHERE shopify_id::text = $1 OR shopify_id::text LIKE $2', [idNum, '%' + idNum]);
      if(r2.rows.length){
        foundRow = r2.rows[0];
        foundBy = 'shopify_id=' + idNum;
      }
    }
    
    if(!foundRow){
      return res.status(404).json({ 
        error: 'Order not found in DB',
        searchedFor: variants,
        suggestion: 'الطلب مش موجود في DB أصلاً - مش متجاب من Shopify'
      });
    }
    
    // شيل الحقول الضخمة
    delete foundRow.bosta_awb_base64;
    
    // التحقق من شروط ظهور الطلب في /api/orders
    const wouldShowInOrderPro = await pool.query(
      `SELECT COUNT(*) as cnt FROM (
        SELECT id FROM orders ORDER BY created_at DESC LIMIT 10000
      ) sub WHERE sub.id = $1`,
      [foundRow.id]
    );
    
    const isInOrderProList = parseInt(wouldShowInOrderPro.rows[0].cnt) > 0;
    
    // عدد الطلبات الإجمالي
    const totalR = await pool.query('SELECT COUNT(*) as total FROM orders');
    const totalOrders = parseInt(totalR.rows[0].total);
    
    res.json({
      found: true,
      foundBy,
      isInOrderProList, // هل بيظهر في /api/orders؟
      totalOrdersInDB: totalOrders,
      order: {
        id: foundRow.id,
        shopify_id: foundRow.shopify_id,
        src: foundRow.src,
        name: foundRow.name,
        phone: foundRow.phone,
        status: foundRow.status,
        courier_id: foundRow.courier_id,
        is_bosta: foundRow.is_bosta,
        merged_into: foundRow.merged_into,
        cancelled_by_field: foundRow.cancelled_by_field,
        created_at: foundRow.created_at,
        updated_at: foundRow.updated_at,
        total: foundRow.total,
      },
      diagnostics: {
        isInLatestLimit: isInOrderProList,
        isMerged: !!foundRow.merged_into,
        isCancelledByField: !!foundRow.cancelled_by_field,
        hasOldDate: foundRow.created_at && (Date.now() - new Date(foundRow.created_at).getTime() > 90 * 24 * 60 * 60 * 1000),
        explanation: isInOrderProList 
          ? '✅ الطلب لازم يظهر في OrderPro - لو مش ظاهر، المشكلة في الـ frontend (cache/filter)'
          : '⚠️ الطلب موجود في DB بس مش ضمن آخر 10000 طلب - LIMIT problem'
      }
    });
  } catch (e) {
    console.error('GET /api/orders/:id/debug error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// /api/orders/:id/awb — يرجع الـ AWB base64 لطلب واحد عند الحاجة
app.get('/api/orders/:id/awb', adminAuth, async (req, res) => {
  if (!DB_ENABLED) return res.status(503).json({ error: 'DB unavailable' });
  try {
    const r = await pool.query('SELECT bosta_awb_base64, bosta_awb_url FROM orders WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json({
      bostaAwbBase64: r.rows[0].bosta_awb_base64 || null,
      bostaAwbUrl: r.rows[0].bosta_awb_url || null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/orders', adminAuth, async (req, res) => {
  const o = req.body;
  const id = o.id || 'MN-' + Date.now();
  const now = new Date().toISOString();
  // 🆕 v100: total ممكن يكون 0 أو سالب (لو المندوب هيدي للعميل) — استخدم ?? بدل ||
  const totalVal = (o.total != null && o.total !== '') ? parseFloat(o.total) : 0;
  const newOrder = { id, src:o.src||'manual', name:o.name, phone:o.phone||'—', area:o.area, addr:o.addr||o.area, total: isNaN(totalVal) ? 0 : totalVal, ship:o.ship||50, courierId:o.courierId||null, status:o.status||'في الانتظار', paid:o.paid||false, deliveryType:o.deliveryType||'normal', note:o.note||'', items:o.items||'', time:o.time||new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}), createdAt:now };
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
app.post('/api/orders/merge', adminAuth, async (req, res) => {
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

app.patch('/api/orders/:id', adminAuth, async (req, res) => {
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

  // 🆕 v95: حماية الطلبات المسوّاة — مينفعش تغيير الـ status لطلب اتسوّى
  // إلا لو fielded force=true صراحة (للحالات الخاصة)
  const isSettled = oldRow.status === 'مسوّى' || oldRow.settled_at;
  if (isSettled && b.status && b.status !== oldRow.status && !b._force) {
    console.warn(`🛡️ Blocked status change for settled order ${req.params.id}: ${oldRow.status} → ${b.status}`);
    return res.status(403).json({
      error: 'لا يمكن تغيير حالة طلب تم تسويته',
      currentStatus: oldRow.status,
      attemptedStatus: b.status,
      hint: 'استخدم _force=true لو إنت متأكد، أو احذف التسوية أولاً'
    });
  }

  Object.entries(b).forEach(([k, v]) => {
    if (map[k]) {
      // 🆕 v83: defensive — لو courierId='bosta' أو string غير رقمي, حوله لـ null
      if (k === 'courierId' && v != null && (v === 'bosta' || (typeof v === 'string' && isNaN(parseInt(v))))) {
        sets.push(`${map[k]}=$${vals.length+1}`);
        vals.push(null);
      } else {
        sets.push(`${map[k]}=$${vals.length+1}`);
        vals.push(v);
      }
    }
  });
  
  // 🆕 v110: لو في assign لمندوب حقيقي (courierId رقم صحيح) و الـ frontend ما بعتش isBosta
  // نـ set is_bosta=false تلقائياً عشان نمنع التناقض (طلب عنده courier_id ALSO is_bosta=true)
  // ده حصل في v106-: طلبات اتحولت من بوسطة لمندوب لكن flag is_bosta=true ضل
  const courierIdNum = b.courierId != null && b.courierId !== 'bosta' && !isNaN(parseInt(b.courierId)) 
    ? parseInt(b.courierId) 
    : null;
  if (courierIdNum && b.isBosta === undefined && oldRow.is_bosta === true) {
    sets.push(`is_bosta=$${vals.length+1}`);
    vals.push(false);
    console.log(`🔧 v110 auto-fix: clearing is_bosta=true for order ${req.params.id} (assigned to courier ${courierIdNum})`);
  }
  
  // 🆕 v110: auto-fix الشحن للطلبات المستعجلة
  // لو الطلب delivery_type='express' والـ frontend ما بعتش ship صراحةً
  // نحدث الـ ship لـ ship_express بتاع المندوب
  if (courierIdNum && b.ship === undefined) {
    const deliveryType = b.deliveryType || oldRow.delivery_type;
    if (deliveryType === 'express') {
      try {
        const cR = await pool.query('SELECT ship_express FROM couriers WHERE id=$1', [courierIdNum]);
        if (cR.rows.length && cR.rows[0].ship_express) {
          const expressShip = parseFloat(cR.rows[0].ship_express);
          if (expressShip > 0 && parseFloat(oldRow.ship || 0) !== expressShip) {
            sets.push(`ship=$${vals.length+1}`);
            vals.push(expressShip);
            console.log(`🔧 v110 auto-fix: setting ship=${expressShip} for express order ${req.params.id} (courier ${courierIdNum})`);
          }
        }
      } catch(e){ console.warn('express ship lookup failed:', e.message); }
    }
  }
  
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
app.get('/api/orders/:id/history', adminAuth, async (req, res) => {
  if (!DB_ENABLED) return res.json({ history: [] });
  try {
    const orderId = req.params.id;
    const { rows } = await pool.query(
      'SELECT * FROM order_history WHERE order_id=$1 ORDER BY ts DESC LIMIT 50',
      [orderId]
    );
    const history = rows.map(r => ({
      id: r.id,
      action: r.action,
      field: r.field,
      oldValue: r.old_value,
      newValue: r.new_value,
      userName: r.user_name,
      ts: r.ts,
    }));

    // 🆕 v93: أضف تسويات الطلب من جدول settlements
    // 🆕 v94: استخدم LIKE بدون quotes لأن الـ JSON متخزّن مع escape characters
    try {
      // الـ order_ids متخزّن JSON مع escapes (\"SH-x\") — الـ LIKE هيلاقي الـ ID بدون quotes
      const idVariants = [orderId, 'SH-' + orderId.replace(/^SH-/, '')];
      const settleR = await pool.query(`
        SELECT s.id, s.ts, s.cod, s.ship, s.notes, s.courier_id, s.order_ids,
               c.name AS courier_name
        FROM settlements s
        LEFT JOIN couriers c ON c.id = s.courier_id
        WHERE s.order_ids LIKE $1 OR s.order_ids LIKE $2
        ORDER BY s.ts DESC
      `, ['%' + idVariants[0] + '%', '%' + idVariants[1] + '%']);

      for (const s of settleR.rows) {
        // تأكد إن الطلب فعلاً موجود في الـ JSON (LIKE بدون quotes ممكن يدّي false matches)
        let parsedIds = [];
        try { parsedIds = JSON.parse(s.order_ids || '[]'); } catch(e) {}
        const matched = parsedIds.some(id => idVariants.includes(id));
        if (!matched) continue;

        history.push({
          id: 'settle_' + s.id,
          action: 'تسوية',
          field: 'settlement',
          oldValue: '',
          newValue: `تسوية #${s.id} — مندوب: ${s.courier_name || '#' + s.courier_id} — COD: ${parseFloat(s.cod || 0).toLocaleString()} ج`,
          userName: s.courier_name || 'system',
          ts: s.ts,
          settlementId: s.id, // metadata extra
        });
      }
    } catch (e) {
      console.warn('Failed to fetch settlements for history:', e.message);
    }

    // اعد الترتيب بعد إضافة الـ settlements
    history.sort((a, b) => new Date(b.ts) - new Date(a.ts));

    res.json({ history });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// تسجيل حدث يدوي من الفرونتند
app.post('/api/orders/:id/history', adminAuth, async (req, res) => {
  const { action, field, oldValue, newValue, userName } = req.body;
  await logOrderHistory(req.params.id, action, { field, old:oldValue, new:newValue, user:userName||'مستخدم' });
  res.json({ ok: true });
});

app.delete('/api/orders/:id', adminAuth, async (req, res) => {
  if (!DB_ENABLED) { memOrders = memOrders.filter(o=>o.id!==req.params.id); return res.json({ ok:true }); }
  await pool.query('DELETE FROM orders WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ===== IMPORT FROM SHOPIFY =====

app.post('/api/import-shopify', adminAuth, async (req, res) => {
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
app.get('/api/couriers', adminAuth, async (req, res) => {
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

app.post('/api/couriers', adminAuth, async (req, res) => {
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

app.patch('/api/couriers/:id', adminAuth, async (req, res) => {
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

app.delete('/api/couriers/:id', adminAuth, async (req, res) => {
  if (!DB_ENABLED) { memCouriers = memCouriers.filter(x=>x.id!=req.params.id); return res.json({ ok:true }); }
  await pool.query('DELETE FROM couriers WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ===== NOTIFICATIONS =====
app.get('/api/notifications', adminAuth, async (req, res) => {
  if (!DB_ENABLED) return res.json({ notifications: memNotifs.slice(0,100) });
  const { rows } = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100');
  res.json({ notifications: rows });
});

app.patch('/api/notifications/:id/read', adminAuth, async (req, res) => {
  await pool.query('UPDATE notifications SET read=true WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

app.patch('/api/notifications/read-all', adminAuth, async (req, res) => {
  await pool.query('UPDATE notifications SET read=true');
  res.json({ ok: true });
});

app.post('/api/notifications', adminAuth, async (req, res) => {
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

app.post('/api/bosta/test', adminAuth, async (req, res) => {
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
app.post('/api/bosta/awb', adminAuth, async (req, res) => {
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

app.post('/api/bosta/create', adminAuth, async (req, res) => {
  const { apiKey, env = 'production', locationId, order } = req.body;
  if (!apiKey || !order) return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
  const nameParts = (order.name || '').trim().split(/\s+/);

  // 🆕 v84: لو الـ frontend ما بعتش lineItemsJson، جيبها من الـ DB مباشرة
  // (في v74 شيلنا lineItemsJson من /api/orders للـ performance)
  let lineItemsArray = [];
  try {
    if (order.lineItemsJson) {
      lineItemsArray = JSON.parse(order.lineItemsJson);
    } else if (order.line_items_json) {
      lineItemsArray = JSON.parse(order.line_items_json);
    }
  } catch (e) {}

  // لو لسه فاضي وعندنا DB، جيب من الـ orders table
  if (!lineItemsArray.length && DB_ENABLED && order.id) {
    try {
      const r = await pool.query('SELECT line_items_json FROM orders WHERE id=$1', [order.id]);
      if (r.rows[0]?.line_items_json) {
        lineItemsArray = JSON.parse(r.rows[0].line_items_json);
        console.log(`📦 Loaded ${lineItemsArray.length} line items from DB for ${order.id}`);
      }
    } catch (e) { console.warn('Failed to load line_items from DB:', e.message); }
  }

  // 🆕 v82: حساب عدد القطع الفعلي من الـ line items (مجموع الـ quantities)
  let totalParcels = 1;
  let parcelItems = []; // detailed items list for Bosta
  let packageDescription = '';
  if (lineItemsArray.length) {
    totalParcels = lineItemsArray.reduce((sum, i) => sum + (parseInt(i.quantity) || 1), 0);
    parcelItems = lineItemsArray.map(i => ({
      itemName: (i.name || i.title || 'منتج').slice(0, 100),
      quantity: parseInt(i.quantity) || 1,
      cod: 0,
      itemValue: parseFloat(i.price) || 0,
    }));
    packageDescription = lineItemsArray
      .map(i => `${i.quantity || 1}x ${i.name || i.title || ''}`.trim())
      .filter(Boolean)
      .join(' | ');
  }

  // fallback: استخدم order.items (string) لو مفيش lineItemsJson
  if (!packageDescription && order.items) {
    packageDescription = order.items;
  }
  if (!packageDescription) packageDescription = 'منتجات';
  // قص الوصف لو طويل (Bosta عندها limit ~250 char)
  if (packageDescription.length > 240) packageDescription = packageDescription.slice(0, 237) + '...';

  if (totalParcels < 1) totalParcels = 1;

  // 🆕 v79: رقم مرجع الطلب بدون "SH-"
  const businessRef = String(order.id || '').replace(/^SH-/, '');

  // 🆕 v79: قيمة المنتج (totalCost) دايماً = total الطلب، حتى لو مدفوع
  // الـ COD = 0 لو مدفوع، أو total لو COD
  const orderTotal = parseFloat(order.total) || 0;
  const codAmount = order.paid ? 0 : orderTotal;

  // لو مفيش items details، اعمل item واحد بقيمة الطلب
  if (!parcelItems.length) {
    parcelItems = [{
      itemName: packageDescription.slice(0, 100),
      quantity: totalParcels,
      cod: 0,
      itemValue: orderTotal,
    }];
  }

  // 🆕 v86: الـ payload الصحيح بناءً على الـ network call من Bosta dashboard
  const payload = {
    type: 10,
    // ⭐ الـ field الصحيح للقيمة: goodsInfo.amount (كـ string)
    goodsInfo: {
      amount: String(orderTotal),
    },
    // ⭐ COD كـ string
    cod: String(codAmount),
    // ⭐ specs بالشكل الصحيح
    specs: {
      packageDetails: {
        itemsCount: totalParcels,
        description: packageDescription,
      },
      packageType: 'Small',
    },
    allowToOpenPackage: false,
    payWithBostaCredits: false,
    dropOffAddress: {
      city: order.area || 'القاهرة',
      firstLine: order.addr || order.area || '—',
    },
    // ⭐ receiver بـ fullName (مش firstName/lastName)
    receiver: {
      phone: (order.phone || '01000000000').replace(/[^0-9+]/g, ''),
      fullName: order.name || 'عميل',
    },
    businessReference: businessRef,
    notes: 'في حالة حدوث اي مشكلة برجاء الاتصال علي 01080008022',
  };

  // pickup location
  if (locationId) {
    payload.businessLocationId = locationId;
  }

  // 🆕 v86: log أوضح
  console.log('📦 Bosta payload (v86):', JSON.stringify({
    orderId: order.id,
    cod: payload.cod,
    'goodsInfo.amount': payload.goodsInfo.amount,
    'specs.packageDetails.itemsCount': payload.specs.packageDetails.itemsCount,
    'specs.packageType': payload.specs.packageType,
    receiver: payload.receiver,
  }));


  try {
    const r = await bostaRequest(env, apiKey, '/deliveries', 'POST', payload);

    // 🆕 v84: log الـ response عشان نشوف ايه القيم اللي Bosta قبلتها فعلاً
    console.log(`📥 Bosta response status: ${r.status}`);
    if (r.data) {
      const d = r.data.data || r.data;
      console.log('📥 Bosta response data:', JSON.stringify({
        deliveryId: d._id || d.id,
        trackingNumber: d.trackingNumber,
        cod: d.cod,
        cashOnDelivery: d.cashOnDelivery,
        orderValue: d.orderValue,
        packageValue: d.packageValue,
        specs_packageDetails: d.specs?.packageDetails,
        message: r.data.message,
      }, null, 2).slice(0, 1500));
    }

    if (r.status === 200 || r.status === 201) {
      const d = r.data.data || r.data;
      const deliveryId = d._id || d.id;
      const trackingNumber = d.trackingNumber || d._id;

      // 🆕 v80: جلب الـ AWB مع retry — Bosta أحياناً بتاخد ثواني لتجهيز الـ PDF
      let awbBase64 = null, awbUrl = null;
      const awbAttempts = [
        { delay: 0, label: 'فوري' },
        { delay: 2000, label: 'بعد 2 ثانية' },
        { delay: 4000, label: 'بعد 4 ثواني' },
      ];
      for (const attempt of awbAttempts) {
        if (attempt.delay) await new Promise(r => setTimeout(r, attempt.delay));
        try {
          const awbR = await bostaRequest(env, apiKey, '/deliveries/'+deliveryId+'/airwaybill', 'GET', null, true);
          if (awbR.status === 200 && awbR.buffer && awbR.buffer.length > 1000) {
            awbBase64 = awbR.buffer.toString('base64');
            awbUrl = 'data:application/pdf;base64,' + awbBase64;
            console.log(`✅ AWB fetched (${attempt.label}) for ${order.id}, size: ${Math.round(awbR.buffer.length/1024)}KB`);
            break;
          } else {
            console.log(`⏳ AWB not ready yet (${attempt.label}), status=${awbR.status}, size=${awbR.buffer?.length || 0}`);
          }
        } catch (awbErr) { console.log(`AWB attempt ${attempt.label} failed:`, awbErr.message); }
      }

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

      // 🆕 v80: لو الـ AWB ما اتجابش، عيد المحاولة في الخلفية (مش بنوقف الـ user)
      if (!awbBase64 && order.id && DB_ENABLED) {
        setImmediate(async () => {
          for (const delay of [10000, 30000, 60000]) {  // بعد 10s, 30s, 60s
            await new Promise(r => setTimeout(r, delay));
            try {
              const awbR = await bostaRequest(env, apiKey, '/deliveries/'+deliveryId+'/airwaybill', 'GET', null, true);
              if (awbR.status === 200 && awbR.buffer && awbR.buffer.length > 1000) {
                const b64 = awbR.buffer.toString('base64');
                const url = 'data:application/pdf;base64,' + b64;
                await pool.query(
                  'UPDATE orders SET bosta_awb_url=$1, bosta_awb_base64=$2, updated_at=NOW() WHERE id=$3',
                  [url, b64, order.id]
                );
                console.log(`✅ Background AWB fetch succeeded for ${order.id} (after ${delay/1000}s)`);
                return;
              }
            } catch (e) { /* استمر للمحاولة الجاية */ }
          }
          console.warn(`⚠️ Background AWB fetch gave up for ${order.id}`);
        });
      }

      res.json({ success: true, deliveryId, trackingNumber, hasAwb: !!awbBase64 });
    } else {
      res.json({ success: false, error: 'HTTP ' + r.status + ': ' + (r.data.message || r.data.error || JSON.stringify(r.data)) });
    }
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// جلب الـ AWB لطلب موجود
app.get('/api/bosta/awb/:orderId', adminAuth, async (req, res) => {
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
    return res.json({ success: true, awbBase64: rows[0].bosta_awb_base64, awbUrl: rows[0].bosta_awb_url });
  }

  // 🆕 v81: لو الـ AWB مش محفوظ، حاول تجيبه من بوسطة فوراً
  const bostaId = rows[0].bosta_id;
  const apiKey = req.query.apiKey;
  const env = req.query.env || 'production';
  if (bostaId && apiKey) {
    try {
      const awbR = await bostaRequest(env, apiKey, '/deliveries/'+bostaId+'/airwaybill', 'GET', null, true);
      if (awbR.status === 200 && awbR.buffer && awbR.buffer.length > 1000) {
        const b64 = awbR.buffer.toString('base64');
        const url = 'data:application/pdf;base64,' + b64;
        // احفظ في الـ DB للمرة الجاية
        await pool.query(
          'UPDATE orders SET bosta_awb_url=$1, bosta_awb_base64=$2, updated_at=NOW() WHERE id=$3',
          [url, b64, req.params.orderId]
        ).catch(()=>{});
        return res.json({ success: true, awbBase64: b64, awbUrl: url, fetchedNow: true });
      }
    } catch(e) {
      console.warn('AWB fetch on demand failed:', e.message);
    }
  }

  res.json({ success: false, bostaId, error: 'البوليصة مش محفوظة بعد' });
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
app.post('/api/shopify/backfill-images', adminAuth, async (req, res) => {
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

app.post('/api/shopify/fetch-line-items', adminAuth, async (req, res) => {
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

app.post('/api/shopify/price-check', adminAuth, async (req, res) => {
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

app.post('/api/shopify/diagnose', adminAuth, async (req, res) => {
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
app.post('/api/shopify/assign', adminAuth, async (req, res) => {
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

// 🆕 v106: نـورمالايز الـ phone عشان البحث في Shopify
function _normalizePhone(phone){
  if(!phone) return '';
  let p = String(phone).replace(/[^\d+]/g, '');
  // شيل أكواد الدولة المصرية المختلفة → خليه يبدأ بـ 0
  if(p.startsWith('+20')) p = '0' + p.slice(3);
  else if(p.startsWith('0020')) p = '0' + p.slice(4);
  else if(p.startsWith('20') && p.length === 12) p = '0' + p.slice(2);
  // تأكد إنه يبدأ بـ 0
  if(!p.startsWith('0') && p.length === 10) p = '0' + p;
  return p;
}

// 🆕 v106: ابحث عن عميل في Shopify بالتليفون
async function _searchShopifyCustomerByPhone(shopUrl, accessToken, phone){
  const normalized = _normalizePhone(phone);
  if(!normalized || normalized.length < 10) return null;

  // جرّب البحث بـ variants مختلفة من التليفون
  const variants = [
    normalized,
    normalized.startsWith('0') ? '+2' + normalized : normalized,  // +20...
    normalized.startsWith('0') ? '2' + normalized : normalized,    // 20...
    normalized.startsWith('0') ? normalized.slice(1) : normalized, // بدون الـ 0
  ];

  for(const variant of variants){
    try{
      const url = `https://${shopUrl}/admin/api/2024-01/customers/search.json?query=phone:${encodeURIComponent(variant)}`;
      const r = await httpsRequest(url, {
        method: 'GET',
        headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' }
      });
      if(r.statusCode === 200 && r.body){
        const data = JSON.parse(r.body);
        if(data.customers && data.customers.length > 0){
          return data.customers[0];
        }
      }
    }catch(e){
      console.warn('Shopify customer search error:', e.message);
    }
  }
  return null;
}

// 🆕 v106: جيب طلبات عميل من Shopify
async function _fetchShopifyCustomerOrders(shopUrl, accessToken, customerId){
  try{
    const url = `https://${shopUrl}/admin/api/2024-01/customers/${customerId}/orders.json?status=any&limit=250`;
    const r = await httpsRequest(url, {
      method: 'GET',
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' }
    });
    if(r.statusCode === 200 && r.body){
      const data = JSON.parse(r.body);
      return data.orders || [];
    }
  }catch(e){
    console.warn('Shopify customer orders error:', e.message);
  }
  return [];
}

// 🆕 v106: حسب نسبة المخاطر للعميل من Shopify orders
function _computeCustomerRisk(customer, orders){
  if(!orders || orders.length === 0){
    return {
      totalOrders: 0,
      cancelledOrders: 0,
      refundedOrders: 0,
      successfulOrders: 0,
      riskPercentage: 0,
      totalSpent: 0,
      lastOrderAt: null,
      firstOrderAt: null,
    };
  }

  let cancelled = 0, refunded = 0, successful = 0, totalSpent = 0;
  let firstOrder = null, lastOrder = null;

  for(const o of orders){
    // طلب ملغي
    if(o.cancelled_at){
      cancelled++;
    }
    // طلب مرتجع (refund or restocked)
    else if(o.financial_status === 'refunded' || o.financial_status === 'voided' || o.fulfillment_status === 'restocked'){
      refunded++;
    }
    // طلب ناجح (مكتمل ومدفوع)
    else if(o.fulfillment_status === 'fulfilled' && o.financial_status === 'paid'){
      successful++;
      totalSpent += parseFloat(o.total_price || 0);
    }
    // طلب pending — مش بنحسبه في النسبة

    const t = new Date(o.created_at).getTime();
    if(!firstOrder || t < firstOrder) firstOrder = t;
    if(!lastOrder || t > lastOrder) lastOrder = t;
  }

  const evaluated = cancelled + refunded + successful;
  const failed = cancelled + refunded;
  const riskPct = evaluated > 0 ? Math.round((failed / evaluated) * 100) : 0;

  return {
    totalOrders: orders.length,
    cancelledOrders: cancelled,
    refundedOrders: refunded,
    successfulOrders: successful,
    riskPercentage: riskPct,
    totalSpent: Math.round(totalSpent),
    lastOrderAt: lastOrder ? new Date(lastOrder).toISOString() : null,
    firstOrderAt: firstOrder ? new Date(firstOrder).toISOString() : null,
  };
}

// 🆕 v106: جيب أو احسب تقييم العميل (مع caching)
async function _getCustomerRisk(phone, forceRefresh = false){
  const normalized = _normalizePhone(phone);
  if(!normalized) return null;

  // تحقق من الـ cache (TTL: 24 ساعة)
  if(DB_ENABLED && !forceRefresh){
    try{
      const r = await pool.query(
        `SELECT * FROM customer_risk_cache WHERE phone=$1 AND cached_at > NOW() - INTERVAL '24 hours'`,
        [normalized]
      );
      if(r.rows.length){
        const c = r.rows[0];
        return {
          phone: c.phone,
          customerId: c.shopify_customer_id,
          customerName: c.customer_name,
          totalOrders: c.total_orders,
          cancelledOrders: c.cancelled_orders,
          refundedOrders: c.refunded_orders,
          successfulOrders: c.successful_orders,
          totalSpent: parseFloat(c.total_spent) || 0,
          riskPercentage: parseFloat(c.risk_percentage) || 0,
          lastOrderAt: c.last_order_at,
          firstOrderAt: c.first_order_at,
          tags: c.tags,
          cached: true,
          cachedAt: c.cached_at,
        };
      }
    }catch(e){ console.warn('cache read error:', e.message); }
  }

  // جيب من Shopify
  const creds = await getShopifyCredentials();
  if(!creds.shopUrl || !creds.accessToken) return null;

  const customer = await _searchShopifyCustomerByPhone(creds.shopUrl, creds.accessToken, normalized);
  if(!customer){
    // مفيش عميل بالاسم ده — احفظ في الـ cache كـ "unknown"
    if(DB_ENABLED){
      try{
        await pool.query(
          `INSERT INTO customer_risk_cache (phone, total_orders, risk_percentage, cached_at, updated_at)
           VALUES ($1, 0, 0, NOW(), NOW())
           ON CONFLICT (phone) DO UPDATE SET cached_at=NOW(), total_orders=0, risk_percentage=0`,
          [normalized]
        );
      }catch(e){}
    }
    // 🆕 v107: ارجع كل الـ fields بقيم 0 عشان الـ frontend ميعرضش undefined
    return { 
      phone: normalized, 
      customerId: null,
      customerName: '',
      totalOrders: 0, 
      cancelledOrders: 0,
      refundedOrders: 0,
      successfulOrders: 0,
      totalSpent: 0,
      riskPercentage: 0, 
      lastOrderAt: null,
      firstOrderAt: null,
      tags: '',
      notFound: true 
    };
  }

  const orders = await _fetchShopifyCustomerOrders(creds.shopUrl, creds.accessToken, customer.id);
  const risk = _computeCustomerRisk(customer, orders);

  const result = {
    phone: normalized,
    customerId: String(customer.id),
    customerName: `${customer.first_name||''} ${customer.last_name||''}`.trim() || customer.email,
    tags: customer.tags || '',
    ...risk,
    cached: false,
  };

  // احفظ في الـ cache
  if(DB_ENABLED){
    try{
      await pool.query(
        `INSERT INTO customer_risk_cache
         (phone, shopify_customer_id, customer_name, total_orders, cancelled_orders, refunded_orders,
          successful_orders, total_spent, risk_percentage, last_order_at, first_order_at, tags, cached_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
         ON CONFLICT (phone) DO UPDATE SET
           shopify_customer_id=$2, customer_name=$3, total_orders=$4, cancelled_orders=$5,
           refunded_orders=$6, successful_orders=$7, total_spent=$8, risk_percentage=$9,
           last_order_at=$10, first_order_at=$11, tags=$12, cached_at=NOW(), updated_at=NOW()`,
        [
          normalized, result.customerId, result.customerName,
          result.totalOrders, result.cancelledOrders, result.refundedOrders,
          result.successfulOrders, result.totalSpent, result.riskPercentage,
          result.lastOrderAt, result.firstOrderAt, result.tags
        ]
      );
    }catch(e){ console.warn('cache write error:', e.message); }
  }

  return result;
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
  // جيب line items من الـ DB (المفروض الصور بقت مدمجة كـ base64 من webhook)
  let lineItems = [];
  try { lineItems = JSON.parse(order.line_items_json || order.lineItemsJson || '[]'); } catch(e) {}

  // 🆕 v70: لو الطلب من Shopify ومفيهوش imageBase64 (طلب قديم)، عمل enrich فوري ومحفّظ
  // ده بيحصل مرة واحدة بس لكل طلب — مرة جاية الفاتورة هتطبع فوراً
  if (order.src === 'shopify' && (order.shopify_id || order.shopifyId)) {
    const needsEnrich = !lineItems.length || lineItems.some(i => i.image && !i.imageBase64);
    if (needsEnrich) {
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
            // 💾 احفظ في الـ DB عشان المرة الجاية تكون فوراً
            const orderId = order.id;
            if (DB_ENABLED && orderId) {
              try {
                await pool.query(
                  'UPDATE orders SET line_items_json=$1, updated_at=NOW() WHERE id=$2',
                  [JSON.stringify(lineItems), orderId]
                );
                console.log('💾 Auto-enriched & saved images for invoice:', orderId);
              } catch(saveErr) { console.warn('save enriched failed:', saveErr.message); }
            }
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

  // ⚡ سرعة فائقة: نستخدم imageBase64 مباشرة، مفيش network calls
  // لو لسه مفيش imageBase64 (للـ backward compatibility)، نستخدم الـ URL
  lineItems.forEach(i => {
    if (i.imageBase64) {
      i.image = i.imageBase64;  // الصورة inline (instant rendering)
    }
    // وإلا i.image يفضل URL — المتصفح يحاول يحمله
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
      ? `<div class="item-img"><img src="${i.image}" alt=""></div>`
      : `<div class="item-img"><span class="item-img-placeholder">📦</span></div>`;
    const qtyHtml = isDiff
      ? `<div class="item-qty" style="border:2px solid #000;border-radius:3px;padding:3px 6px;text-align:center;width:50px"><div style="font-size:20px;font-weight:900;line-height:1">${qty}</div><div style="font-size:8px;font-weight:700;margin-top:1px">!!</div></div>`
      : `<div class="item-qty">${qty} ×</div>`;
    const rowStyle = isDiff ? 'background:#fff8e1;' : '';
    return `<div class="item-row" style="${rowStyle}">${qtyHtml}${imgHtml}<div class="item-info"><div class="item-name"${isDiff?' style="font-weight:800"':''}>${(i.name||'').replace(/[<>]/g,'')}</div>${i.variantTitle?`<div class="item-meta">${i.variantTitle}</div>`:''}${i.sku?`<div class="item-meta">SKU: ${i.sku}</div>`:''}${i.price>0?`<div class="item-meta">${fmtMoney(i.price)}</div>`:''}</div><div class="item-total">${lineTotal>0?fmtMoney(lineTotal):''}</div></div>`;
  }).join('');

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>Order ${orderNum}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{font-family:"Noto Sans",Arial,sans-serif;font-size:13px;color:#000;background:#fff}
  .wrapper{max-width:780px;margin:0 auto;padding:24px}

  /* Header — اسم البراند + رقم الطلب + QR صغير */
  .header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:14px}
  .header-left{flex:1}
  .brand{font-size:24px;font-weight:800;letter-spacing:0.5px}
  .order-meta{font-size:12px;color:#444;margin-top:2px;line-height:1.5}
  .order-num{font-weight:700;color:#000;font-size:14px}
  .header-right{display:flex;align-items:center;gap:10px;flex-shrink:0}
  .qr-box{width:70px;height:70px;flex-shrink:0;border:1px solid #ccc;padding:2px;background:#fff}
  .qr-box img{width:100%;height:100%;display:block}
  .order-id-display{font-size:11px;font-weight:700;text-align:center;line-height:1.3}

  /* Ship to */
  .ship-to{margin-bottom:14px;padding:8px 0}
  .ship-label{font-size:10px;font-weight:700;text-transform:uppercase;color:#666;margin-bottom:4px;letter-spacing:0.5px}
  .ship-name{font-size:15px;font-weight:700;margin-bottom:3px}
  .ship-addr{font-size:12px;line-height:1.5;color:#222}
  .ship-phone{direction:ltr;unicode-bidi:plaintext;font-weight:600;font-size:13px;margin-top:3px}

  /* Items */
  .items-header{display:flex;font-size:10px;font-weight:700;text-transform:uppercase;color:#666;letter-spacing:0.5px;padding:6px 0;border-bottom:1px solid #ccc;margin-bottom:4px}
  .items-header .h-qty{width:60px}
  .items-header .h-items{flex:1;padding:0 8px}
  .items-header .h-total{width:90px;text-align:right}

  .item-row{display:flex;align-items:center;padding:8px 0;border-bottom:1px solid #eee;page-break-inside:avoid;break-inside:avoid}
  .item-qty{width:60px;font-size:13px;font-weight:600}
  .item-img{width:50px;height:50px;flex-shrink:0;margin-right:8px;background:#f5f5f5;border:1px solid #e5e5e5;display:flex;align-items:center;justify-content:center;overflow:hidden}
  .item-img img{width:100%;height:100%;object-fit:cover;display:block}
  .item-img-placeholder{font-size:18px;color:#bbb}
  .item-info{flex:1;min-width:0;padding:0 4px}
  .item-name{font-size:12.5px;font-weight:600;line-height:1.3}
  .item-meta{font-size:10px;color:#666;margin-top:2px;line-height:1.3}
  .item-total{width:90px;text-align:right;font-weight:700;font-size:13px}

  /* Totals */
  .totals{margin-top:12px;padding:10px 0;border-top:2px solid #000;display:flex;justify-content:space-between;font-size:14px;font-weight:700;page-break-inside:avoid}
  .totals-row{display:flex;justify-content:space-between;padding:3px 0;font-size:13px;font-weight:500}
  .totals-row.grand{font-size:16px;font-weight:800;border-top:1px solid #000;margin-top:4px;padding-top:6px}
  .totals-block{width:280px;margin-left:auto}

  /* Summary box (delivery, source, etc) */
  .summary-box{margin-top:12px;border:1px solid #000;border-radius:4px;padding:10px 14px;display:flex;flex-wrap:wrap;gap:10px 24px;page-break-inside:avoid}
  .summary-cell{min-width:80px}
  .summary-label{text-transform:uppercase;font-size:9px;font-weight:700;letter-spacing:0.5px;color:#555;margin-bottom:2px}
  .summary-value{font-size:13px;font-weight:700}
  .summary-cell.highlight{border-right:2px solid #000;padding-right:14px}
  .summary-cell.highlight .summary-value{font-size:18px}

  /* Footer */
  .footer{text-align:center;margin-top:18px;padding-top:10px;border-top:1px solid #ccc;font-size:11px;color:#555}
  .footer h3{font-size:14px;color:#000;margin-bottom:4px}

  .no-print-btn{display:inline-block;background:#000;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-size:13px;cursor:pointer;margin-top:8px;font-family:inherit}

  /* CRITICAL: Print rules */
  @page{size:A4;margin:10mm}
  @media print{
    .no-print{display:none!important}
    .wrapper{max-width:none;padding:0;margin:0}
    body{font-size:12px}
    /* امنع تكسير الـ items عبر صفحات */
    .item-row,.summary-box,.totals,.footer{page-break-inside:avoid;break-inside:avoid}
  }
</style></head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="header-left">
      <div class="brand">CAFELAX</div>
      <div class="order-meta">
        <div class="order-num">Order ${orderNum}</div>
        <div>${orderDate}</div>
        ${order.batch_code || order.batchCode ? `<div style="font-size:10px;color:#888">${order.batch_code || order.batchCode}</div>`:''}
      </div>
    </div>
    <div class="header-right">
      <div class="order-id-display">
        <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.5px">Order ID</div>
        <div style="font-size:14px;font-weight:800">#${orderNum}</div>
      </div>
      <div class="qr-box">
        <img src="https://quickchart.io/qr?text=${encodeURIComponent(order.id || '')}&size=140&margin=0&ecLevel=M" alt="QR" onerror="this.style.display='none'">
      </div>
    </div>
  </div>

  <div class="ship-to">
    <div class="ship-label">Ship to</div>
    <div class="ship-name">${(order.name||'').replace(/[<>]/g,'')}</div>
    <div class="ship-addr">${addr1}<br>Egypt</div>
    <div class="ship-phone">${order.phone||''}</div>
  </div>

  <div class="items-header">
    <div class="h-qty">QTY</div>
    <div class="h-items">ITEMS</div>
    <div class="h-total">TOTAL</div>
  </div>
  ${itemsHtml}

  <div class="totals">
    <div class="totals-block">
      <div class="totals-row"><span>Subtotal</span><span>${fmtMoney(subtotal)}</span></div>
      <div class="totals-row"><span>Shipping</span><span>${fmtMoney(shippingCost)}</span></div>
      <div class="totals-row grand"><span>Total</span><span>${fmtMoney(total)}</span></div>
    </div>
  </div>

  <div class="summary-box">
    <div class="summary-cell"><div class="summary-label">Delivery</div><div class="summary-value">${deliveryLabel}</div></div>
    <div class="summary-cell"><div class="summary-label">Source</div><div class="summary-value">${sourceLabel}</div></div>
    <div class="summary-cell"><div class="summary-label">Items</div><div class="summary-value">${uniqueItems}</div></div>
    <div class="summary-cell highlight"><div class="summary-label">Total Pieces</div><div class="summary-value">${totalItems} pcs</div></div>
  </div>

  <div class="footer">
    <h3>Thank you for shopping with us!</h3>
    <div><strong>CAFELAX</strong> · info@cafelax.com · www.cafelax.com</div>
    <button class="no-print-btn no-print" onclick="window.print()">🖨️ Print</button>
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
app.get('/api/settings', adminAuth, async (req, res) => {
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
app.get('/api/shopify/test', adminAuth, async (req, res) => {
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
app.post('/api/settings', adminAuth, async (req, res) => {
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
app.get('/api/batches', adminAuth, async (req, res) => {
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
app.get('/api/batches/current', adminAuth, async (req, res) => {
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
app.post('/api/batches', adminAuth, async (req, res) => {
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
app.patch('/api/batches/:code', adminAuth, async (req, res) => {
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
app.get('/api/orders/:id/invoice', adminAuth, async (req, res) => {
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
app.post('/api/orders/:id/invoice/refresh', adminAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM invoice_cache WHERE order_id=$1', [req.params.id]).catch(()=>{});
    await cacheInvoiceForOrder(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/invoices/batch-generate → يولّد عدة فواتير مرة واحدة (بالـ parallel)
app.post('/api/invoices/batch-generate', adminAuth, async (req, res) => {
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
app.post('/api/invoices/batch-html', adminAuth, async (req, res) => {
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
  const variantBarcodeCache = {};  // variant_id → barcode
  const variantSkuCache = {};       // variant_id → sku (للـ fallback)
  const productIds = [...new Set(lineItems.filter(i => !(i.image && i.image.src) || !i.barcode).map(i => i.product_id).filter(Boolean))];

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
        // اجمع باركود كل variant
        (p.variants || []).forEach(v => {
          if (v.id && v.barcode) variantBarcodeCache[v.id] = v.barcode;
          if (v.id && v.sku) variantSkuCache[v.id] = v.sku;
        });
      }
    } catch(e) { console.warn('enrich product:', pid, e.message); }
  }

  // helper: حمّل صورة وحوّلها لـ base64 (مع cache بالـ URL عشان لا نحمل نفس الصورة مرتين)
  const imageBase64Cache = {};
  async function downloadAsBase64(url) {
    if (!url) return null;
    if (imageBase64Cache[url] !== undefined) return imageBase64Cache[url];
    try {
      // 🆕 v77: Shopify CDN يستخدم query params للـ resize (مش suffix)
      // الصيغة الصحيحة: ?width=300 — مش _300x300.jpg
      let sizedUrl;
      if (url.includes('cdn.shopify.com') || url.includes('shopify')) {
        // لو في query params بالفعل، أضف &width=300، وإلا استخدم ?width=300
        sizedUrl = url.includes('?') ? `${url}&width=300` : `${url}?width=300`;
      } else {
        sizedUrl = url; // غير Shopify — استخدم الـ URL كما هو
      }

      let data = await fetchBinary(sizedUrl);

      // لو الـ resized URL فشل، جرب الـ URL الأصلي
      if (!data && sizedUrl !== url) {
        console.warn('Resized URL failed, trying original:', url);
        data = await fetchBinary(url);
      }

      if (!data) {
        // ⚠️ ما نـ cache الـ failure — لو حصل اتصال مؤقت، الطلب الجاي يحاول تاني
        return null;
      }
      // استخرج الـ extension من الـ URL الأصلي (مش الـ sized)
      const ext = (url.match(/\.(jpg|jpeg|png|webp)/i) || ['','jpeg'])[1].toLowerCase();
      const mime = ext === 'jpg' ? 'jpeg' : ext;
      const b64 = `data:image/${mime};base64,` + data.toString('base64');
      imageBase64Cache[url] = b64;
      return b64;
    } catch(e) {
      console.warn('downloadAsBase64 failed:', url, e.message);
      // ما نـ cache الـ failure
      return null;
    }
  }

  // اعمل enrich مع تحميل الصور كـ base64 (parallel لكن مع limit عشان نتجنب rate limit)
  const enriched = [];
  for (const i of lineItems) {
    let imageUrl = (i.image && i.image.src) ? i.image.src : null;
    if (!imageUrl && i.variant_id && variantImageCache[i.variant_id]) imageUrl = variantImageCache[i.variant_id];
    if (!imageUrl && i.product_id && productImageCache[i.product_id]) imageUrl = productImageCache[i.product_id];

    // الباركود: من الـ line item أولاً (نادراً ما يكون موجود)، وإلا من الـ variant
    let barcode = i.barcode || '';
    if (!barcode && i.variant_id && variantBarcodeCache[i.variant_id]) {
      barcode = variantBarcodeCache[i.variant_id];
    }

    // حمّل الصورة كـ base64 لو فيها URL
    const imageBase64 = imageUrl ? await downloadAsBase64(imageUrl) : null;

    enriched.push({
      name: i.name,
      title: i.title,
      variantTitle: i.variant_title || '',
      sku: i.sku || (i.variant_id && variantSkuCache[i.variant_id]) || '',
      barcode: barcode,
      quantity: i.quantity,
      price: parseFloat(i.price) || 0,
      totalPrice: (parseFloat(i.price) || 0) * (i.quantity || 1),
      image: imageUrl,           // الـ URL الأصلي (للـ backwards compat)
      imageBase64: imageBase64,  // ⭐ الصورة inline كـ base64 (للـ instant printing)
      productId: i.product_id,
      variantId: i.variant_id,
    });
  }

  return enriched;
}

// Helper: تحميل صورة (أو أي binary) من URL
function fetchBinary(url, timeoutMs = 10000) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? require('https') : require('http');
      const req = lib.get(url, { timeout: timeoutMs }, (res) => {
        // اتبع redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchBinary(res.headers.location, timeoutMs).then(resolve);
          return;
        }
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', () => resolve(null));
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    } catch(e) {
      resolve(null);
    }
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
app.get('/api/check-books', adminAuth, async (req, res) => {
  if (!DB_ENABLED) return res.json({ books: [] });
  try {
    // تأكد إن العمودين موجودين قبل الـ SELECT (للـ DBs القديمة)
    try{
      await pool.query("ALTER TABLE check_books ADD COLUMN IF NOT EXISTS first_num INTEGER DEFAULT 1");
      await pool.query("ALTER TABLE check_books ADD COLUMN IF NOT EXISTS last_num INTEGER");
    }catch(e){}
    const { rows } = await pool.query('SELECT * FROM check_books ORDER BY created_at');
    res.json({ books: rows.map(r => ({
      id:r.id, name:r.name, bank:r.bank, account:r.account,
      pages:r.pages, note:r.note,
      firstNum: r.first_num||1, lastNum: r.last_num||null
    })) });
  } catch(e) {
    console.error('❌ GET /api/check-books error:', e.message, e.stack);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/check-books', adminAuth, async (req, res) => {
  try {
    const { id, name, bank, account, pages, note, firstNum, lastNum } = req.body;
    console.log('📘 POST /api/check-books body:', JSON.stringify(req.body));

    if (!DB_ENABLED){
      console.log('⚠️ DB not enabled, returning mock response');
      return res.json({ book: req.body });
    }

    if (!id || !name) {
      console.warn('❌ Missing id or name:', { id, name });
      return res.status(400).json({ error: 'id and name are required' });
    }

    // إضافة first_num و last_num columns لو مش موجودة (في try منفصل عشان مايكسرش الـ INSERT)
    try{
      await pool.query("ALTER TABLE check_books ADD COLUMN IF NOT EXISTS first_num INTEGER DEFAULT 1");
      await pool.query("ALTER TABLE check_books ADD COLUMN IF NOT EXISTS last_num INTEGER");
    }catch(e){ console.warn('alter check_books:', e.message); }

    // 🆕 v76: استخدام client مخصص عشان نتجنب pool connection issues
    const client = await pool.connect();
    try {
      console.log('💾 Inserting book into DB:', id);
      const result = await client.query(
        `INSERT INTO check_books (id, name, bank, account, pages, note, first_num, last_num)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           bank = EXCLUDED.bank,
           account = EXCLUDED.account,
           pages = EXCLUDED.pages,
           note = EXCLUDED.note,
           first_num = EXCLUDED.first_num,
           last_num = EXCLUDED.last_num
         RETURNING *`,
        [
          String(id),
          String(name),
          String(bank || ''),
          String(account || ''),
          parseInt(pages) || 48,
          String(note || ''),
          parseInt(firstNum) || 1,
          lastNum ? parseInt(lastNum) : null
        ]
      );

      console.log('✅ Book saved successfully:', result.rows[0]?.id);
      res.json({ book: result.rows[0] });
    } finally {
      client.release();
    }
  } catch(e) {
    console.error('❌ POST /api/check-books error:', e.message);
    console.error('❌ Stack:', e.stack);
    console.error('❌ Body was:', JSON.stringify(req.body));
    res.status(500).json({ error: e.message, code: e.code, detail: e.detail });
  }
});

app.delete('/api/check-books/:id', adminAuth, async (req, res) => {
  if (!DB_ENABLED) return res.json({ ok: true });
  try {
    await pool.query('DELETE FROM check_books WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) {
    console.error('❌ DELETE /api/check-books error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ===== VENDORS API =====
app.get('/api/vendors', adminAuth, async (req, res) => {
  if (!DB_ENABLED) return res.json({ vendors: [] });
  try {
    const { rows } = await pool.query('SELECT * FROM vendors ORDER BY name ASC');
    res.json({ vendors: rows.map(r => ({
      id: r.id,
      name: r.name,
      phone: r.phone || '',
      note: r.note || '',
      createdAt: r.created_at,
    })) });
  } catch(e) {
    console.error('❌ GET /api/vendors error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/vendors', adminAuth, async (req, res) => {
  if (!DB_ENABLED) return res.json({ vendor: req.body });
  try {
    const { id, name, phone, note } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'الاسم مطلوب' });
    }
    const finalId = id || ('v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
    const finalName = String(name).trim();
    const result = await pool.query(
      `INSERT INTO vendors (id, name, phone, note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET
         phone = EXCLUDED.phone,
         note = EXCLUDED.note
       RETURNING *`,
      [finalId, finalName, String(phone || '').trim(), String(note || '').trim()]
    );
    const r = result.rows[0];
    res.json({ vendor: { id: r.id, name: r.name, phone: r.phone || '', note: r.note || '' } });
  } catch(e) {
    console.error('❌ POST /api/vendors error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/vendors/:id', adminAuth, async (req, res) => {
  if (!DB_ENABLED) return res.json({ ok: true });
  try {
    const { name, phone, note } = req.body;
    const sets = [];
    const vals = [];
    if (name !== undefined) { sets.push(`name=$${vals.length+1}`); vals.push(String(name).trim()); }
    if (phone !== undefined) { sets.push(`phone=$${vals.length+1}`); vals.push(String(phone || '').trim()); }
    if (note !== undefined) { sets.push(`note=$${vals.length+1}`); vals.push(String(note || '').trim()); }
    if (!sets.length) return res.status(400).json({ error: 'لا يوجد بيانات للتحديث' });
    vals.push(req.params.id);
    const result = await pool.query(
      `UPDATE vendors SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`,
      vals
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'المورد غير موجود' });
    const r = result.rows[0];
    res.json({ vendor: { id: r.id, name: r.name, phone: r.phone || '', note: r.note || '' } });
  } catch(e) {
    console.error('❌ PATCH /api/vendors error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/vendors/:id', adminAuth, async (req, res) => {
  if (!DB_ENABLED) return res.json({ ok: true });
  try {
    // ⚠️ شيك إذا كان فيه شيكات للمورد ده
    const checkR = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM checks
       WHERE payee = (SELECT name FROM vendors WHERE id=$1)`,
      [req.params.id]
    );
    const checksCount = checkR.rows[0]?.cnt || 0;
    if (checksCount > 0 && !req.query.force) {
      return res.status(409).json({
        error: 'المورد له شيكات',
        checksCount,
        message: `هذا المورد له ${checksCount} شيك. أضف ?force=1 للحذف رغم ذلك (الشيكات هتتحفظ بنفس الاسم).`
      });
    }
    await pool.query('DELETE FROM vendors WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) {
    console.error('❌ DELETE /api/vendors error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ===== CHECKS API =====
app.get('/api/checks', adminAuth, async (req, res) => {
  if (!DB_ENABLED) return res.json({ checks: [] });
  try {
    const { rows } = await pool.query('SELECT * FROM checks ORDER BY date ASC');
    res.json({ checks: rows.map(r => ({
      id:r.id, num:r.num, payee:r.payee, amount:parseFloat(r.amount),
      date:r.date ? r.date.toISOString().slice(0,10) : '',
      bookId:r.book_id, invoice:r.invoice, note:r.note,
      img:r.img, status:r.status,
      doneAt:r.done_at, createdAt:r.created_at,
    })) });
  } catch(e) {
    console.error('❌ GET /api/checks error:', e.message, e.stack);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/checks', adminAuth, async (req, res) => {
  if (!DB_ENABLED) return res.json({ check: req.body });
  try {
    const { id, num, payee, amount, date, bookId, invoice, note, img, status, doneAt } = req.body;
    await pool.query(
      `INSERT INTO checks (id,num,payee,amount,date,book_id,invoice,note,img,status,done_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
       num=$2,payee=$3,amount=$4,date=$5,book_id=$6,invoice=$7,note=$8,img=$9,status=$10,done_at=$11`,
      [id, num, payee, amount||0, date||null, bookId||null, invoice||'', note||'', img||'', status||'pending', doneAt||null]
    );
    res.json({ check: req.body });
  } catch(e) {
    console.error('❌ POST /api/checks error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/checks/:id', adminAuth, async (req, res) => {
  if (!DB_ENABLED) return res.json({ ok: true });
  try {
    await pool.query('DELETE FROM checks WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) {
    console.error('❌ DELETE /api/checks error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Sync bulk - يستقبل كل الشيكات والدفاتر مرة واحدة
app.post('/api/sync-checks', adminAuth, async (req, res) => {
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
const SERVER_VERSION = 'v110-2026-04-30-bosta-flag-and-express-ship-fix';
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

// ===== Diagnostic: list all registered routes =====
app.get('/api/_routes', adminAuth, (req, res) => {
  const routes = [];
  app._router.stack.forEach(layer => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase()).join(',');
      routes.push(`${methods} ${layer.route.path}`);
    }
  });
  res.json({
    version: SERVER_VERSION,
    totalRoutes: routes.length,
    hasPreparationOrders: routes.some(r => r.includes('/api/preparation/orders')),
    routes: routes.sort()
  });
});

// ===== START =====
// (wrapper removed: each endpoint checks DB_ENABLED individually)
// ===== SETTLEMENTS API =====

// جيب كل تسويات مندوب
app.get('/api/settlements/:courierId', adminAuth, async (req, res) => {
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
app.get('/api/settlements', adminAuth, async (req, res) => {
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
app.post('/api/settlements', adminAuth, async (req, res) => {
  const {courierId, ts, orderIds, cod, ship, notes, adj, adjustmentIds} = req.body;
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
    const settlementId = r.rows[0].id;

    // حدّث settled في couriers
    await pool.query(
      'UPDATE couriers SET settled=true WHERE id=$1',
      [courierId]
    );

    // 🆕 v90: حدّث الطلبات نفسها لـ "مسوّى" — ده اللي كان ناقص!
    // بدون ده الطلبات بتفضل status="جاري التوصيل" و بتظهر للمندوب
    if(orderIds && orderIds.length){
      const updateResult = await pool.query(
        `UPDATE orders
         SET status='مسوّى',
             settled_at=NOW(),
             updated_at=NOW()
         WHERE id = ANY($1) AND status IN ('جاري التوصيل', 'مرتجع', 'تحت التسوية')
         RETURNING id`,
        [orderIds]
      );
      console.log(`✅ Settlement ${settlementId}: updated ${updateResult.rows.length}/${orderIds.length} orders to مسوّى`);
    }

    // 🆕 v96: اربط الـ approved adjustments بهذه التسوية عشان مايظهروش في تسوية تانية
    // فيه طريقتين: lo الـ frontend بعت adjustmentIds استخدمهم، وإلا اربط كل الـ approved للمندوب
    try{
      let linkResult;
      if(Array.isArray(adjustmentIds) && adjustmentIds.length){
        linkResult = await pool.query(
          `UPDATE courier_adjustments
           SET settlement_id=$1
           WHERE id = ANY($2) AND courier_id=$3 AND status='approved' AND settlement_id IS NULL
           RETURNING id`,
          [settlementId, adjustmentIds, courierId]
        );
      } else {
        // fallback: اربط كل الـ approved adjustments للمندوب اللي مش متربطين
        linkResult = await pool.query(
          `UPDATE courier_adjustments
           SET settlement_id=$1
           WHERE courier_id=$2 AND status='approved' AND settlement_id IS NULL
           RETURNING id`,
          [settlementId, courierId]
        );
      }
      if(linkResult.rows.length){
        console.log(`🔗 Settlement ${settlementId}: linked ${linkResult.rows.length} approved adjustments`);
      }
    }catch(linkErr){
      console.warn('⚠️ Failed to link adjustments to settlement:', linkErr.message);
    }

    res.json({success:true, id:settlementId});
  }catch(e){
    console.error('❌ POST /api/settlements error:', e.message);
    res.status(500).json({error:e.message});
  }
});

// 🆕 v90: endpoint لإصلاح طلبات اتسوّت لكن status لسه "جاري التوصيل"
// يستخدم لمرة واحدة لتنظيف البيانات الحالية
// 🆕 v91: diagnostic endpoint — يشيك على طلب معين ايه حالته ولماذا
app.get('/api/admin/diagnose-order/:orderId', adminAuth, async (req, res) => {
  if(!DB_ENABLED) return res.status(503).json({error:'DB unavailable'});
  const orderId = req.params.orderId;
  try{
    // 1) الحالة الحالية للطلب
    const orderR = await pool.query(
      'SELECT id, status, courier_id, settled_at, updated_at FROM orders WHERE id=$1 OR id=$2',
      [orderId, 'SH-' + orderId.replace(/^SH-/, '')]
    );

    // 2) كل الـ settlements اللي ممكن يكون فيهم الطلب
    const settleR = await pool.query(`
      SELECT id, courier_id, ts, order_ids, cod, ship
      FROM settlements
      WHERE order_ids LIKE $1 OR order_ids LIKE $2
      ORDER BY ts DESC
    `, ['%"' + orderId + '"%', '%"SH-' + orderId.replace(/^SH-/, '') + '"%']);

    // 3) جرب الـ JSON parsing للـ order_ids
    const settlements = settleR.rows.map(s => {
      let parsedIds = null;
      let parseError = null;
      try{
        parsedIds = JSON.parse(s.order_ids || '[]');
      } catch(e) {
        parseError = e.message;
      }
      return {
        id: s.id,
        courierId: s.courier_id,
        ts: s.ts,
        rawOrderIds: s.order_ids,
        parsedOrderIds: parsedIds,
        parseError,
        containsOurOrder: parsedIds ? parsedIds.includes(orderId) || parsedIds.includes('SH-' + orderId) : null,
        cod: s.cod,
      };
    });

    res.json({
      orderId,
      orderInDB: orderR.rows[0] || null,
      settlementCount: settleR.rows.length,
      settlements,
    });
  } catch(e) {
    res.status(500).json({error: e.message, stack: e.stack});
  }
});

// 🆕 v91: fix endpoint محسّن — يستخدم LIKE بدل jsonb (الـ jsonb بيفشل لو فيه أي escape characters)
app.post('/api/admin/fix-settled-orders-v2', adminAuth, async (req, res) => {
  if(!DB_ENABLED) return res.status(503).json({error:'DB unavailable'});
  try{
    // الخطوة 1: جيب كل الـ settlements
    const settleR = await pool.query('SELECT id, order_ids FROM settlements');

    // الخطوة 2: استخرج كل الـ order ids من JSON manually في JS (أكثر مرونة من jsonb)
    const orderIdsToFix = new Set();
    let parseFailures = 0;
    for(const s of settleR.rows){
      try{
        const ids = JSON.parse(s.order_ids || '[]');
        if(Array.isArray(ids)) ids.forEach(id => id && orderIdsToFix.add(id));
      } catch(e) {
        parseFailures++;
      }
    }

    if(!orderIdsToFix.size){
      return res.json({success: true, fixedCount: 0, message: 'مفيش طلبات في settlements', parseFailures});
    }

    // الخطوة 3: حدّث الطلبات
    const idsArray = Array.from(orderIdsToFix);
    const updateR = await pool.query(`
      UPDATE orders
      SET status='مسوّى',
          settled_at=COALESCE(settled_at, NOW()),
          updated_at=NOW()
      WHERE id = ANY($1)
        AND status IN ('جاري التوصيل', 'مرتجع', 'تحت التسوية', 'جديد')
      RETURNING id, status
    `, [idsArray]);

    res.json({
      success: true,
      totalSettlementOrders: orderIdsToFix.size,
      fixedCount: updateR.rows.length,
      fixedIds: updateR.rows.map(x => x.id),
      parseFailures,
    });
  } catch(e) {
    console.error('Fix settled orders v2 error:', e.message);
    res.status(500).json({error: e.message});
  }
});

app.post('/api/admin/fix-settled-orders', adminAuth, async (req, res) => {
  if(!DB_ENABLED) return res.status(503).json({error:'DB unavailable'});
  try{
    // كل الطلبات اللي موجودة في settlements لكن status لسه "جاري التوصيل"
    const r = await pool.query(`
      WITH settled_order_ids AS (
        SELECT DISTINCT jsonb_array_elements_text(order_ids::jsonb) AS oid
        FROM settlements
      )
      UPDATE orders
      SET status='مسوّى',
          settled_at=COALESCE(settled_at, NOW()),
          updated_at=NOW()
      WHERE id IN (SELECT oid FROM settled_order_ids)
        AND status IN ('جاري التوصيل', 'مرتجع', 'تحت التسوية')
      RETURNING id
    `);
    res.json({success:true, fixedCount: r.rows.length, fixedIds: r.rows.map(x=>x.id)});
  }catch(e){
    console.error('Fix settled orders error:', e.message);
    res.status(500).json({error:e.message});
  }
});

// حذف تسوية (للتراجع)
app.delete('/api/settlements/:id', adminAuth, async (req, res) => {
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
app.get('/api/users', adminAuth, async (req, res) => {
  if(!DB_ENABLED) return res.json({users:[]});
  try{
    // 🆕 v102: ما نرجعش pass_hash للأمان
    const r = await pool.query('SELECT username,name,pages,active,created_at FROM users ORDER BY created_at');
    res.json({users: r.rows.map(u=>({
      username: u.username, name: u.name,
      pages: JSON.parse(u.pages||'[]'), active: u.active,
      createdAt: u.created_at,
    }))});
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/users', adminAuth, async (req, res) => {
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

app.delete('/api/users/:username', adminAuth, async (req, res) => {
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
      // 🆕 v102: أنشئ session token
      const token = _generateToken();
      const expires = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 يوم
      _adminSessions.set(token, {
        username: u.username,
        name: u.name,
        pages: JSON.parse(u.pages||'[]'),
        expires,
      });
      try{
        const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '';
        const ua = req.headers['user-agent'] || '';
        await pool.query(
          `INSERT INTO admin_sessions (token, username, expires_at, ip, user_agent)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (token) DO NOTHING`,
          [token, u.username, new Date(expires), ip.toString().slice(0, 100), ua.slice(0, 200)]
        );
      }catch(e){ console.warn('Failed to persist admin session:', e.message); }

      // 🔧 v105: لو username='admin'، خليه role='admin' عشان الـ frontend يديله صلاحيات كاملة
      const role = (u.username === 'admin') ? 'admin' : 'custom';
      res.json({
        found: true,
        token,
        user: { username: u.username, name: u.name, pages: JSON.parse(u.pages||'[]'), role, active: true }
      });
    } else {
      res.json({found:false});
    }
  }catch(e){ res.status(500).json({error:e.message}); }
});

// 🆕 v102: GET /api/admin/me — تحقق من الـ token
app.get('/api/admin/me', adminAuth, async (req, res) => {
  res.json({ user: req.adminUser });
});

// 🆕 v102: POST /api/admin/logout — مسح الـ session
app.post('/api/admin/logout', adminAuth, async (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  _adminSessions.delete(token);
  if(DB_ENABLED){
    pool.query('DELETE FROM admin_sessions WHERE token=$1', [token]).catch(()=>{});
  }
  res.json({success: true});
});

// ============================================================
// ===== CAFELAX STARS — Courier Mobile App Endpoints =====
// ============================================================

// Simple courier session tokens (in-memory, 24h TTL)
const _courierSessions = new Map(); // token -> {courierId, expires} — cache only
const _shopSessions = new Map(); // token -> {shopUserId, username, expires} — cache only
// 🆕 v102: Admin sessions
const _adminSessions = new Map(); // token -> {username, name, pages, expires}

function _generateToken(){
  return crypto.randomBytes(32).toString('hex');
}

// 🆕 v89: نضمن جدول courier_sessions موجود (للـ persistence عبر restarts)
async function _ensureSessionsTable(){
  if(!DB_ENABLED) return;
  try{
    await pool.query(`
      CREATE TABLE IF NOT EXISTS courier_sessions (
        token TEXT PRIMARY KEY,
        courier_id TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_courier_sessions_expires ON courier_sessions(expires_at)`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shop_sessions (
        token TEXT PRIMARY KEY,
        shop_user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_shop_sessions_expires ON shop_sessions(expires_at)`);
    // 🆕 v102: Admin sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        token TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        ip TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at)`);
    console.log('✅ Sessions tables ready');
  }catch(e){
    console.warn('⚠️ Sessions table init failed:', e.message);
  }
}
_ensureSessionsTable();

// 🆕 v104: تأكد إن admin user موجود في DB عشان يقدر ياخد token
async function _ensureAdminUser(){
  if(!DB_ENABLED) return;
  try{
    // hash لـ password ثابتة معروفة في الـ frontend (ADMIN_USER.passHash)
    const ADMIN_HASH = 'b6623210b82535beb2fe64e288d05a937d29da5d73522814631ca811de9f0ba5';
    const r = await pool.query(
      `INSERT INTO users (username, name, pass_hash, pages, active)
       VALUES ('admin', 'المدير', $1, '[]', true)
       ON CONFLICT (username) DO UPDATE
         SET pass_hash = EXCLUDED.pass_hash, active = true
         WHERE users.pass_hash IS NULL OR users.pass_hash = ''`,
      [ADMIN_HASH]
    );
    console.log('✅ Admin user verified/created');
  }catch(e){
    console.warn('⚠️ Admin user init failed:', e.message);
  }
}
_ensureAdminUser();

async function _cleanupExpiredSessions(){
  const now = Date.now();
  // مسح من الـ memory cache
  for(const [token, session] of _courierSessions.entries()){
    if(session.expires < now) _courierSessions.delete(token);
  }
  for(const [token, session] of _shopSessions.entries()){
    if(session.expires < now) _shopSessions.delete(token);
  }
  // مسح من الـ DB
  if(DB_ENABLED){
    try{
      await pool.query('DELETE FROM courier_sessions WHERE expires_at < NOW()');
      await pool.query('DELETE FROM shop_sessions WHERE expires_at < NOW()');
    }catch(e){}
  }
}
setInterval(_cleanupExpiredSessions, 60 * 60 * 1000); // every hour

// 🆕 v89: helper لتحميل session من الـ DB لو مش في الـ cache
async function _loadCourierSessionFromDB(token){
  if(!DB_ENABLED) return null;
  try{
    const r = await pool.query(
      'SELECT courier_id, expires_at FROM courier_sessions WHERE token=$1 AND expires_at > NOW()',
      [token]
    );
    if(!r.rows.length) return null;
    const session = {
      courierId: r.rows[0].courier_id,
      expires: new Date(r.rows[0].expires_at).getTime()
    };
    _courierSessions.set(token, session); // cache it
    return session;
  }catch(e){ return null; }
}

async function _loadShopSessionFromDB(token){
  if(!DB_ENABLED) return null;
  try{
    const r = await pool.query(
      'SELECT shop_user_id, username, expires_at FROM shop_sessions WHERE token=$1 AND expires_at > NOW()',
      [token]
    );
    if(!r.rows.length) return null;
    const session = {
      shopUserId: r.rows[0].shop_user_id,
      username: r.rows[0].username,
      expires: new Date(r.rows[0].expires_at).getTime()
    };
    _shopSessions.set(token, session);
    return session;
  }catch(e){ return null; }
}

// Middleware: validates courier token
// 🆕 v102: Admin authentication middleware
async function _loadAdminSessionFromDB(token){
  if(!DB_ENABLED) return null;
  try{
    const r = await pool.query(
      `SELECT s.username, s.expires_at, u.name, u.pages, u.active
       FROM admin_sessions s
       LEFT JOIN users u ON u.username = s.username
       WHERE s.token=$1 AND s.expires_at > NOW()`,
      [token]
    );
    if(!r.rows.length) return null;
    if(!r.rows[0].active) return null; // user deactivated
    const session = {
      username: r.rows[0].username,
      name: r.rows[0].name || r.rows[0].username,
      pages: JSON.parse(r.rows[0].pages || '[]'),
      expires: new Date(r.rows[0].expires_at).getTime(),
    };
    _adminSessions.set(token, session);
    return session;
  }catch(e){ return null; }
}

async function adminAuth(req, res, next){
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if(!token) return res.status(401).json({error: 'No admin token'});

  let session = _adminSessions.get(token);
  if(!session){
    session = await _loadAdminSessionFromDB(token);
  }
  if(!session) return res.status(401).json({error: 'Invalid or expired admin token'});

  if(session.expires < Date.now()){
    _adminSessions.delete(token);
    if(DB_ENABLED){
      pool.query('DELETE FROM admin_sessions WHERE token=$1', [token]).catch(()=>{});
    }
    return res.status(401).json({error: 'Admin session expired'});
  }

  req.adminUser = {
    username: session.username,
    name: session.name,
    pages: session.pages,
  };
  next();
}

async function courierAuth(req, res, next){
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if(!token) return res.status(401).json({error: 'No token'});

  // الأول جرب الـ cache (سريع)
  let session = _courierSessions.get(token);

  // لو مش في الـ cache، جرب الـ DB (بيحصل بعد restart)
  if(!session){
    session = await _loadCourierSessionFromDB(token);
  }

  if(!session) return res.status(401).json({error: 'Invalid or expired token'});

  if(session.expires < Date.now()){
    _courierSessions.delete(token);
    if(DB_ENABLED){
      pool.query('DELETE FROM courier_sessions WHERE token=$1', [token]).catch(()=>{});
    }
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
    // 🆕 v89: 30 يوم بدل 24 ساعة عشان المناديب ما يضطروش يسجلوا دخول كل يوم
    const expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
    _courierSessions.set(token, {courierId: courier.id, expires});

    // 🆕 v89: احفظ في الـ DB كمان عشان تفضل لما السيرفر يعيد التشغيل
    try{
      await pool.query(
        `INSERT INTO courier_sessions (token, courier_id, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (token) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
        [token, courier.id, new Date(expires)]
      );
    }catch(e){ console.warn('Failed to persist session:', e.message); }

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

// 🆕 v97: GET /api/courier/dashboard — إحصائيات شاملة للمندوب
app.get('/api/courier/dashboard', courierAuth, async (req, res) => {
  if (!DB_ENABLED) return res.json({});
  try{
    const data = await _computeCourierDashboard(req.courierId);
    res.json(data);
  }catch(e){
    console.error('dashboard error:', e.message, e.stack);
    res.status(500).json({error: e.message});
  }
});

// 🆕 v98: GET /api/admin/courier-dashboard/:courierId — للأدمن في OrderPro
// يديله نفس الـ dashboard data لأي مندوب
app.get('/api/admin/courier-dashboard/:courierId', adminAuth, async (req, res) => {
  if (!DB_ENABLED) return res.json({});
  try{
    const cId = parseInt(req.params.courierId);
    if (!cId) return res.status(400).json({error: 'invalid courier id'});
    const data = await _computeCourierDashboard(cId);
    // أضف معلومات المندوب للـ response
    const cR = await pool.query('SELECT id, name, phone, zone FROM couriers WHERE id=$1', [cId]);
    data.courier = cR.rows[0] || null;
    res.json(data);
  }catch(e){
    console.error('admin courier-dashboard error:', e.message, e.stack);
    res.status(500).json({error: e.message});
  }
});

// 🆕 v98: helper — يحسب الـ dashboard data لمندوب معين
async function _computeCourierDashboard(courierId){
  // 1) كل الطلبات اللي اتسلمت في فترات مختلفة (مع courier_delivered_at OR settled_at)
  const baseQ = `
    WITH delivered AS (
      SELECT
        o.id, o.total, o.ship, o.area, o.assigned_zone, o.paid, o.status,
        COALESCE(o.courier_delivered_at, o.settled_at, o.updated_at) AS done_at,
        COALESCE(o.picked_up_at, o.updated_at) AS picked_at,
        o.created_at,
        EXTRACT(EPOCH FROM (COALESCE(o.courier_delivered_at, o.settled_at) - o.created_at))/3600 AS hours_total
      FROM orders o
      WHERE o.courier_id = $1
        AND o.status IN ('مكتمل', 'مسوّى', 'تم التسليم')
        AND (o.merged_into IS NULL OR o.merged_into = '')
    )
    SELECT * FROM delivered
  `;
  const allDel = await pool.query(baseQ, [courierId]);
  const orders = allDel.rows;

  // helper: filter orders بفترة
  const inRange = (days) => {
    const now = Date.now();
    const since = now - days * 24 * 60 * 60 * 1000;
    return orders.filter(o => o.done_at && new Date(o.done_at).getTime() >= since);
  };

  const inMonth = (offsetMonths) => {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() - offsetMonths, 1);
    const next = new Date(target.getFullYear(), target.getMonth() + 1, 1);
    return orders.filter(o => {
      if (!o.done_at) return false;
      const t = new Date(o.done_at);
      return t >= target && t < next;
    });
  };

  const sumShip = (arr) => arr.reduce((s,o) => s + (parseFloat(o.ship) || 0), 0);
  const sumCod = (arr) => arr.reduce((s,o) => s + (o.paid ? 0 : (parseFloat(o.total) || 0)), 0);

  const last7 = inRange(7);
  const last30 = inRange(30);
  const lastMonth = inMonth(1);
  const thisMonth = inMonth(0);

  const avgDaily = last30.length / 30;

  const validHours = last30.filter(o => o.hours_total != null && o.hours_total >= 0 && o.hours_total < 24*7);
  const avgHours = validHours.length
    ? validHours.reduce((s, o) => s + parseFloat(o.hours_total), 0) / validHours.length
    : 0;

  const totalLifetime = orders.length;
  const totalEarnings = sumShip(orders);

  const allAssignedQ = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE status IN ('مكتمل', 'مسوّى', 'تم التسليم')) as done,
            COUNT(*) FILTER (WHERE status IN ('مرتجع', 'ملغي بالميدان')) as failed,
            COUNT(*) AS total
     FROM orders
     WHERE courier_id = $1
       AND (merged_into IS NULL OR merged_into = '')
       AND status NOT IN ('في الانتظار', 'جديد', 'جاري التوصيل')`,
    [courierId]
  );
  const a = allAssignedQ.rows[0];
  const successRate = (parseInt(a.total) > 0)
    ? (parseInt(a.done) / parseInt(a.total)) * 100
    : 0;
  const returnRate = (parseInt(a.total) > 0)
    ? (parseInt(a.failed) / parseInt(a.total)) * 100
    : 0;

  const dayMap = {};
  orders.forEach(o => {
    if (!o.done_at) return;
    const d = new Date(o.done_at).toISOString().slice(0, 10);
    dayMap[d] = (dayMap[d] || 0) + 1;
  });
  let peakDay = null, peakCount = 0;
  for (const [d, c] of Object.entries(dayMap)) {
    if (c > peakCount) { peakCount = c; peakDay = d; }
  }

  let streak = 0;
  let cursor = new Date();
  for (let i = 0; i < 365; i++) {
    const dStr = cursor.toISOString().slice(0, 10);
    if (dayMap[dStr]) {
      streak++;
    } else if (i === 0) {
      // النهاردة لو فاضي، نشوف امبارح
    } else {
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  const zoneMap = {};
  last30.forEach(o => {
    const z = o.assigned_zone || o.area || 'غير محدد';
    zoneMap[z] = (zoneMap[z] || 0) + 1;
  });
  const topZones = Object.entries(zoneMap)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 5)
    .map(([zone, count]) => ({ zone, count }));

  const dailyChart = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().slice(0, 10);
    dailyChart.push({
      date: dStr,
      count: dayMap[dStr] || 0,
    });
  }

  const rankQ = await pool.query(
    `WITH stats AS (
       SELECT courier_id, COUNT(*) AS cnt
       FROM orders
       WHERE status IN ('مكتمل', 'مسوّى', 'تم التسليم')
         AND COALESCE(courier_delivered_at, settled_at, updated_at) >= NOW() - INTERVAL '30 days'
         AND (merged_into IS NULL OR merged_into = '')
         AND courier_id IS NOT NULL
       GROUP BY courier_id
     )
     SELECT
       (SELECT COUNT(*) FROM stats WHERE cnt > (SELECT cnt FROM stats WHERE courier_id=$1)) AS rank,
       (SELECT COUNT(*) FROM stats) AS total,
       (SELECT cnt FROM stats WHERE courier_id=$1) AS my_count,
       (SELECT AVG(cnt) FROM stats) AS avg_count`,
    [courierId]
  );
  const ranking = rankQ.rows[0] || {};
  const myRank = parseInt(ranking.rank) + 1;
  const totalCouriers = parseInt(ranking.total) || 1;
  const myCount = parseInt(ranking.my_count) || 0;
  const avgCount = parseFloat(ranking.avg_count) || 0;
  const percentile = totalCouriers > 0
    ? Math.round(((totalCouriers - myRank + 1) / totalCouriers) * 100)
    : 0;

  const achievements = [];
  const milestones = [10, 50, 100, 250, 500, 1000, 2500, 5000];
  milestones.forEach(m => {
    if (totalLifetime >= m) achievements.push({
      icon: m >= 1000 ? '🏆' : m >= 250 ? '🥇' : m >= 50 ? '🥈' : '🥉',
      label: `${m}+ طلب`,
      unlocked: true,
    });
  });
  const next = milestones.find(m => m > totalLifetime);
  if (next) achievements.push({
    icon: '🔒',
    label: `${next} طلب`,
    unlocked: false,
    progress: Math.round((totalLifetime / next) * 100),
    remaining: next - totalLifetime,
  });

  const monthChange = lastMonth.length > 0
    ? Math.round(((thisMonth.length - lastMonth.length) / lastMonth.length) * 100)
    : (thisMonth.length > 0 ? 100 : 0);

  return {
    last7: { count: last7.length, earnings: sumShip(last7), cod: sumCod(last7) },
    last30: { count: last30.length, earnings: sumShip(last30), cod: sumCod(last30) },
    lastMonth: { count: lastMonth.length, earnings: sumShip(lastMonth), cod: sumCod(lastMonth) },
    thisMonth: { count: thisMonth.length, earnings: sumShip(thisMonth), cod: sumCod(thisMonth) },
    lifetime: { count: totalLifetime, earnings: totalEarnings },

    avgDailyOrders: parseFloat(avgDaily.toFixed(1)),
    avgDeliveryHours: parseFloat(avgHours.toFixed(1)),
    successRate: parseFloat(successRate.toFixed(1)),
    returnRate: parseFloat(returnRate.toFixed(1)),

    peakDay,
    peakCount,
    streak,

    topZones,
    dailyChart,

    ranking: {
      rank: myRank,
      total: totalCouriers,
      myCount,
      avgCount: parseFloat(avgCount.toFixed(1)),
      percentile,
    },

    achievements,
    monthChange,
  };
}

// GET /api/courier/my-orders — كل طلبات المندوب مقسمة حسب الحالة
app.get('/api/courier/my-orders', courierAuth, async (req, res) => {
  try{
    // الطلبات النشطة (جاري التوصيل، مع/في المحل)
    // نستخدم SELECT * ونشيل awb base64 يدوياً (تجنب أي عمود غير موجود)
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
    r.rows.forEach(row => { delete row.bosta_awb_base64; });

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
    todayR.rows.forEach(row => { delete row.bosta_awb_base64; });
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
    cancelledR.rows.forEach(row => { delete row.bosta_awb_base64; });
    const cancelled = cancelledR.rows.map(o => _mapOrderForCourier(o));

    // 🆕 v108: جيب قائمة المناديب الآخرين (للـ transfer requests)
    let couriers = [];
    try{
      const cR = await pool.query(
        `SELECT id, name, zone FROM couriers WHERE id != $1 ORDER BY name`,
        [req.courierId]
      );
      couriers = cR.rows;
    }catch(e){ /* silent — fallback لو في schema مختلف */ }

    res.json({withMe, newOrders, completed, cancelled, couriers});
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
    // 🆕 v108: lineItemsJson فيه التفاصيل الكاملة للمنتجات (للتسليم الجزئي)
    lineItemsJson: r.line_items_json || null,
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

// 🆕 v108: POST /api/courier/orders/:id/partial-deliver — تسليم جزئي
// body: {
//   deliveredItems: [{name, quantity, price}],  // المنتجات اللي اتسلمت
//   returnedItems: [{name, quantity, price}],   // المنتجات اللي رجعت
//   collectedAmount: number,                     // المبلغ المُحصَّل
//   returnReason: string                         // سبب الإرجاع (اختياري)
// }
// النتيجة:
//   - الطلب الأصلي يتعدّل: items=delivered, total=collectedAmount, status='تحت التسوية'
//   - يتعمل طلب جديد بـ id جديد للمنتجات المُرجعة بحالة 'ملغي' + cancelled_by_field=true
app.post('/api/courier/orders/:id/partial-deliver', courierAuth, async (req, res) => {
  const {id} = req.params;
  const { deliveredItems, returnedItems, collectedAmount, returnReason } = req.body || {};
  
  // التحقق من صحة البيانات
  if(!Array.isArray(deliveredItems) || deliveredItems.length === 0){
    return res.status(400).json({error: 'لازم تختار منتج واحد على الأقل اتسلم'});
  }
  if(!Array.isArray(returnedItems) || returnedItems.length === 0){
    return res.status(400).json({error: 'لازم يكون في منتج واحد على الأقل مرتجع (لو الكل اتسلم استخدم تم التسليم العادي)'});
  }
  if(typeof collectedAmount !== 'number' || collectedAmount < 0){
    return res.status(400).json({error: 'المبلغ المُحصَّل غير صحيح'});
  }
  
  try{
    // تحقق إن الطلب فعلاً للمندوب ده
    const chk = await pool.query('SELECT * FROM orders WHERE id=$1', [id]);
    if(!chk.rows.length) return res.status(404).json({error: 'الطلب غير موجود'});
    const o = chk.rows[0];
    if(String(o.courier_id) !== String(req.courierId)){
      return res.status(403).json({error: 'الطلب ده مش ليك'});
    }
    if(o.status !== 'جاري التوصيل'){
      return res.status(400).json({error: 'الطلب لا يمكن تسليمه في حالته الحالية'});
    }
    
    // 1️⃣ تعديل الطلب الأصلي: المنتجات المُسلَّمة + المبلغ المُحصَّل + status='تحت التسوية'
    const deliveredItemsJson = JSON.stringify(deliveredItems);
    await pool.query(
      `UPDATE orders SET
        status='تحت التسوية',
        courier_delivered_at=NOW(),
        items=$2,
        total=$3,
        order_note=COALESCE(order_note, '') || $4,
        updated_at=NOW()
       WHERE id=$1`,
      [
        id, 
        deliveredItemsJson, 
        collectedAmount,
        `\n[تسليم جزئي] تم تسليم جزء من الطلب — راجع الطلب رقم ${id}-R للجزء المُرجَع`
      ]
    );
    
    // 2️⃣ إنشاء طلب جديد للمنتجات المُرجَعة (بحالة ملغي + cancelled_by_field)
    const returnedId = `${id}-R`;
    const returnedItemsJson = JSON.stringify(returnedItems);
    const returnedTotal = returnedItems.reduce((sum, item) => {
      return sum + (parseFloat(item.price || 0) * parseInt(item.quantity || 1));
    }, 0);
    
    // تأكد إن الـ id مش موجود بالفعل
    const existR = await pool.query('SELECT id FROM orders WHERE id=$1', [returnedId]);
    if(existR.rows.length){
      // لو موجود، نستخدم timestamp
      const altId = `${id}-R-${Date.now().toString(36).slice(-4)}`;
      await pool.query(
        `INSERT INTO orders (
          id, src, name, phone, area, addr, total, ship, courier_id, 
          status, paid, items, note, order_note, 
          cancelled_by_field, cancelled_at, cancellation_reason,
          created_at, updated_at
        ) VALUES (
          $1, 'partial_return', $2, $3, $4, $5, $6, 0, $7,
          'ملغي', false, $8, $9, $10,
          true, NOW(), $11,
          NOW(), NOW()
        )`,
        [
          altId, o.name, o.phone, o.area, o.addr, returnedTotal, req.courierId,
          returnedItemsJson,
          `إرجاع جزئي من الطلب الأصلي #${id}`,
          `[إرجاع جزئي] منتجات لم يستلمها العميل من الطلب #${id}`,
          returnReason || 'تسليم جزئي - العميل لم يستلم كل المنتجات'
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO orders (
          id, src, name, phone, area, addr, total, ship, courier_id, 
          status, paid, items, note, order_note,
          cancelled_by_field, cancelled_at, cancellation_reason,
          created_at, updated_at
        ) VALUES (
          $1, 'partial_return', $2, $3, $4, $5, $6, 0, $7,
          'ملغي', false, $8, $9, $10,
          true, NOW(), $11,
          NOW(), NOW()
        )`,
        [
          returnedId, o.name, o.phone, o.area, o.addr, returnedTotal, req.courierId,
          returnedItemsJson,
          `إرجاع جزئي من الطلب الأصلي #${id}`,
          `[إرجاع جزئي] منتجات لم يستلمها العميل من الطلب #${id}`,
          returnReason || 'تسليم جزئي - العميل لم يستلم كل المنتجات'
        ]
      );
    }
    
    // 3️⃣ سجل في order_history
    await pool.query(
      `INSERT INTO order_history (order_id, action, user_name, new_value)
       VALUES ($1, 'partial_delivery', $2, $3)`,
      [
        id, 
        'Courier #' + req.courierId,
        `تسليم جزئي: حُصِّل ${collectedAmount} ج، رجّع ${returnedItems.length} منتج`
      ]
    ).catch(()=>{});
    
    res.json({
      success: true,
      orderId: id,
      returnedOrderId: returnedId,
      collectedAmount,
      deliveredItemsCount: deliveredItems.length,
      returnedItemsCount: returnedItems.length
    });
  }catch(e){ 
    console.error('partial-deliver error:', e.message);
    res.status(500).json({error: e.message}); 
  }
});
app.post('/api/courier/orders/:id/undo-deliver', courierAuth, async (req, res) => {
  const {id} = req.params;
  try{
    const chk = await pool.query('SELECT courier_id, status, settled_at FROM orders WHERE id=$1', [id]);
    if(!chk.rows.length) return res.status(404).json({error: 'الطلب غير موجود'});
    const o = chk.rows[0];
    if(String(o.courier_id) !== String(req.courierId)){
      return res.status(403).json({error: 'الطلب ده مش ليك'});
    }
    // لو الطلب اتسوّى بالفعل، ما ينفعش يرجع
    if(o.settled_at || o.status === 'مسوّى'){
      return res.status(400).json({error: 'الطلب اتسوّى بالفعل — مينفعش رجوع'});
    }
    // لازم يكون الطلب في "تحت التسوية" أو "مكتمل"
    if(!['تحت التسوية', 'مكتمل', 'تم التسليم'].includes(o.status)){
      return res.status(400).json({error: 'الطلب مش في حالة تسمح بالرجوع'});
    }

    // رجّع لـ "جاري التوصيل"
    await pool.query(
      `UPDATE orders SET
        status='جاري التوصيل',
        courier_delivered_at=NULL,
        updated_at=NOW()
       WHERE id=$1`,
      [id]
    );

    // log
    await pool.query(
      `INSERT INTO order_history (order_id, action, field, old_value, new_value, user_name)
       VALUES ($1, 'تراجع عن التسليم', 'status', $2, 'جاري التوصيل', $3)`,
      [id, o.status, 'مندوب #' + req.courierId]
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
app.post('/api/orders/bulk-pickup', adminAuth, async (req, res) => {
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
app.post('/api/couriers/:id/mark-picked-up', adminAuth, async (req, res) => {
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
app.post('/api/couriers/:id/set-credentials', adminAuth, async (req, res) => {
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
app.get('/api/pending-reviews', adminAuth, async (req, res) => {
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
app.post('/api/pending-reviews/:id/approve', adminAuth, async (req, res) => {
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

    // ده defensive: لو reviewed_by لسه INTEGER في الـ DB (الـ migration ما اشتغلتش بعد)،
    // نحاول نحوّل الـ reviewedBy لـ integer، وإلا نحط null
    let reviewerVal = reviewedBy || null;
    try {
      await pool.query(
        `UPDATE pending_reviews SET status='approved', reviewed_by=$1, reviewed_at=NOW() WHERE id=$2`,
        [reviewerVal, req.params.id]
      );
    } catch(typeErr) {
      // لو type mismatch، اعمل update بدون reviewed_by
      console.warn('reviewed_by type issue, retrying without reviewer:', typeErr.message);
      await pool.query(
        `UPDATE pending_reviews SET status='approved', reviewed_at=NOW() WHERE id=$1`,
        [req.params.id]
      );
    }

    res.json({success: true});
  }catch(e){
    console.error('approve review error:', e.message);
    res.status(500).json({error: e.message});
  }
});

// POST /api/pending-reviews/:id/reject
app.post('/api/pending-reviews/:id/reject', adminAuth, async (req, res) => {
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

    try {
      await pool.query(
        `UPDATE pending_reviews SET status='rejected', reviewed_by=$1, reviewed_at=NOW(),
         rejection_reason=$2 WHERE id=$3`,
        [reviewedBy || null, reason || '', req.params.id]
      );
    } catch(typeErr) {
      // type mismatch fallback
      console.warn('reviewed_by type issue (reject), retrying:', typeErr.message);
      await pool.query(
        `UPDATE pending_reviews SET status='rejected', reviewed_at=NOW(),
         rejection_reason=$1 WHERE id=$2`,
        [reason || '', req.params.id]
      );
    }

    res.json({success: true});
  }catch(e){
    console.error('reject review error:', e.message);
    res.status(500).json({error: e.message});
  }
});

// GET /api/pending-reviews/:id/proof — جيب صورة الدليل
// 🆕 v108: ترجع الصورة كـ binary (image/jpeg أو image/png) بدل HTML
// ده عشان نقدر نستخدمها مع fetch + blob من الـ frontend (مع authentication)
app.get('/api/pending-reviews/:id/proof', adminAuth, async (req, res) => {
  try{
    const r = await pool.query(
      'SELECT data FROM pending_reviews WHERE id=$1',
      [req.params.id]
    );
    if(!r.rows.length) return res.status(404).send('Not found');
    const data = r.rows[0].data || {};
    if(!data.proofImageBase64) return res.status(404).send('No proof');

    // استخرج الـ MIME type والـ base64 data من الـ data URI
    // format: "data:image/jpeg;base64,/9j/4AAQ..."
    const dataUri = data.proofImageBase64;
    const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
    if(!matches){
      return res.status(500).send('Invalid image format');
    }
    
    const mimeType = matches[1] || 'image/jpeg';
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  }catch(e){ 
    console.error('proof error:', e.message);
    res.status(500).send(e.message); 
  }
});

// GET /api/courier-adjustments/pending — تسويات المناديب المعلقة (للمحاسب)
app.get('/api/courier-adjustments/pending', adminAuth, async (req, res) => {
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

// 🆕 v96: GET /api/courier-adjustments/approved-unsettled/:courierId
// التعديلات المعتمدة اللي لسه ما اتربطتش بأي تسوية (للمحاسب وقت إنشاء تسوية)
app.get('/api/courier-adjustments/approved-unsettled/:courierId', adminAuth, async (req, res) => {
  if(!DB_ENABLED) return res.json([]);
  try{
    const r = await pool.query(
      `SELECT id, amount, reason, status, created_at, reviewed_at,
              CASE WHEN proof_image_base64 IS NOT NULL THEN true ELSE false END as has_proof
       FROM courier_adjustments
       WHERE courier_id=$1 AND status='approved' AND settlement_id IS NULL
       ORDER BY created_at ASC`,
      [req.params.courierId]
    );
    res.json(r.rows.map(a => ({
      id: a.id,
      amount: parseFloat(a.amount),
      reason: a.reason,
      status: a.status,
      hasProof: a.has_proof,
      createdAt: a.created_at,
      reviewedAt: a.reviewed_at
    })));
  }catch(e){
    console.error('approved-unsettled error:', e.message);
    res.status(500).json({error: e.message});
  }
});

// 🆕 v101: SHIPPING TRANSFER REQUESTS

// POST /api/shipping-transfers — مندوب يطلب تحويل طلب
// 🆕 v106: CUSTOMER RISK ASSESSMENT ENDPOINTS

// GET /api/customer-risk/:phone — جيب تقييم عميل واحد
app.get('/api/customer-risk/:phone', adminAuth, async (req, res) => {
  try{
    const forceRefresh = req.query.refresh === '1';
    const result = await _getCustomerRisk(req.params.phone, forceRefresh);
    if(!result) return res.status(404).json({error:'لم يمكن الحصول على بيانات Shopify'});
    res.json(result);
  }catch(e){
    console.error('customer-risk error:', e.message);
    res.status(500).json({error: e.message});
  }
});

// POST /api/customer-risk/batch — جيب تقييم لمجموعة من العملاء
app.post('/api/customer-risk/batch', adminAuth, async (req, res) => {
  const { phones, forceRefresh } = req.body || {};
  if(!Array.isArray(phones)) return res.status(400).json({error:'phones must be array'});
  // limit للحماية من abuse
  const list = phones.slice(0, 100);
  const results = {};

  // Process بـ concurrency limit للـ Shopify rate limit (40/sec)
  const batchSize = 5;
  for(let i = 0; i < list.length; i += batchSize){
    const batch = list.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(p => _getCustomerRisk(p, forceRefresh).catch(e => ({error: e.message, phone: p})))
    );
    batch.forEach((p, idx) => { results[p] = batchResults[idx]; });
    // Delay بين الـ batches
    if(i + batchSize < list.length) await new Promise(r => setTimeout(r, 200));
  }

  res.json({ results });
});

// GET /api/customers-risk-list — قايمة بكل العملاء المُقيَّمين (من الـ cache)
app.get('/api/customers-risk-list', adminAuth, async (req, res) => {
  if(!DB_ENABLED) return res.json([]);
  try{
    const minRisk = parseFloat(req.query.minRisk) || 0;
    const minOrders = parseInt(req.query.minOrders) || 0;
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);

    const r = await pool.query(
      `SELECT * FROM customer_risk_cache
       WHERE risk_percentage >= $1 AND total_orders >= $2
       ORDER BY risk_percentage DESC, total_orders DESC
       LIMIT $3`,
      [minRisk, minOrders, limit]
    );
    res.json(r.rows.map(c => ({
      phone: c.phone,
      customerId: c.shopify_customer_id,
      customerName: c.customer_name,
      totalOrders: c.total_orders,
      cancelledOrders: c.cancelled_orders,
      refundedOrders: c.refunded_orders,
      successfulOrders: c.successful_orders,
      totalSpent: parseFloat(c.total_spent) || 0,
      riskPercentage: parseFloat(c.risk_percentage) || 0,
      lastOrderAt: c.last_order_at,
      firstOrderAt: c.first_order_at,
      tags: c.tags,
      notes: c.notes,
      cachedAt: c.cached_at,
    })));
  }catch(e){ res.status(500).json({error: e.message}); }
});

// PATCH /api/customer-risk/:phone/notes — إضافة ملاحظات
app.patch('/api/customer-risk/:phone/notes', adminAuth, async (req, res) => {
  if(!DB_ENABLED) return res.status(503).json({error:'DB unavailable'});
  try{
    const normalized = _normalizePhone(req.params.phone);
    await pool.query(
      `INSERT INTO customer_risk_cache (phone, notes, cached_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (phone) DO UPDATE SET notes=$2, updated_at=NOW()`,
      [normalized, req.body.notes || '']
    );
    res.json({ success: true });
  }catch(e){ res.status(500).json({error: e.message}); }
});

// GET /api/risk-settings — إعدادات النظام
app.get('/api/risk-settings', adminAuth, async (req, res) => {
  if(!DB_ENABLED) return res.json({ threshold: 30, minOrders: 3 });
  try{
    const r = await pool.query(
      `SELECT key, value FROM app_settings WHERE key IN ('risk_threshold', 'risk_min_orders')`
    );
    const map = {};
    r.rows.forEach(x => map[x.key] = x.value);
    res.json({
      threshold: parseInt(map.risk_threshold) || 30,
      minOrders: parseInt(map.risk_min_orders) || 3,
    });
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/risk-settings — حفظ الإعدادات
app.post('/api/risk-settings', adminAuth, async (req, res) => {
  if(!DB_ENABLED) return res.status(503).json({error:'DB unavailable'});
  const { threshold, minOrders } = req.body || {};
  try{
    if(threshold !== undefined){
      await pool.query(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ('risk_threshold', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
        [String(threshold)]
      );
    }
    if(minOrders !== undefined){
      await pool.query(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ('risk_min_orders', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
        [String(minOrders)]
      );
    }
    res.json({ success: true });
  }catch(e){ res.status(500).json({error: e.message}); }
});

app.post('/api/shipping-transfers', courierAuth, async (req, res) => {
  if(!DB_ENABLED) return res.status(503).json({error:'DB unavailable'});
  const { orderId, targetType, targetCourierId, reason } = req.body || {};
  if(!orderId || !targetType) return res.status(400).json({error:'orderId و targetType مطلوبين'});
  if(!['courier', 'bosta'].includes(targetType)) return res.status(400).json({error:'targetType لازم يكون courier أو bosta'});
  if(targetType === 'courier' && !targetCourierId) return res.status(400).json({error:'targetCourierId مطلوب لو target=courier'});

  try{
    // تأكد إن الطلب فعلاً مع المندوب ده
    const orderR = await pool.query(
      `SELECT id, courier_id, status FROM orders WHERE id=$1`,
      [orderId]
    );
    if(!orderR.rows.length) return res.status(404).json({error:'الطلب غير موجود'});
    const order = orderR.rows[0];
    if(String(order.courier_id) !== String(req.courierId)){
      return res.status(403).json({error:'الطلب ده مش معك'});
    }
    if(['مكتمل', 'مسوّى', 'تم التسليم', 'ملغي'].includes(order.status)){
      return res.status(400).json({error:'مينفعش تطلب تحويل لطلب بالحالة دي'});
    }

    // تأكد إنه مفيش طلب pending موجود نفسه
    const existR = await pool.query(
      `SELECT id FROM shipping_transfer_requests WHERE order_id=$1 AND status='pending'`,
      [orderId]
    );
    if(existR.rows.length){
      return res.status(400).json({error:'فيه طلب تحويل معلق على نفس الأوردر بالفعل'});
    }

    const r = await pool.query(
      `INSERT INTO shipping_transfer_requests (order_id, from_courier_id, target_type, target_courier_id, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id, created_at`,
      [orderId, req.courierId, targetType, targetType === 'courier' ? targetCourierId : null, reason || null]
    );

    // سجل event في تاريخ الطلب
    await pool.query(
      `INSERT INTO order_history (order_id, action, field, old_value, new_value, user_name)
       VALUES ($1, 'طلب تحويل شحن', 'transfer_request', $2, $3, $4)`,
      [orderId, '', `طلب تحويل: ${targetType === 'bosta' ? 'بوسطة' : 'مندوب آخر'}${reason ? ' — '+reason : ''}`, 'مندوب #'+req.courierId]
    ).catch(() => {});

    res.json({ success: true, id: r.rows[0].id, createdAt: r.rows[0].created_at });
  }catch(e){
    console.error('POST shipping-transfers error:', e.message);
    res.status(500).json({error: e.message});
  }
});

// GET /api/shipping-transfers?status=pending — للأدمن
app.get('/api/shipping-transfers', adminAuth, async (req, res) => {
  if(!DB_ENABLED) return res.json([]);
  try{
    const status = req.query.status || 'pending';
    const r = await pool.query(
      `SELECT
         t.id, t.order_id, t.from_courier_id, t.target_type, t.target_courier_id,
         t.reason, t.status, t.reviewed_by, t.reviewed_at, t.rejection_reason, t.created_at,
         fc.name AS from_courier_name, fc.phone AS from_courier_phone,
         tc.name AS target_courier_name,
         o.name AS customer_name, o.phone AS customer_phone, o.area, o.addr, o.total, o.paid, o.status AS order_status
       FROM shipping_transfer_requests t
       LEFT JOIN couriers fc ON fc.id = t.from_courier_id
       LEFT JOIN couriers tc ON tc.id = t.target_courier_id
       LEFT JOIN orders o ON o.id = t.order_id
       WHERE t.status = $1
       ORDER BY t.created_at DESC`,
      [status]
    );
    res.json(r.rows.map(x => ({
      id: x.id,
      orderId: x.order_id,
      fromCourierId: x.from_courier_id,
      fromCourierName: x.from_courier_name,
      fromCourierPhone: x.from_courier_phone,
      targetType: x.target_type,
      targetCourierId: x.target_courier_id,
      targetCourierName: x.target_courier_name,
      reason: x.reason,
      status: x.status,
      reviewedBy: x.reviewed_by,
      reviewedAt: x.reviewed_at,
      rejectionReason: x.rejection_reason,
      createdAt: x.created_at,
      customer: {
        name: x.customer_name,
        phone: x.customer_phone,
        area: x.area,
        addr: x.addr,
        total: parseFloat(x.total) || 0,
        paid: x.paid,
        orderStatus: x.order_status,
      }
    })));
  }catch(e){
    console.error('GET shipping-transfers error:', e.message);
    res.status(500).json({error: e.message});
  }
});

// POST /api/shipping-transfers/:id/approve
app.post('/api/shipping-transfers/:id/approve', adminAuth, async (req, res) => {
  if(!DB_ENABLED) return res.status(503).json({error:'DB unavailable'});
  const { reviewedBy } = req.body || {};
  try{
    // جيب الطلب
    const tR = await pool.query(
      `SELECT * FROM shipping_transfer_requests WHERE id=$1 AND status='pending'`,
      [req.params.id]
    );
    if(!tR.rows.length) return res.status(404).json({error:'طلب غير موجود أو معتمد بالفعل'});
    const t = tR.rows[0];

    // حدّث الطلب
    if(t.target_type === 'bosta'){
      // حول لبوسطة: شيل courier_id واعمل isBosta=true
      await pool.query(
        `UPDATE orders SET courier_id=NULL, is_bosta=true, status='جديد', updated_at=NOW() WHERE id=$1`,
        [t.order_id]
      );
      await pool.query(
        `INSERT INTO order_history (order_id, action, field, old_value, new_value, user_name)
         VALUES ($1, 'تحويل لبوسطة', 'courier', $2, 'بوسطة', $3)`,
        [t.order_id, 'مندوب #'+t.from_courier_id, reviewedBy || 'admin']
      ).catch(() => {});
    } else {
      // حول لمندوب تاني
      await pool.query(
        `UPDATE orders SET courier_id=$1, is_bosta=false, status='جديد', picked_up_at=NULL, updated_at=NOW() WHERE id=$2`,
        [t.target_courier_id, t.order_id]
      );
      await pool.query(
        `INSERT INTO order_history (order_id, action, field, old_value, new_value, user_name)
         VALUES ($1, 'تحويل لمندوب', 'courier', $2, $3, $4)`,
        [t.order_id, 'مندوب #'+t.from_courier_id, 'مندوب #'+t.target_courier_id, reviewedBy || 'admin']
      ).catch(() => {});
    }

    // اعتمد الـ request
    await pool.query(
      `UPDATE shipping_transfer_requests SET status='approved', reviewed_by=$1, reviewed_at=NOW() WHERE id=$2`,
      [reviewedBy || 'admin', req.params.id]
    );

    res.json({ success: true });
  }catch(e){
    console.error('approve transfer error:', e.message);
    res.status(500).json({error: e.message});
  }
});

// POST /api/shipping-transfers/:id/reject
app.post('/api/shipping-transfers/:id/reject', adminAuth, async (req, res) => {
  if(!DB_ENABLED) return res.status(503).json({error:'DB unavailable'});
  const { reviewedBy, reason } = req.body || {};
  try{
    const r = await pool.query(
      `UPDATE shipping_transfer_requests
       SET status='rejected', reviewed_by=$1, reviewed_at=NOW(), rejection_reason=$2
       WHERE id=$3 AND status='pending'
       RETURNING order_id`,
      [reviewedBy || 'admin', reason || '', req.params.id]
    );
    if(!r.rows.length) return res.status(404).json({error:'طلب غير موجود أو معتمد بالفعل'});

    // سجل event
    await pool.query(
      `INSERT INTO order_history (order_id, action, field, old_value, new_value, user_name)
       VALUES ($1, 'رفض تحويل شحن', 'transfer_request', '', $2, $3)`,
      [r.rows[0].order_id, reason || '(بدون سبب)', reviewedBy || 'admin']
    ).catch(() => {});

    res.json({ success: true });
  }catch(e){
    console.error('reject transfer error:', e.message);
    res.status(500).json({error: e.message});
  }
});

// 🆕 v101: GET /api/courier/my-transfer-requests — للمندوب يشوف طلبات التحويل بتاعته
app.get('/api/courier/my-transfer-requests', courierAuth, async (req, res) => {
  if(!DB_ENABLED) return res.json([]);
  try{
    const r = await pool.query(
      `SELECT id, order_id, target_type, status, reason, rejection_reason, created_at, reviewed_at
       FROM shipping_transfer_requests
       WHERE from_courier_id=$1
       ORDER BY created_at DESC LIMIT 100`,
      [req.courierId]
    );
    res.json(r.rows.map(x => ({
      id: x.id,
      orderId: x.order_id,
      targetType: x.target_type,
      status: x.status,
      reason: x.reason,
      rejectionReason: x.rejection_reason,
      createdAt: x.created_at,
      reviewedAt: x.reviewed_at,
    })));
  }catch(e){ res.status(500).json({error: e.message}); }
});

// POST /api/courier-adjustments/:id/approve
app.post('/api/courier-adjustments/:id/approve', adminAuth, async (req, res) => {
  const {reviewedBy} = req.body || {};
  try{
    try {
      await pool.query(
        `UPDATE courier_adjustments SET status='approved', reviewed_by=$1, reviewed_at=NOW()
         WHERE id=$2 AND status='pending'`,
        [reviewedBy || null, req.params.id]
      );
    } catch(typeErr) {
      console.warn('adj reviewed_by type issue, retrying:', typeErr.message);
      await pool.query(
        `UPDATE courier_adjustments SET status='approved', reviewed_at=NOW()
         WHERE id=$1 AND status='pending'`,
        [req.params.id]
      );
    }
    res.json({success: true});
  }catch(e){
    console.error('approve adjustment error:', e.message);
    res.status(500).json({error: e.message});
  }
});

// POST /api/courier-adjustments/:id/reject
app.post('/api/courier-adjustments/:id/reject', adminAuth, async (req, res) => {
  const {reviewedBy, reason} = req.body || {};
  try{
    try {
      await pool.query(
        `UPDATE courier_adjustments SET status='rejected', reviewed_by=$1, reviewed_at=NOW(),
         rejection_reason=$2 WHERE id=$3 AND status='pending'`,
        [reviewedBy || null, reason || '', req.params.id]
      );
    } catch(typeErr) {
      console.warn('adj reviewed_by type issue (reject), retrying:', typeErr.message);
      await pool.query(
        `UPDATE courier_adjustments SET status='rejected', reviewed_at=NOW(),
         rejection_reason=$1 WHERE id=$2 AND status='pending'`,
        [reason || '', req.params.id]
      );
    }
    res.json({success: true});
  }catch(e){
    console.error('reject adjustment error:', e.message);
    res.status(500).json({error: e.message});
  }
});

// GET /api/courier-adjustments/:id/proof
// 🆕 v108: ترجع الصورة كـ binary (image/jpeg أو image/png) بدل HTML
app.get('/api/courier-adjustments/:id/proof', adminAuth, async (req, res) => {
  try{
    const r = await pool.query(
      'SELECT proof_image_base64 FROM courier_adjustments WHERE id=$1',
      [req.params.id]
    );
    if(!r.rows.length || !r.rows[0].proof_image_base64){
      return res.status(404).send('Not found');
    }
    
    // استخرج الـ MIME type والـ base64 data من الـ data URI
    const dataUri = r.rows[0].proof_image_base64;
    const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
    if(!matches){
      return res.status(500).send('Invalid image format');
    }
    
    const mimeType = matches[1] || 'image/jpeg';
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  }catch(e){ 
    console.error('adjustment proof error:', e.message);
    res.status(500).send(e.message); 
  }
});

// ============================================================
// ===== CAFELAX STARS — SHOP MODE (موظف المحل) =====
// ============================================================

async function shopAuth(req, res, next){
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if(!token) return res.status(401).json({error: 'No token'});

  let session = _shopSessions.get(token);
  if(!session){
    session = await _loadShopSessionFromDB(token);
  }
  if(!session) return res.status(401).json({error: 'Invalid or expired token'});

  if(session.expires < Date.now()){
    _shopSessions.delete(token);
    if(DB_ENABLED){
      pool.query('DELETE FROM shop_sessions WHERE token=$1', [token]).catch(()=>{});
    }
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
    // 🆕 v89: 30 يوم بدل 24 ساعة
    const expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
    _shopSessions.set(token, {shopUserId: u.id, username: u.username, expires});
    // 🆕 v89: احفظ في الـ DB
    try{
      await pool.query(
        `INSERT INTO shop_sessions (token, shop_user_id, username, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (token) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
        [token, u.id, u.username, new Date(expires)]
      );
    }catch(e){ console.warn('Failed to persist shop session:', e.message); }
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
    r.rows.forEach(row => { delete row.bosta_awb_base64; });

    const todayR = await pool.query(
      `SELECT * FROM orders
       WHERE delivery_type='pickup'
         AND status IN ('مكتمل', 'ملغي')
         AND updated_at::date = CURRENT_DATE
       ORDER BY updated_at DESC`
    );
    todayR.rows.forEach(row => { delete row.bosta_awb_base64; });

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
    cancelledR.rows.forEach(row => { delete row.bosta_awb_base64; });
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
app.get('/api/shipping-transfers', adminAuth, async (req, res) => {
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
app.post('/api/shipping-transfers/:id/accept-and-assign', adminAuth, async (req, res) => {
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
app.post('/api/shipping-transfers/:id/reject', adminAuth, async (req, res) => {
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
app.post('/api/shop-users', adminAuth, async (req, res) => {
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
app.get('/api/shop-users', adminAuth, async (req, res) => {
  try{
    const r = await pool.query(
      'SELECT id, username, display_name, active, last_login_at, created_at FROM shop_users ORDER BY created_at DESC'
    );
    res.json(r.rows);
  }catch(e){ res.status(500).json({error: e.message}); }
});

// ===== Field Cancellations (إلغاءات بانتظار استلام الإدارة) =====

// GET /api/field-cancellations — list all pending cancellations
app.get('/api/field-cancellations', adminAuth, async (req, res) => {
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
app.post('/api/field-cancellations/:orderId/confirm-receive', adminAuth, async (req, res) => {
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
app.post('/api/field-cancellations/:orderId/revert', adminAuth, async (req, res) => {
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
    app.listen(PORT, () => console.log('🚀 OrderPro Backend شغال على port', PORT, '| version:', SERVER_VERSION));
  });
} else {
  app.listen(PORT, () => console.log('🚀 OrderPro Backend شغال على port', PORT, '| version:', SERVER_VERSION, '(بدون DB)'));
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
app.get('/api/treasuries', adminAuth, async (req, res) => {
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
app.post('/api/treasuries', adminAuth, async (req, res) => {
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
app.delete('/api/treasuries/:id', adminAuth, async (req, res) => {
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
app.get('/api/treasury-tx', adminAuth, async (req, res) => {
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
app.post('/api/treasury-tx', adminAuth, async (req, res) => {
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
app.delete('/api/treasury-tx/:id', adminAuth, async (req, res) => {
  if(!DB_ENABLED) return res.json({ok:true});
  try {
    const client = await pool.connect();
    await client.query('DELETE FROM treasury_tx WHERE id=$1', [req.params.id]);
    client.release();
    res.json({ok:true});
  } catch(e) { res.json({ok:false}); }
});

// PATCH transaction (edit)
app.patch('/api/treasury-tx/:id', adminAuth, async (req, res) => {
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
app.get('/api/check-suppliers', adminAuth, async (req, res) => {
  if(!DB_ENABLED) return res.json({suppliers:[]});
  try{
    await pool.query("CREATE TABLE IF NOT EXISTS check_suppliers (id TEXT PRIMARY KEY, name TEXT)");
    const r = await pool.query('SELECT * FROM check_suppliers ORDER BY name');
    res.json({suppliers: r.rows});
  }catch(e){ res.json({suppliers:[]}); }
});

app.post('/api/check-suppliers', adminAuth, async (req, res) => {
  if(!DB_ENABLED) return res.json({ok:true});
  const {id, name} = req.body;
  try{
    await pool.query("CREATE TABLE IF NOT EXISTS check_suppliers (id TEXT PRIMARY KEY, name TEXT)");
    await pool.query('INSERT INTO check_suppliers (id,name) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET name=$2', [id, name]);
    res.json({ok:true});
  }catch(e){ res.json({ok:false}); }
});

app.delete('/api/check-suppliers/:id', adminAuth, async (req, res) => {
  if(!DB_ENABLED) return res.json({ok:true});
  try{
    await pool.query('DELETE FROM check_suppliers WHERE id=$1', [req.params.id]);
    res.json({ok:true});
  }catch(e){ res.json({ok:false}); }
});

// ===== BARCODE VERIFICATION SYSTEM =====

app.post('/api/preparation/start', courierAuth, async (req, res) => {
  if (!DB_ENABLED) return res.json({ ok: true });
  const { orderId, preparerId } = req.body;
  if (!orderId || !preparerId) return res.status(400).json({ error: 'orderId and preparerId required' });
  try {
    // اجلب الطلب أولاً لو محتاج enrich (line_items_json مفهاش barcode)
    const orderRes = await pool.query('SELECT id, shopify_id, line_items_json, src FROM orders WHERE id=$1', [orderId]);
    if (orderRes.rows.length) {
      const order = orderRes.rows[0];
      let lineItems = [];
      try { lineItems = JSON.parse(order.line_items_json || '[]'); } catch(e) {}

      // لو فيه line items من Shopify ومفيش barcodes، اعمل enrich
      const hasShopifyId = order.shopify_id || order.src === 'shopify';
      const hasAnyBarcode = lineItems.some(i => i.barcode);
      const needsEnrich = hasShopifyId && lineItems.length > 0 && !hasAnyBarcode;

      if (needsEnrich) {
        try {
          const creds = await getShopifyCredentials();
          if (creds.shopUrl && creds.accessToken) {
            const host = creds.shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
            // اجلب الطلب من Shopify عشان نجيب الـ variant_id الأصلي
            const shR = await shopifyRequest(host, creds.accessToken,
              `/admin/api/2024-10/orders/${order.shopify_id}.json?fields=line_items`);
            if (shR.status === 200 && shR.data.order && shR.data.order.line_items) {
              const enriched = await enrichLineItemsWithImages(shR.data.order.line_items, host, creds.accessToken);
              await pool.query('UPDATE orders SET line_items_json=$1, updated_at=NOW() WHERE id=$2',
                [JSON.stringify(enriched), orderId]);
              console.log('✅ Enriched line items with barcodes for order:', orderId,
                'barcodes found:', enriched.filter(i => i.barcode).length, '/', enriched.length);
            }
          }
        } catch(e) {
          console.warn('Auto-enrich failed for order', orderId, ':', e.message);
        }
      }
    }

    await pool.query('UPDATE orders SET preparation_started_by=$1, preparation_started_at=NOW(), preparation_status=$2, updated_at=NOW() WHERE id=$3', [preparerId, 'in_progress', orderId]);
    await pool.query('INSERT INTO order_history (order_id, action, user_name, new_value) VALUES ($1, $2, $3, $4)', [orderId, 'preparation_started', 'Preparer #' + preparerId, 'in_progress']).catch(() => {});
    console.log('Preparation started for order:', orderId, 'by preparer:', preparerId);
    res.json({ ok: true });
  } catch (e) {
    console.error('Preparation start error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/preparation/scan', courierAuth, async (req, res) => {
  if (!DB_ENABLED) return res.json({ ok: true, matched: true });
  const { orderId, barcode, preparerId } = req.body;
  if (!orderId || !barcode) return res.status(400).json({ error: 'orderId and barcode required' });
  const scannedBarcode = String(barcode).trim();
  try {
    const orderRes = await pool.query('SELECT id, items, line_items_json, scanned_items FROM orders WHERE id=$1', [orderId]);
    if (!orderRes.rows.length) return res.status(404).json({ error: 'Order not found' });
    const order = orderRes.rows[0];
    // استخدم line_items_json (تفاصيل كاملة)، وارجع لـ items لو فاضي
    let items = [];
    try { items = JSON.parse(order.line_items_json || order.items || '[]'); } catch(e) { items = []; }
    if (!Array.isArray(items)) items = [];
    let scannedItems = {};
    try { scannedItems = order.scanned_items ? JSON.parse(order.scanned_items) : {}; } catch(e) {}

    // اجمع كل الباركودات المتاحة للـ debug
    const allBarcodes = [];
    let matched = false;
    let matchedItem = null;
    let exceededLimit = false;

    for (const item of items) {
      if (!item.barcode) continue;
      const barcodes = String(item.barcode).split(',').map(b => b.trim()).filter(b => b);
      barcodes.forEach(b => allBarcodes.push(b));
      // matching: exact أو case-insensitive للأمان
      if (barcodes.includes(scannedBarcode) ||
          barcodes.some(b => b.toLowerCase() === scannedBarcode.toLowerCase())) {
        matched = true;
        matchedItem = item;
        const itemKey = item.sku || item.name;
        const currentScanned = scannedItems[itemKey] || 0;
        const requiredQty = item.quantity || 1;

        // ✋ امنع الزيادة فوق الكمية المطلوبة
        if (currentScanned >= requiredQty) {
          exceededLimit = true;
          break;
        }

        scannedItems[itemKey] = currentScanned + 1;
        break;
      }
    }

    if (exceededLimit) {
      console.log('Barcode over-scan:', scannedBarcode, 'item:', matchedItem?.name, 'already at limit');
      return res.json({
        ok: true, matched: false,
        error: `هذا المنتج تم سكانه بالكامل (${matchedItem?.quantity || 1}/${matchedItem?.quantity || 1}) — لا يمكن زيادة الكمية`,
        item: matchedItem
      });
    }

    if (!matched) {
      console.log('Barcode not found:', scannedBarcode, 'in order:', orderId, 'available:', allBarcodes);
      return res.json({
        ok: true, matched: false,
        error: allBarcodes.length === 0
          ? 'هذا الطلب ليس له باركودات محددة (تأكد من إضافة الباركود في Shopify)'
          : 'الباركود غير موجود في الطلب',
        debug: { scanned: scannedBarcode, availableCount: allBarcodes.length }
      });
    }
    await pool.query('UPDATE orders SET scanned_items=$1, updated_at=NOW() WHERE id=$2', [JSON.stringify(scannedItems), orderId]);
    await pool.query('INSERT INTO order_history (order_id, action, user_name, new_value) VALUES ($1, $2, $3, $4)', [orderId, 'barcode_scanned', 'Preparer #' + preparerId, scannedBarcode]).catch(() => {});
    console.log('Barcode scanned:', scannedBarcode, 'for order:', orderId);
    res.json({ ok: true, matched: true, item: matchedItem, scannedItems });
  } catch (e) {
    console.error('Scan error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/preparation/complete', courierAuth, async (req, res) => {
  if (!DB_ENABLED) return res.json({ ok: true });
  const { orderId, preparerId, preparerName } = req.body;
  if (!orderId || !preparerId) return res.status(400).json({ error: 'orderId and preparerId required' });
  try {
    const orderRes = await pool.query('SELECT id, items, line_items_json, scanned_items, shopify_id FROM orders WHERE id=$1', [orderId]);
    if (!orderRes.rows.length) return res.status(404).json({ error: 'Order not found' });
    const order = orderRes.rows[0];
    let items = [];
    try { items = JSON.parse(order.line_items_json || order.items || '[]'); } catch(e) { items = []; }
    if (!Array.isArray(items)) items = [];
    let scannedItems = {};
    try { scannedItems = order.scanned_items ? JSON.parse(order.scanned_items) : {}; } catch(e) {}
    let allScanned = true;
    const missing = [];
    const overScanned = [];
    for (const item of items) {
      const itemKey = item.sku || item.name;
      const scannedQty = scannedItems[itemKey] || 0;
      const requiredQty = item.quantity || 1;
      if (scannedQty < requiredQty) {
        allScanned = false;
        missing.push({ name: item.name, required: requiredQty, scanned: scannedQty, missing: requiredQty - scannedQty });
      } else if (scannedQty > requiredQty) {
        // over-scan! بنرجع رقم صحيح
        allScanned = false;
        overScanned.push({ name: item.name, required: requiredQty, scanned: scannedQty });
      }
    }
    if (!allScanned) {
      console.log('Order not ready:', orderId, 'missing:', missing, 'over:', overScanned);
      return res.status(400).json({
        error: overScanned.length
          ? 'تم سكان كمية زائدة لبعض المنتجات — أعد التحضير'
          : 'الطلب غير مكتمل',
        missing,
        overScanned
      });
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

app.get('/api/preparation/orders', courierAuth, async (req, res) => {
  if (!DB_ENABLED) return res.json({ orders: [] });
  const preparerId = parseInt(req.query.preparerId, 10);
  if (!preparerId || isNaN(preparerId)) {
    return res.status(400).json({ error: 'preparerId مطلوب ويجب أن يكون رقماً صحيحاً', received: req.query.preparerId });
  }
  try {
    // الفلترة:
    // 1. الطلب من آخر 5 أيام
    // 2. مش متحضّر بالفعل (preparation_status != 'completed')
    // 3. لو في طلب شغال عليه محضر، يظهر بس لصاحبه (مش لباقي المحضرين)
    // 4. مش ملغي
    const result = await pool.query(`
      SELECT o.id, o.shopify_id, o.name, o.phone, o.area, o.addr, o.total, o.paid,
             o.items, o.line_items_json, o.scanned_items, o.status, o.created_at,
             o.preparation_status, o.preparation_started_by, o.preparation_started_at,
             o.courier_id
      FROM orders o
      WHERE o.created_at >= NOW() - INTERVAL '5 days'
        AND o.status != 'ملغي'
        AND (o.preparation_status IS NULL
             OR (o.preparation_status = 'in_progress' AND o.preparation_started_by = $1))
      ORDER BY o.created_at DESC
      LIMIT 200
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
      // فضّل line_items_json (التفاصيل الكاملة) على items (الوصف البسيط)
      items: row.line_items_json || row.items,
      scannedItems: row.scanned_items,
      status: row.status,
      courierId: row.courier_id,
      preparationStatus: row.preparation_status,
      preparationStartedBy: row.preparation_started_by,
      preparationStartedAt: row.preparation_started_at,
      createdAt: row.created_at
    }));
    res.json({ orders });
  } catch (e) {
    console.error('Get preparation orders error:', e.message, e.stack);
    res.status(500).json({ error: 'فشل تحميل الطلبات: ' + e.message });
  }
});

// /api/preparation/find/:id — للـ QR scan: يدور على الطلب أينما كان ويرجع رسالة واضحة
app.get('/api/preparation/find/:id', courierAuth, async (req, res) => {
  if (!DB_ENABLED) return res.status(503).json({ error: 'DB unavailable' });
  const orderId = String(req.params.id || '').trim();
  const preparerId = parseInt(req.query.preparerId, 10);
  if (!orderId) return res.status(400).json({ error: 'order id required' });

  try {
    // ابحث بالـ ID المباشر، أو بالـ shopify_id
    const r = await pool.query(`
      SELECT o.id, o.status, o.preparation_status, o.preparation_started_by,
             o.preparation_completed_by, o.preparation_completed_at, o.courier_id,
             c.name as preparer_name, c2.name as courier_name
      FROM orders o
      LEFT JOIN couriers c ON o.preparation_started_by = c.id
      LEFT JOIN couriers c2 ON o.courier_id = c2.id
      WHERE o.id = $1 OR o.shopify_id = $1
      LIMIT 1
    `, [orderId]);

    if (!r.rows.length) {
      return res.json({ found: false, canPrepare: false, reason: 'الطلب غير موجود في النظام' });
    }

    const o = r.rows[0];

    // حالة 1: الطلب اتحضّر خلاص
    if (o.preparation_status === 'completed') {
      return res.json({
        found: true, canPrepare: false, orderId: o.id,
        reason: `هذا الطلب تم تحضيره${o.preparer_name ? ' بواسطة ' + o.preparer_name : ''}`
      });
    }

    // حالة 2: الطلب ملغي
    if (o.status === 'ملغي') {
      return res.json({ found: true, canPrepare: false, orderId: o.id, reason: 'هذا الطلب ملغي' });
    }

    // حالة 3: الطلب خرج للمندوب أو اتسلّم خلاص
    if (['جاري التوصيل', 'تم التسليم', 'مرتجع', 'تحت التسوية', 'مسوّى'].includes(o.status)) {
      const c = o.courier_name ? ` (مع المندوب: ${o.courier_name})` : '';
      return res.json({
        found: true, canPrepare: false, orderId: o.id,
        reason: `هذا الطلب خرج من المخزن — حالته: ${o.status}${c}`
      });
    }

    // حالة 4: الطلب شغال عليه محضر تاني
    if (o.preparation_status === 'in_progress' && preparerId && o.preparation_started_by !== preparerId) {
      return res.json({
        found: true, canPrepare: false, orderId: o.id,
        reason: `هذا الطلب قيد التحضير${o.preparer_name ? ' بواسطة ' + o.preparer_name : ' بواسطة شخص آخر'}`
      });
    }

    // حالة 5: تمام، الطلب جاهز للتحضير (أو هو اللي بدأ فيه)
    return res.json({
      found: true, canPrepare: true, orderId: o.id,
      status: o.status, preparationStatus: o.preparation_status
    });
  } catch (e) {
    console.error('Find prep order error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// /api/preparation/manual-mark — تأكيد يدوي لمنتج بدون باركود
app.post('/api/preparation/manual-mark', adminAuth, async (req, res) => {
  if (!DB_ENABLED) return res.json({ ok: true });
  const { orderId, itemKey, quantity, preparerId } = req.body;
  if (!orderId || !itemKey) return res.status(400).json({ error: 'orderId and itemKey required' });
  try {
    const r = await pool.query('SELECT scanned_items FROM orders WHERE id=$1', [orderId]);
    if (!r.rows.length) return res.status(404).json({ error: 'Order not found' });
    let scannedItems = {};
    try { scannedItems = r.rows[0].scanned_items ? JSON.parse(r.rows[0].scanned_items) : {}; } catch(e) {}
    scannedItems[itemKey] = quantity || 1;
    await pool.query('UPDATE orders SET scanned_items=$1, updated_at=NOW() WHERE id=$2',
      [JSON.stringify(scannedItems), orderId]);
    await pool.query(
      'INSERT INTO order_history (order_id, action, user_name, new_value) VALUES ($1, $2, $3, $4)',
      [orderId, 'item_manual_marked', 'Preparer #' + preparerId, itemKey + ' x' + (quantity || 1)]
    ).catch(() => {});
    console.log('Manual mark:', itemKey, 'for order', orderId, 'by preparer', preparerId);
    res.json({ ok: true, scannedItems });
  } catch (e) {
    console.error('Manual mark error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// /api/preparation/order/:id/barcodes — يرجع الباركودات المتاحة في الطلب (للـ debug)
app.get('/api/preparation/order/:id/barcodes', adminAuth, async (req, res) => {
  if (!DB_ENABLED) return res.status(503).json({ error: 'DB unavailable' });
  try {
    const r = await pool.query('SELECT id, items, line_items_json FROM orders WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Order not found' });
    let items = [];
    try { items = JSON.parse(r.rows[0].line_items_json || r.rows[0].items || '[]'); } catch(e) {}
    if (!Array.isArray(items)) items = [];
    const result = items.map(i => ({
      name: i.name,
      sku: i.sku || '',
      barcode: i.barcode || null,
      barcodes: i.barcode ? String(i.barcode).split(',').map(b => b.trim()).filter(b => b) : [],
      quantity: i.quantity || 1
    }));
    res.json({
      orderId: r.rows[0].id,
      itemCount: items.length,
      itemsWithBarcode: result.filter(i => i.barcodes.length > 0).length,
      items: result
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 🆕 v70: Backfill endpoint — يحمل صور للطلبات اللي معندهاش imageBase64
// POST /api/admin/backfill-images
// body: { limit: 50, dryRun: false, retryFailed: true } — يشغّل على دفعات
app.post('/api/admin/backfill-images', adminAuth, async (req, res) => {
  if (!DB_ENABLED) return res.status(503).json({ error: 'DB unavailable' });
  const limit = Math.min(parseInt(req.body.limit) || 20, 50);
  const dryRun = req.body.dryRun === true;
  const retryFailed = req.body.retryFailed !== false; // default true
  try {
    // 🆕 v77: نـ retry الطلبات اللي عندها imageBase64=null كمان (بسبب باج CDN URL)
    const filterClause = retryFailed
      ? `(
          line_items_json IS NULL
          OR line_items_json = ''
          OR line_items_json NOT LIKE '%imageBase64%'
          OR line_items_json LIKE '%"imageBase64":null%'
        )`
      : `(
          line_items_json IS NULL
          OR line_items_json = ''
          OR line_items_json NOT LIKE '%imageBase64%'
        )`;

    const r = await pool.query(
      `SELECT id, shopify_id, line_items_json, src
       FROM orders
       WHERE src='shopify' AND shopify_id IS NOT NULL
         AND created_at >= NOW() - INTERVAL '30 days'
         AND ${filterClause}
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    if (!r.rows.length) {
      return res.json({ processed: 0, message: 'كل الطلبات عندها صور بالفعل' });
    }

    if (dryRun) {
      return res.json({
        wouldProcess: r.rows.length,
        sampleIds: r.rows.slice(0, 5).map(x => x.id)
      });
    }

    const creds = await getShopifyCredentials();
    if (!creds.shopUrl || !creds.accessToken) {
      return res.status(400).json({ error: 'Shopify credentials not configured' });
    }
    const host = creds.shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

    let success = 0;
    let failed = 0;
    const errors = [];

    for (const row of r.rows) {
      try {
        const sh = await shopifyRequest(host, creds.accessToken,
          `/admin/api/2024-10/orders/${row.shopify_id}.json?fields=line_items`);
        if (sh.status !== 200 || !sh.data.order) {
          failed++;
          errors.push({ id: row.id, error: 'Shopify ' + sh.status });
          continue;
        }
        const enriched = await enrichLineItemsWithImages(sh.data.order.line_items || [], host, creds.accessToken);
        await pool.query(
          'UPDATE orders SET line_items_json=$1, updated_at=NOW() WHERE id=$2',
          [JSON.stringify(enriched), row.id]
        );
        // امسح الـ invoice cache عشان يتعمل regenerate بالصور الجديدة
        await pool.query('DELETE FROM invoice_cache WHERE order_id=$1', [row.id]).catch(()=>{});
        success++;
      } catch (e) {
        failed++;
        errors.push({ id: row.id, error: e.message });
      }
    }

    res.json({
      processed: r.rows.length,
      success,
      failed,
      errors: errors.slice(0, 10),
      hasMore: r.rows.length === limit
    });
  } catch (e) {
    console.error('backfill-images:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/backfill-images/status — كم طلب لسه محتاج enrich
app.get('/api/admin/backfill-images/status', adminAuth, async (req, res) => {
  if (!DB_ENABLED) return res.status(503).json({ error: 'DB unavailable' });
  try {
    const r = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE line_items_json LIKE '%imageBase64%' AND line_items_json NOT LIKE '%"imageBase64":null%') as with_real_images,
        COUNT(*) FILTER (WHERE line_items_json LIKE '%"imageBase64":null%') as with_null_images,
        COUNT(*) FILTER (WHERE line_items_json IS NOT NULL AND line_items_json != '' AND line_items_json NOT LIKE '%imageBase64%') as without_images,
        COUNT(*) FILTER (WHERE line_items_json IS NULL OR line_items_json = '') as no_data
       FROM orders
       WHERE src='shopify' AND created_at >= NOW() - INTERVAL '30 days'`
    );
    res.json({
      withRealImages: parseInt(r.rows[0].with_real_images) || 0,
      withNullImages: parseInt(r.rows[0].with_null_images) || 0,
      withoutImages: parseInt(r.rows[0].without_images) || 0,
      noData: parseInt(r.rows[0].no_data) || 0,
      needsRetry: (parseInt(r.rows[0].with_null_images) || 0) +
                  (parseInt(r.rows[0].without_images) || 0) +
                  (parseInt(r.rows[0].no_data) || 0),
    });
  } catch (e) {
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

app.get('/api/orders/:id/state-info', adminAuth, async (req, res) => {
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

app.post('/api/orders/:id/fix-state', adminAuth, async (req, res) => {
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
