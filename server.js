const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// In-memory store (بيتمسح لو الـ server اتعمل restart)
let orders = [];
let nextId = 1;

// ===== MIDDLEWARE =====
app.use(cors({ origin: '*' }));

// Raw body for Shopify webhook verification
app.use('/webhook/shopify', express.raw({ type: 'application/json' }));
app.use(express.json());

// ===== SHOPIFY WEBHOOK =====
app.post('/webhook/shopify', (req, res) => {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '';
  
  // Verify webhook signature (لو عندك secret)
  if (secret) {
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const hash = crypto
      .createHmac('sha256', secret)
      .update(req.body)
      .digest('base64');
    if (hash !== hmac) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const shopifyOrder = JSON.parse(req.body);
  
  // تحويل بيانات Shopify لنظامنا
  const order = {
    id: 'SH-' + shopifyOrder.order_number,
    shopifyId: shopifyOrder.id,
    src: 'shopify',
    name: shopifyOrder.shipping_address
      ? shopifyOrder.shipping_address.first_name + ' ' + shopifyOrder.shipping_address.last_name
      : (shopifyOrder.customer ? shopifyOrder.customer.first_name + ' ' + shopifyOrder.customer.last_name : 'عميل'),
    phone: shopifyOrder.shipping_address?.phone || shopifyOrder.customer?.phone || '—',
    area: shopifyOrder.shipping_address
      ? [shopifyOrder.shipping_address.city, shopifyOrder.shipping_address.address1].filter(Boolean).join(' - ')
      : '—',
    total: parseFloat(shopifyOrder.total_price) || 0,
    ship: 50,
    courierId: null,
    status: 'جديد',
    time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    note: shopifyOrder.note || '',
    items: (shopifyOrder.line_items || []).map(i => i.name + ' x' + i.quantity).join(', '),
    createdAt: new Date().toISOString(),
  };

  orders.unshift(order);
  console.log('✅ طلب جديد من Shopify:', order.id, order.name);
  res.status(200).json({ received: true });
});

// ===== API ROUTES =====

// جلب كل الطلبات
app.get('/api/orders', (req, res) => {
  res.json({ orders, total: orders.length });
});

// إضافة طلب يدوي
app.post('/api/orders', (req, res) => {
  const order = {
    id: 'MN-' + (1000 + nextId++),
    src: 'manual',
    createdAt: new Date().toISOString(),
    time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    status: 'في الانتظار',
    courierId: null,
    ship: 50,
    ...req.body,
  };
  orders.unshift(order);
  res.json({ order });
});

// تحديث طلب (تعيين مندوب، تغيير حالة)
app.patch('/api/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  Object.assign(order, req.body);
  res.json({ order });
});

// حذف طلب
app.delete('/api/orders/:id', (req, res) => {
  orders = orders.filter(o => o.id !== req.params.id);
  res.json({ ok: true });
});

// ===== HEALTH CHECK =====
app.get('/', (req, res) => {
  res.json({
    status: '✅ OrderPro Backend شغال',
    orders: orders.length,
    uptime: Math.floor(process.uptime()) + ' ثانية',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 OrderPro Backend شغال على port ${PORT}`);
});
