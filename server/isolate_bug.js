const dotenv = require('dotenv');
dotenv.config();
const https = require('https');

const baseWorking = {
  order_amount: 20.00,
  order_currency: 'INR',
  customer_details: {
    customer_id: 'cust_1',
    customer_name: 'Test Customer',
    customer_email: 'test@example.com',
    customer_phone: '9999999999'
  },
  order_meta: {
    return_url: 'http://localhost:5173/booking/1?order_id={order_id}',
    notify_url: 'https://kk-auto.onrender.com/api/payments/webhook'
  },
  order_note: 'Kk_Auto test'
};

async function test(label, override) {
  return new Promise((resolve) => {
    const payload = JSON.parse(JSON.stringify(baseWorking));
    Object.assign(payload, override);
    payload.order_id = 'test_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    if (override.order_id) payload.order_id = override.order_id;
    if (override.customer_details) {
      payload.customer_details = { ...baseWorking.customer_details, ...override.customer_details };
    }
    if (override.order_meta) {
      payload.order_meta = { ...baseWorking.order_meta, ...override.order_meta };
    }

    const body = JSON.stringify(payload);
    const req = https.request('https://sandbox.cashfree.com/pg/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2025-01-01',
        'x-client-id': process.env.CASHFREE_APP_ID,
        'x-client-secret': process.env.CASHFREE_SECRET_KEY,
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        let msg = '';
        try {
          const parsed = JSON.parse(d);
          msg = parsed.message || (parsed.payment_session_id ? 'OK' : 'UNKNOWN');
        } catch {
          msg = d.substring(0, 50);
        }
        console.log(`${label}: Status ${res.statusCode}, Result: ${msg}`);
        resolve();
      });
    });
    req.write(body);
    req.end();
  });
}

async function runAll() {
  await test('1. Base Working', {});
  await test('2. order_id with ORDER_KK_', { order_id: 'ORDER_KK_' + Date.now() + '_1234' });
  await test('3. customer_id = 5', { customer_details: { customer_id: '5' } });
  await test('4. customer_name = Rahul Sharma', { customer_details: { customer_name: 'Rahul Sharma' } });
  await test('5. customer_email = rahul@gmail.com', { customer_details: { customer_email: 'rahul@gmail.com' } });
  await test('6. customer_phone = 9876543213', { customer_details: { customer_phone: '9876543213' } });
  await test('7. order_meta with booking/67', { order_meta: { return_url: 'http://localhost:5173/booking/67?order_id={order_id}' } });
  await test('8. order_note with #67', { order_note: 'Kk_Auto booking #67' });
}

runAll();
