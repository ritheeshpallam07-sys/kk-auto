const dotenv = require('dotenv');
dotenv.config();

const https = require('https');
const { Cashfree, CFEnvironment } = require('cashfree-pg');

const appId = process.env.CASHFREE_APP_ID || '';
const secretKey = process.env.CASHFREE_SECRET_KEY || '';

console.log('Credentials diagnostic:', {
  hasAppId: !!appId,
  appIdLength: appId.length,
  hasSecret: !!secretKey,
  secretLength: secretKey.length
});

const testOrderPayload = {
  order_amount: 20.00,
  order_currency: 'INR',
  order_id: 'test_order_' + Date.now(),
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

async function testRaw(apiVersion, payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      'https://sandbox.cashfree.com/pg/orders',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-version': apiVersion,
          'x-client-id': appId,
          'x-client-secret': secretKey,
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        let data = '';
        res.on('data', (c) => data += c);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );
    req.on('error', (err) => resolve({ error: err.message }));
    req.write(body);
    req.end();
  });
}

async function testSDK(apiVersion, payload) {
  const cashfree = new Cashfree(CFEnvironment.SANDBOX, appId, secretKey);
  cashfree.XApiVersion = apiVersion;
  try {
    const res = await cashfree.PGCreateOrder(payload);
    return { status: res.status, data: res.data };
  } catch (err) {
    return {
      status: err?.response?.status,
      data: err?.response?.data,
      message: err.message
    };
  }
}

async function run() {
  console.log('--- Testing Raw with 2025-01-01 ---');
  const res1 = await testRaw('2025-01-01', testOrderPayload);
  console.log('Raw 2025-01-01 Result:', {
    status: res1.status,
    hasSessionId: !!res1.data?.payment_session_id,
    error: res1.data?.message || res1.error
  });

  console.log('--- Testing Raw with 2023-08-01 ---');
  const res2 = await testRaw('2023-08-01', {
    ...testOrderPayload,
    order_id: 'test_order_' + (Date.now() + 1)
  });
  console.log('Raw 2023-08-01 Result:', {
    status: res2.status,
    hasSessionId: !!res2.data?.payment_session_id,
    dataOrError: res2.data
  });

  console.log('--- Testing SDK with 2023-08-01 ---');
  const res3 = await testSDK('2023-08-01', {
    ...testOrderPayload,
    order_id: 'test_order_' + (Date.now() + 2)
  });
  console.log('SDK 2023-08-01 Result:', {
    status: res3.status,
    hasSessionId: !!res3.data?.payment_session_id,
    dataOrError: res3.data || res3.message
  });
}

run();
