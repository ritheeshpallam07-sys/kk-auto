const dotenv = require('dotenv');
dotenv.config();
const https = require('https');

async function testOrder(orderId, name, email, phone, meta) {
  const payload = {
    order_amount: 20.00,
    order_currency: 'INR',
    order_id: orderId,
    customer_details: {
      customer_id: 'cust_5',
      customer_name: name,
      customer_email: email,
      customer_phone: phone
    },
    order_meta: meta,
    order_note: 'Test note'
  };

  const body = JSON.stringify(payload);
  return new Promise((resolve) => {
    const req = https.request('https://sandbox.cashfree.com/pg/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': process.env.CASHFREE_APP_ID,
        'x-client-secret': process.env.CASHFREE_SECRET_KEY,
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log(`[2023-08-01] ${orderId}: ${res.statusCode} - ${d.substring(0, 100)}`);
        resolve(res.statusCode);
      });
    });
    req.write(body);
    req.end();
  });
}

async function testOrder2025(orderId, name, email, phone, meta) {
  const payload = {
    order_amount: 20.00,
    order_currency: 'INR',
    order_id: orderId,
    customer_details: {
      customer_id: 'cust_5',
      customer_name: name,
      customer_email: email,
      customer_phone: phone
    },
    order_meta: meta,
    order_note: 'Test note'
  };

  const body = JSON.stringify(payload);
  return new Promise((resolve) => {
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
        console.log(`[2025-01-01] ${orderId}: ${res.statusCode} - ${d.substring(0, 100)}`);
        resolve(res.statusCode);
      });
    });
    req.write(body);
    req.end();
  });
}

async function run() {
  const metaBooking = {
    return_url: 'http://localhost:5173/booking/67?order_id={order_id}',
    notify_url: 'https://kk-auto.onrender.com/api/payments/webhook'
  };

  console.log('Testing with 2023-08-01:');
  await testOrder('ORD_A_' + Date.now(), 'Rahul Sharma', 'rahul@gmail.com', '9876543213', metaBooking);

  console.log('Testing with 2025-01-01:');
  await testOrder2025('ORD_B_' + Date.now(), 'Rahul Sharma', 'rahul@gmail.com', '9876543213', metaBooking);
}

run();
