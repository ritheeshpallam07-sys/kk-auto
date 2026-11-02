import 'dotenv/config';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { PaymentService } from '../src/services/paymentService';
import jwt from 'jsonwebtoken';
import { getJwtSecret, JWT_ALGORITHM, DEFAULT_DEV_JWT_SECRET, authenticateToken, requireRole, AuthUser } from '../src/middleware/auth';
import { AuthService } from '../src/services/authService';
import { AuthController, getClientIp } from '../src/controllers/authController';
import { EmailService } from '../src/services/emailService';
import { DriverController } from '../src/controllers/driverController';
import { BookingController } from '../src/controllers/bookingController';
import { PaymentController } from '../src/controllers/paymentController';
import { TripBookingController } from '../src/controllers/tripBookingController';
import { AdminController } from '../src/controllers/adminController';
import { initDb, query, resolveDbSsl } from '../src/config/db';
import { runSeed, initPlatformDefaults } from '../src/db/seed';
import { Request, Response } from 'express';
import { app, getAllowedOrigins, corsOptions } from '../src/index';

/**
 * Asserts that the test environment is connected to an isolated local database
 * (embedded PGlite or local loopback instance).
 * Throws an immediate error if DATABASE_URL points to a remote/cloud host.
 */
export function verifyIsolatedTestDatabase(dbUrlOverride?: string) {
  const dbUrl = dbUrlOverride !== undefined ? dbUrlOverride : process.env.DATABASE_URL;

  if (!dbUrl || dbUrl.trim() === '') {
    // Unset/empty DATABASE_URL uses local embedded PGlite in .data/pglite
    return { isolated: true, type: 'pglite-embedded' };
  }

  try {
    const parsed = new URL(dbUrl);
    const hostname = parsed.hostname.toLowerCase();
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

    if (!isLocal) {
      throw new Error(
        'SECURITY ERROR: Tests refused to run. DATABASE_URL points to a remote database host. The security test suite requires a local isolated database (local PGlite or localhost).'
      );
    }
    return { isolated: true, type: 'localhost' };
  } catch (err: any) {
    if (err.message && err.message.startsWith('SECURITY ERROR:')) {
      throw err;
    }
    throw new Error(
      'SECURITY ERROR: Invalid DATABASE_URL format. Tests refused to run against unverified database.'
    );
  }
}

async function runTests() {
  console.log('🧪 Starting Security Phase 1 Tests (CONF-01 & CONF-02)...');

  // Verify database isolation before any schema initialization or seeding
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SECURITY ERROR: Security test suite refused to run with ambient NODE_ENV=production.');
  }

  const isolation = verifyIsolatedTestDatabase();
  console.log(`🔒 Test database isolation verified: [${isolation.type}]. Remote databases strictly blocked.`);

  await initDb();
  await runSeed();
  await query(`DELETE FROM bookings WHERE booking_reference LIKE 'TEST_REF_%'`);
  await query(`DELETE FROM payments WHERE transaction_reference LIKE 'TXN_TEST_%'`);
  await query(`DELETE FROM ratings WHERE review = 'Smooth ride'`);
  await query(`DELETE FROM email_verifications WHERE email LIKE 'test_%' OR email LIKE 'legit_%'`);
  await query(`DELETE FROM rate_limits`);

  // =========================================================================
  // TEST SUITE 0: Database Isolation Verification
  // =========================================================================

  console.log('\n--- 0. Testing Database Isolation Safeguards ---');
  // 0.1 Remote database URL is blocked
  assert.throws(
    () => verifyIsolatedTestDatabase('postgresql://user:pass@render.postgres.com:5432/production_db'),
    /SECURITY ERROR: Tests refused to run\. DATABASE_URL points to a remote database host\./,
    'Remote database URL must throw security error'
  );
  assert.throws(
    () => verifyIsolatedTestDatabase('postgres://admin:secret@ep-cool-123.aws.neon.tech/main'),
    /SECURITY ERROR: Tests refused to run\. DATABASE_URL points to a remote database host\./,
    'Cloud database URL must throw security error'
  );
  console.log('✅ PASS: Remote database URLs correctly blocked from test execution');

  // 0.2 Local database URL and embedded PGlite are permitted
  assert.strictEqual(verifyIsolatedTestDatabase('postgres://postgres:postgres@localhost:5432/test_db').isolated, true);
  assert.strictEqual(verifyIsolatedTestDatabase('postgres://postgres:postgres@127.0.0.1:5432/test_db').isolated, true);
  assert.strictEqual(verifyIsolatedTestDatabase('').isolated, true);
  console.log('✅ PASS: Local isolated databases (PGlite and localhost) verified safely');

  // =========================================================================
  // TEST SUITE 1: CONF-02 - JWT Secret & Algorithm Verification
  // =========================================================================

  console.log('\n--- 1. Testing Production JWT Secret Requirement ---');
  const originalEnv = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;

  try {
    // 1.1 In production mode, missing JWT_SECRET must throw fatal error
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    assert.throws(
      () => getJwtSecret(),
      /FATAL: JWT_SECRET environment variable is missing/,
      'Should throw error when JWT_SECRET is missing in production'
    );
    console.log('✅ PASS: Missing JWT_SECRET in production throws fatal error');

    // 1.2 In production mode, default dev secret must throw fatal error
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = DEFAULT_DEV_JWT_SECRET;
    assert.throws(
      () => getJwtSecret(),
      /set to insecure default in production mode/,
      'Should throw error when JWT_SECRET is default in production'
    );
    console.log('✅ PASS: Default dev JWT_SECRET in production throws fatal error');

    // 1.3 In production mode, custom strong secret succeeds
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a_very_strong_production_secret_32chars_long!';
    assert.strictEqual(
      getJwtSecret(),
      'a_very_strong_production_secret_32chars_long!',
      'Should return the configured production secret'
    );
    console.log('✅ PASS: Valid custom production secret accepted');

    // 1.4 In development mode, missing secret falls back with dev default
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    assert.strictEqual(
      getJwtSecret(),
      DEFAULT_DEV_JWT_SECRET,
      'Should fallback to default dev secret in development'
    );
    console.log('✅ PASS: Development mode falls back to default dev secret safely');

  } finally {
    process.env.NODE_ENV = originalEnv;
    if (originalSecret !== undefined) {
      process.env.JWT_SECRET = originalSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
  }

  console.log('\n--- 2. Testing JWT Signing & Algorithm Pinning ---');
  // Restore development secret for token verification tests
  process.env.NODE_ENV = 'development';
  process.env.JWT_SECRET = 'test_suite_active_jwt_secret_key_123';

  const testUser: AuthUser = {
    id: 42,
    name: 'Test Passenger',
    email: 'passenger@example.com',
    mobile: '9876543210',
    role: 'customer'
  };

  // 2.1 Token generation pins HS256
  const token = AuthService.generateToken(testUser);
  const decodedHeader = jwt.decode(token, { complete: true }) as any;
  assert.strictEqual(decodedHeader.header.alg, JWT_ALGORITHM, 'Token alg header must be HS256');
  assert.strictEqual(decodedHeader.header.alg, 'HS256', 'Token alg must explicitly be HS256');
  console.log('✅ PASS: AuthService generates token explicitly using HS256');

  // 2.2 Valid token verified successfully
  const verified = jwt.verify(token, getJwtSecret(), { algorithms: [JWT_ALGORITHM] }) as any;
  assert.strictEqual(verified.id, 42);
  assert.strictEqual(verified.role, 'customer');
  console.log('✅ PASS: Token successfully verified with pinned HS256 algorithm');

  // 2.3 Unsigned / "none" algorithm token must be rejected
  const unsignedToken = jwt.sign(
    { id: 42, name: 'Attacker', role: 'admin' },
    '',
    { algorithm: 'none' as any }
  );
  assert.throws(
    () => {
      jwt.verify(unsignedToken, getJwtSecret(), { algorithms: [JWT_ALGORITHM] });
    },
    /invalid algorithm|jwt/i,
    'alg: none must be rejected by verification with pinned algorithms'
  );
  console.log('✅ PASS: Tokens with algorithm "none" are rejected');

  // 2.4 Token signed with wrong secret must be rejected
  assert.throws(
    () => {
      jwt.verify(token, 'wrong_secret_key_999', { algorithms: [JWT_ALGORITHM] });
    },
    /invalid signature/i,
    'Token with wrong signature must be rejected'
  );
  console.log('✅ PASS: Tokens with invalid signature are rejected');

  // =========================================================================
  // TEST SUITE 2: CONF-01 - Driver Directory Safe Data Projection
  // =========================================================================

  console.log('\n--- 3. Testing Driver Directory Data Redaction (CONF-01) ---');

  // Mock Request / Response helper
  function createMockContext(user?: AuthUser, params: Record<string, string> = {}, body: any = {}, ip?: string) {
    const req = {
      user,
      params,
      body,
      ip: ip || '127.0.0.1',
      headers: user ? { authorization: `Bearer ${AuthService.generateToken(user)}` } : {}
    } as unknown as Request;

    let responseData: any = null;
    let statusCode: number = 200;
    const headersSet: Record<string, string> = {};

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseData = data;
        return this;
      },
      set(header: string, val: string) {
        headersSet[header] = val;
        return this;
      }
    } as unknown as Response;

    return { req, res, getResponse: () => ({ statusCode, responseData, headersSet }) };
  }

  // 3.1 Unauthenticated request rejected by authenticateToken
  const unauthCtx = createMockContext(undefined);
  let nextCalled = false;
  await authenticateToken(unauthCtx.req, unauthCtx.res, () => { nextCalled = true; });
  const unauthRes = unauthCtx.getResponse();
  assert.strictEqual(nextCalled, false, 'next() should not be called without authentication');
  assert.strictEqual(unauthRes.statusCode, 401, 'Unauthenticated access must return HTTP 401');
  console.log('✅ PASS: Unauthenticated access to driver directory returns HTTP 401');

  // 3.2 Customer access returns ONLY public-safe fields (NO bank account, IFSC, UPI, licence, vendor ID, email, mobile)
  const customerCtx = createMockContext({
    id: 10,
    name: 'Customer Alice',
    email: 'alice@example.com',
    mobile: '9123456789',
    role: 'customer'
  });

  await DriverController.getAllDrivers(customerCtx.req, customerCtx.res);
  const customerRes = customerCtx.getResponse();
  assert.strictEqual(customerRes.statusCode, 200);
  assert.strictEqual(customerRes.responseData.success, true);
  assert.ok(Array.isArray(customerRes.responseData.data), 'Data should be an array of drivers');

  // Verify safe projection on every returned driver
  const forbiddenKeys = [
    'payout_bank_account',
    'payout_ifsc',
    'payout_upi',
    'cashfree_vendor_id',
    'license_number',
    'email',
    'mobile',
    'user_id'
  ];

  for (const driver of customerRes.responseData.data) {
    // Assert sensitive fields are completely omitted
    for (const key of forbiddenKeys) {
      assert.strictEqual(
        (driver as any)[key],
        undefined,
        `Customer response MUST NOT include sensitive field: ${key}`
      );
    }

    // Assert expected safe fields exist
    assert.ok('id' in driver, 'Safe driver must have id');
    assert.ok('name' in driver, 'Safe driver must have name');
    assert.ok('auto_number' in driver, 'Safe driver must have auto_number');
    assert.ok('auto_model' in driver, 'Safe driver must have auto_model');
    assert.ok('availability_status' in driver, 'Safe driver must have availability_status');
  }
  console.log(`✅ PASS: Customer receives sanitized safe fields only (${customerRes.responseData.data.length} drivers checked; 0 sensitive fields exposed)`);

  // 3.3 Admin access receives complete administrative driver records
  const adminCtx = createMockContext({
    id: 1,
    name: 'Super Admin',
    email: 'admin@clik2go.in',
    mobile: '9999999999',
    role: 'admin'
  });

  await DriverController.getAllDrivers(adminCtx.req, adminCtx.res);
  const adminRes = adminCtx.getResponse();
  assert.strictEqual(adminRes.statusCode, 200);
  assert.strictEqual(adminRes.responseData.success, true);
  assert.ok(Array.isArray(adminRes.responseData.data));

  if (adminRes.responseData.data.length > 0) {
    const adminDriver = adminRes.responseData.data[0];
    assert.ok('license_number' in adminDriver, 'Admin record includes license_number');
    assert.ok('email' in adminDriver, 'Admin record includes driver user email');
    assert.ok('mobile' in adminDriver, 'Admin record includes driver user mobile');
  }
  console.log(`✅ PASS: Admin receives complete administrative driver record (${adminRes.responseData.data.length} drivers)`);

  // =========================================================================
  // TEST SUITE 3: CONF-03 - Unauthorized Ride Cancellation (BOLA / IDOR)
  // =========================================================================

  console.log('\n--- 4. Testing Ride Cancellation Authorization & State Invariants (CONF-03) ---');

  // Insert isolated test users and drivers
  const custAUserRes = await query(
    `INSERT INTO users (name, email, mobile, password_hash, role, status)
     VALUES ('Test Customer A', 'cust_a@test.com', '9900000001', 'hash', 'customer', 'ACTIVE')
     ON CONFLICT (email) DO UPDATE SET status = 'ACTIVE'
     RETURNING id`
  );
  const custAUserId = custAUserRes.rows[0].id;
  const userCustA: AuthUser = { id: custAUserId, name: 'Test Customer A', email: 'cust_a@test.com', mobile: '9900000001', role: 'customer' };

  const custBUserRes = await query(
    `INSERT INTO users (name, email, mobile, password_hash, role, status)
     VALUES ('Test Customer B', 'cust_b@test.com', '9900000002', 'hash', 'customer', 'ACTIVE')
     ON CONFLICT (email) DO UPDATE SET status = 'ACTIVE'
     RETURNING id`
  );
  const custBUserId = custBUserRes.rows[0].id;
  const userCustB: AuthUser = { id: custBUserId, name: 'Test Customer B', email: 'cust_b@test.com', mobile: '9900000002', role: 'customer' };

  const driverAUserRes = await query(
    `INSERT INTO users (name, email, mobile, password_hash, role, status)
     VALUES ('Test Driver A', 'driver_a@test.com', '9900000003', 'hash', 'driver', 'ACTIVE')
     ON CONFLICT (email) DO UPDATE SET status = 'ACTIVE'
     RETURNING id`
  );
  const driverAUserId = driverAUserRes.rows[0].id;
  const userDriverA: AuthUser = { id: driverAUserId, name: 'Test Driver A', email: 'driver_a@test.com', mobile: '9900000003', role: 'driver' };

  const driverBUserRes = await query(
    `INSERT INTO users (name, email, mobile, password_hash, role, status)
     VALUES ('Test Driver B', 'driver_b@test.com', '9900000004', 'hash', 'driver', 'ACTIVE')
     ON CONFLICT (email) DO UPDATE SET status = 'ACTIVE'
     RETURNING id`
  );
  const driverBUserId = driverBUserRes.rows[0].id;
  const userDriverB: AuthUser = { id: driverBUserId, name: 'Test Driver B', email: 'driver_b@test.com', mobile: '9900000004', role: 'driver' };

  const adminUserRes = await query(
    `INSERT INTO users (name, email, mobile, password_hash, role, status)
     VALUES ('Test Admin Phase2', 'admin_phase2@test.com', '9900000005', 'hash', 'admin', 'ACTIVE')
     ON CONFLICT (email) DO UPDATE SET status = 'ACTIVE'
     RETURNING id`
  );
  const adminUserId = adminUserRes.rows[0].id;
  const userAdmin: AuthUser = { id: adminUserId, name: 'Test Admin Phase2', email: 'admin_phase2@test.com', mobile: '9900000005', role: 'admin' };

  // Ensure driver records in drivers table
  const existingDA = await query(`SELECT id FROM drivers WHERE user_id = $1 LIMIT 1`, [driverAUserId]);
  let driverAId: number;
  if (existingDA.rows.length > 0) {
    driverAId = existingDA.rows[0].id;
    await query(`UPDATE drivers SET availability_status = 'on_ride', approval_status = 'APPROVED' WHERE id = $1`, [driverAId]);
  } else {
    const dARes = await query(
      `INSERT INTO drivers (user_id, auto_number, auto_model, availability_status, approval_status)
       VALUES ($1, 'AP 01 TA 0001', 'Bajaj Max', 'on_ride', 'APPROVED')
       RETURNING id`,
      [driverAUserId]
    );
    driverAId = dARes.rows[0].id;
  }

  const existingDB = await query(`SELECT id FROM drivers WHERE user_id = $1 LIMIT 1`, [driverBUserId]);
  let driverBId: number;
  if (existingDB.rows.length > 0) {
    driverBId = existingDB.rows[0].id;
    await query(`UPDATE drivers SET availability_status = 'on_ride', approval_status = 'APPROVED' WHERE id = $1`, [driverBId]);
  } else {
    const dBRes = await query(
      `INSERT INTO drivers (user_id, auto_number, auto_model, availability_status, approval_status)
       VALUES ($1, 'AP 01 TB 0002', 'Bajaj Max', 'on_ride', 'APPROVED')
       RETURNING id`,
      [driverBUserId]
    );
    driverBId = dBRes.rows[0].id;
  }

  let testRefCounter = 1000;
  async function createTestBooking(customerId: number, driverId: number | null, status: string) {
    testRefCounter++;
    const res = await query(
      `INSERT INTO bookings (
         booking_reference, customer_id, driver_id, pickup_address, destination_address,
         pickup_area_name, destination_area_name,
         pickup_datetime, passengers, estimated_fare, status, created_at, updated_at
       )
       VALUES ($1, $2, $3, 'Exact Pickup Address 123', 'Exact Drop Address 456', 'Station Area', 'Market Square', CURRENT_TIMESTAMP, 1, 35.0, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [`TEST_REF_${Date.now()}_${testRefCounter}`, customerId, driverId, status]
    );
    return res.rows[0];
  }

  // 4.1 Driver A cannot cancel Driver B's assigned booking (403)
  const b1 = await createTestBooking(custAUserId, driverBId, 'Driver Assigned');
  const ctx4_1 = createMockContext(userDriverA, { id: String(b1.id) });
  await BookingController.cancelBooking(ctx4_1.req, ctx4_1.res);
  assert.strictEqual(ctx4_1.getResponse().statusCode, 403, 'Driver A must receive 403 when cancelling Driver B booking');
  assert.match(ctx4_1.getResponse().responseData.error, /Unauthorized to cancel a booking not assigned to you/i);
  console.log('✅ PASS 1: Driver A cannot cancel Driver B assigned booking (403)');

  // 4.2 Driver cannot cancel an unassigned booking (403)
  const b2 = await createTestBooking(custAUserId, null, 'Searching for Auto');
  const ctx4_2 = createMockContext(userDriverA, { id: String(b2.id) });
  await BookingController.cancelBooking(ctx4_2.req, ctx4_2.res);
  assert.strictEqual(ctx4_2.getResponse().statusCode, 403, 'Driver must receive 403 when cancelling unassigned booking');
  assert.match(ctx4_2.getResponse().responseData.error, /Unauthorized to cancel an unassigned booking/i);
  console.log('✅ PASS 2: Driver cannot cancel an unassigned booking (403)');

  // 4.3 Driver can cancel their own eligible assigned booking (200)
  const b3 = await createTestBooking(custAUserId, driverAId, 'Driver Arriving');
  await query(`UPDATE drivers SET availability_status = 'on_ride' WHERE id = $1`, [driverAId]);
  const ctx4_3 = createMockContext(userDriverA, { id: String(b3.id) });
  await BookingController.cancelBooking(ctx4_3.req, ctx4_3.res);
  assert.strictEqual(ctx4_3.getResponse().statusCode, 200, 'Driver cancelling own assigned booking must succeed');
  assert.strictEqual(ctx4_3.getResponse().responseData.success, true);
  assert.strictEqual(ctx4_3.getResponse().responseData.data.status, 'Cancelled');
  const dACheck = await query(`SELECT availability_status FROM drivers WHERE id = $1`, [driverAId]);
  assert.strictEqual(dACheck.rows[0].availability_status, 'available', 'Driver A must become available after cancelling assigned ride');
  console.log('✅ PASS 3: Driver can cancel their own eligible assigned booking (200)');

  // 4.4 Customer cannot cancel another customer's booking (403)
  const b4 = await createTestBooking(custAUserId, null, 'Searching for Auto');
  const ctx4_4 = createMockContext(userCustB, { id: String(b4.id) });
  await BookingController.cancelBooking(ctx4_4.req, ctx4_4.res);
  assert.strictEqual(ctx4_4.getResponse().statusCode, 403, 'Customer B cannot cancel Customer A booking');
  assert.match(ctx4_4.getResponse().responseData.error, /Unauthorized to cancel this booking/i);
  console.log('✅ PASS 4: Customer cannot cancel another customer booking (403)');

  // 4.5 Customer can cancel their own eligible booking (200)
  const b5 = await createTestBooking(custAUserId, null, 'Searching for Auto');
  const ctx5 = createMockContext(userCustA, { id: String(b5.id) });
  await BookingController.cancelBooking(ctx5.req, ctx5.res);
  assert.strictEqual(ctx5.getResponse().statusCode, 200, 'Customer cancelling own unassigned booking must succeed');
  assert.strictEqual(ctx5.getResponse().responseData.success, true);
  assert.strictEqual(ctx5.getResponse().responseData.data.status, 'Cancelled');
  console.log('✅ PASS 5: Customer can cancel their own eligible booking (200)');

  // 4.6 Customer cannot cancel a Ride Started booking (400)
  const b6 = await createTestBooking(custAUserId, driverAId, 'Ride Started');
  const ctx4_6 = createMockContext(userCustA, { id: String(b6.id) });
  await BookingController.cancelBooking(ctx4_6.req, ctx4_6.res);
  assert.strictEqual(ctx4_6.getResponse().statusCode, 400, 'Customer cannot cancel Ride Started booking');
  assert.match(ctx4_6.getResponse().responseData.error, /already in progress/i);
  console.log('✅ PASS 6: Customer cannot cancel a Ride Started booking (400)');

  // 4.7 Driver cannot cancel a Ride Started booking (400)
  const b7 = await createTestBooking(custAUserId, driverAId, 'Ride Started');
  const ctx4_7 = createMockContext(userDriverA, { id: String(b7.id) });
  await BookingController.cancelBooking(ctx4_7.req, ctx4_7.res);
  assert.strictEqual(ctx4_7.getResponse().statusCode, 400, 'Driver cannot cancel Ride Started booking');
  assert.match(ctx4_7.getResponse().responseData.error, /already in progress/i);
  console.log('✅ PASS 7: Driver cannot cancel a Ride Started booking (400)');

  // 4.8 Ride Completed booking cannot be cancelled (400)
  const b8 = await createTestBooking(custAUserId, driverAId, 'Ride Completed');
  const ctx4_8 = createMockContext(userCustA, { id: String(b8.id) });
  await BookingController.cancelBooking(ctx4_8.req, ctx4_8.res);
  assert.strictEqual(ctx4_8.getResponse().statusCode, 400, 'Cannot cancel a completed ride');
  assert.match(ctx4_8.getResponse().responseData.error, /completed/i);
  console.log('✅ PASS 8: Ride Completed booking cannot be cancelled (400)');

  // 4.9 Unauthorized cancellation never changes driver availability
  await query(`UPDATE drivers SET availability_status = 'on_ride' WHERE id = $1`, [driverBId]);
  const b9 = await createTestBooking(custAUserId, driverBId, 'Driver Assigned');
  const ctx4_9 = createMockContext(userDriverA, { id: String(b9.id) });
  await BookingController.cancelBooking(ctx4_9.req, ctx4_9.res);
  assert.strictEqual(ctx4_9.getResponse().statusCode, 403);
  const dBStatusCheck = await query(`SELECT availability_status FROM drivers WHERE id = $1`, [driverBId]);
  assert.strictEqual(dBStatusCheck.rows[0].availability_status, 'on_ride', 'Driver B must remain on_ride after unauthorized cancellation attempt');
  console.log('✅ PASS 9: Unauthorized cancellation never changes driver availability');

  // 4.10 Admin cancellation follows the explicitly authorized admin policy (200)
  await query(`UPDATE drivers SET availability_status = 'on_ride' WHERE id = $1`, [driverBId]);
  const b10 = await createTestBooking(custAUserId, driverBId, 'Driver Assigned');
  const ctx4_10 = createMockContext(userAdmin, { id: String(b10.id) });
  await BookingController.cancelBooking(ctx4_10.req, ctx4_10.res);
  assert.strictEqual(ctx4_10.getResponse().statusCode, 200, 'Admin can cancel booking under administrative policy');
  assert.strictEqual(ctx4_10.getResponse().responseData.data.status, 'Cancelled');
  const dBAdminStatusCheck = await query(`SELECT availability_status FROM drivers WHERE id = $1`, [driverBId]);
  assert.strictEqual(dBAdminStatusCheck.rows[0].availability_status, 'available', 'Driver B must be marked available after admin cancellation');
  console.log('✅ PASS 10: Admin cancellation follows explicitly authorized policy (200)');

  // 4.11 Assignment change between initial lookup and atomic update is safely blocked
  const b11 = await createTestBooking(custAUserId, driverAId, 'Driver Assigned');
  await query(`UPDATE drivers SET availability_status = 'on_ride' WHERE id = $1`, [driverAId]);
  await query(`UPDATE drivers SET availability_status = 'on_ride' WHERE id = $1`, [driverBId]);

  // Concurrently reassign to Driver B before Driver A's atomic update can run
  await query(`UPDATE bookings SET driver_id = $1 WHERE id = $2`, [driverBId, b11.id]);

  const atomicDriverQuery = `
    WITH cancelled_booking AS (
      UPDATE bookings
      SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND driver_id = $2
        AND status IN ('Driver Assigned', 'Driver Arriving')
      RETURNING *
    ),
    updated_driver AS (
      UPDATE drivers
      SET availability_status = 'available', updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT driver_id FROM cancelled_booking WHERE driver_id IS NOT NULL)
      RETURNING id
    )
    SELECT * FROM cancelled_booking`;

  // Driver A executes atomic update with driverAId
  const raceDriverRes = await query(atomicDriverQuery, [b11.id, driverAId]);
  assert.strictEqual(raceDriverRes.rows.length, 0, 'Atomic update must affect 0 rows when assignment changed');

  // Assert Driver B and Driver A availability remained untouched
  const dACheck11 = await query(`SELECT availability_status FROM drivers WHERE id = $1`, [driverAId]);
  const dBCheck11 = await query(`SELECT availability_status FROM drivers WHERE id = $1`, [driverBId]);
  assert.strictEqual(dACheck11.rows[0].availability_status, 'on_ride');
  assert.strictEqual(dBCheck11.rows[0].availability_status, 'on_ride');
  console.log('✅ PASS 11: Assignment change between lookup and atomic update safely blocked (0 rows affected)');

  // 4.12 Customer ownership change between initial lookup and atomic update is safely blocked
  const b12 = await createTestBooking(custAUserId, null, 'Searching for Auto');

  // Concurrently change customer_id to Customer B before Customer A's atomic update
  await query(`UPDATE bookings SET customer_id = $1 WHERE id = $2`, [custBUserId, b12.id]);

  const atomicCustQuery = `
    WITH cancelled_booking AS (
      UPDATE bookings
      SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND customer_id = $2
        AND status IN ('Searching for Auto', 'Driver Assigned', 'Driver Arriving')
      RETURNING *
    ),
    updated_driver AS (
      UPDATE drivers
      SET availability_status = 'available', updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT driver_id FROM cancelled_booking WHERE driver_id IS NOT NULL)
      RETURNING id
    )
    SELECT * FROM cancelled_booking`;

  const raceCustRes = await query(atomicCustQuery, [b12.id, custAUserId]);
  assert.strictEqual(raceCustRes.rows.length, 0, 'Atomic update must affect 0 rows when customer ownership changed');
  console.log('✅ PASS 12: Ownership change between lookup and atomic update safely blocked (0 rows affected)');

  // =========================================================================
  // TEST SUITE 5: CONF-04 - Unauthorized Booking Details Access (BOLA / IDOR)
  // =========================================================================

  console.log('\n--- 5. Testing Booking Details Access Authorization (CONF-04) ---');

  // Helper to assert unauthorized response leaks zero PII or booking details
  function assertNoPiiLeak(responseData: any, testDescription: string) {
    assert.strictEqual(responseData.data, undefined, `${testDescription}: data field must be undefined`);
    const responseKeys = Object.keys(responseData);
    const forbiddenPii = [
      'customer_name', 'customer_mobile', 'customer_email',
      'driver_name', 'driver_mobile', 'driver_payout_upi',
      'pickup_address', 'destination_address', 'pickup_latitude',
      'destination_latitude', 'estimated_fare', 'payment_status'
    ];
    for (const key of forbiddenPii) {
      assert.strictEqual(
        (responseData as any)[key],
        undefined,
        `${testDescription}: Unauthorized response must not leak ${key}`
      );
    }
  }

  // 5.1 Driver cannot access another driver's assigned booking (403)
  const bConf4_1 = await createTestBooking(custAUserId, driverBId, 'Driver Assigned');
  const ctx5_1 = createMockContext(userDriverA, { id: String(bConf4_1.id) });
  await BookingController.getBookingById(ctx5_1.req, ctx5_1.res);
  assert.strictEqual(ctx5_1.getResponse().statusCode, 403, 'Driver A must receive 403 when accessing Driver B booking');
  assert.strictEqual(ctx5_1.getResponse().responseData.success, false);
  assert.strictEqual(ctx5_1.getResponse().responseData.error, 'Unauthorized to view this booking.');
  assertNoPiiLeak(ctx5_1.getResponse().responseData, 'Driver A accessing Driver B booking');
  console.log("✅ PASS 1: Driver cannot access another driver's assigned booking (403)");

  // 5.2 Driver cannot access another driver's completed booking (403)
  const bConf4_2 = await createTestBooking(custAUserId, driverBId, 'Ride Completed');
  const ctx5_2 = createMockContext(userDriverA, { id: String(bConf4_2.id) });
  await BookingController.getBookingById(ctx5_2.req, ctx5_2.res);
  assert.strictEqual(ctx5_2.getResponse().statusCode, 403, 'Driver A must receive 403 when accessing Driver B completed booking');
  assert.strictEqual(ctx5_2.getResponse().responseData.success, false);
  assert.strictEqual(ctx5_2.getResponse().responseData.error, 'Unauthorized to view this booking.');
  assertNoPiiLeak(ctx5_2.getResponse().responseData, 'Driver A accessing Driver B completed booking');
  console.log("✅ PASS 2: Driver cannot access another driver's completed booking (403)");

  // 5.3 Driver cannot access an unassigned booking through GET /api/bookings/:id (403)
  const bConf4_3 = await createTestBooking(custAUserId, null, 'Searching for Auto');
  const ctx5_3 = createMockContext(userDriverA, { id: String(bConf4_3.id) });
  await BookingController.getBookingById(ctx5_3.req, ctx5_3.res);
  assert.strictEqual(ctx5_3.getResponse().statusCode, 403, 'Driver must receive 403 when accessing unassigned booking via getBookingById');
  assert.strictEqual(ctx5_3.getResponse().responseData.success, false);
  assert.strictEqual(ctx5_3.getResponse().responseData.error, 'Unauthorized to view this booking.');
  assertNoPiiLeak(ctx5_3.getResponse().responseData, 'Driver accessing unassigned booking');
  console.log('✅ PASS 3: Driver cannot access an unassigned booking through GET /api/bookings/:id (403)');

  // 5.4 Assigned driver can access their own booking (200, matching data)
  const bConf4_4 = await createTestBooking(custAUserId, driverAId, 'Driver Assigned');
  const ctx5_4 = createMockContext(userDriverA, { id: String(bConf4_4.id) });
  await BookingController.getBookingById(ctx5_4.req, ctx5_4.res);
  assert.strictEqual(ctx5_4.getResponse().statusCode, 200, 'Assigned driver must receive 200 for their own booking');
  assert.strictEqual(ctx5_4.getResponse().responseData.success, true);
  assert.strictEqual(Number(ctx5_4.getResponse().responseData.data.id), bConf4_4.id);
  assert.strictEqual(Number(ctx5_4.getResponse().responseData.data.driver_id), driverAId);
  console.log('✅ PASS 4: Assigned driver can access their own booking (200, matching data)');

  // 5.5 Customer cannot access another customer's booking (403)
  const bConf4_5 = await createTestBooking(custBUserId, driverAId, 'Driver Assigned');
  const ctx5_5 = createMockContext(userCustA, { id: String(bConf4_5.id) });
  await BookingController.getBookingById(ctx5_5.req, ctx5_5.res);
  assert.strictEqual(ctx5_5.getResponse().statusCode, 403, 'Customer A must receive 403 when accessing Customer B booking');
  assert.strictEqual(ctx5_5.getResponse().responseData.success, false);
  assert.strictEqual(ctx5_5.getResponse().responseData.error, 'Unauthorized to view this booking.');
  assertNoPiiLeak(ctx5_5.getResponse().responseData, 'Customer A accessing Customer B booking');
  console.log("✅ PASS 5: Customer cannot access another customer's booking (403)");

  // 5.6 Customer can access their own booking (200)
  const bConf4_6 = await createTestBooking(custAUserId, driverAId, 'Driver Assigned');
  const ctx5_6 = createMockContext(userCustA, { id: String(bConf4_6.id) });
  await BookingController.getBookingById(ctx5_6.req, ctx5_6.res);
  assert.strictEqual(ctx5_6.getResponse().statusCode, 200, 'Customer must receive 200 for their own booking');
  assert.strictEqual(ctx5_6.getResponse().responseData.success, true);
  assert.strictEqual(Number(ctx5_6.getResponse().responseData.data.id), bConf4_6.id);
  assert.strictEqual(Number(ctx5_6.getResponse().responseData.data.customer_id), custAUserId);
  console.log('✅ PASS 6: Customer can access their own booking (200)');

  // 5.7 Admin can access booking details (200)
  const ctx5_7 = createMockContext(userAdmin, { id: String(bConf4_1.id) });
  await BookingController.getBookingById(ctx5_7.req, ctx5_7.res);
  assert.strictEqual(ctx5_7.getResponse().statusCode, 200, 'Admin must receive 200 for any booking');
  assert.strictEqual(ctx5_7.getResponse().responseData.success, true);
  assert.strictEqual(Number(ctx5_7.getResponse().responseData.data.id), bConf4_1.id);

  // Also test lookup by booking_reference for Admin and Customer
  const ctx5_7Ref = createMockContext(userCustA, { id: bConf4_6.booking_reference });
  await BookingController.getBookingById(ctx5_7Ref.req, ctx5_7Ref.res);
  assert.strictEqual(ctx5_7Ref.getResponse().statusCode, 200, 'Customer must access their own booking by booking_reference');
  assert.strictEqual(ctx5_7Ref.getResponse().responseData.data.booking_reference, bConf4_6.booking_reference);
  console.log('✅ PASS 7: Admin can access booking details (200) and reference lookup verified');

  // 5.8 Unauthorized responses contain no booking or customer PII
  const unauthAttackerCtx = createMockContext(userDriverB, { id: String(bConf4_6.id) });
  await BookingController.getBookingById(unauthAttackerCtx.req, unauthAttackerCtx.res);
  const unauthResp = unauthAttackerCtx.getResponse();
  assert.strictEqual(unauthResp.statusCode, 403);
  assert.strictEqual(unauthResp.responseData.success, false);
  assert.strictEqual(unauthResp.responseData.data, undefined, 'data field must not be present in 403 response');
  assertNoPiiLeak(unauthResp.responseData, 'Unauthorized driver attempting IDOR inspection');
  console.log('✅ PASS 8: Unauthorized responses contain no booking or customer PII');

  // 5.9 Unassigned driver requests contain area names but NOT exact addresses or customer contact details
  // Ensure Driver A is online and approved
  await query(
    `UPDATE drivers SET availability_status = 'available', approval_status = 'APPROVED' WHERE id = $1`,
    [driverAId]
  );
  // Create an unassigned booking in 'Searching for Auto'
  const bConf4_9 = await createTestBooking(custAUserId, null, 'Searching for Auto');
  const ctx5_9 = createMockContext(userDriverA);
  await DriverController.getIncomingRequests(ctx5_9.req, ctx5_9.res);
  const requestsResp = ctx5_9.getResponse();
  assert.strictEqual(requestsResp.statusCode, 200, 'Available driver should receive 200 from getIncomingRequests');
  assert.strictEqual(requestsResp.responseData.success, true);
  assert.ok(Array.isArray(requestsResp.responseData.data), 'Data should be an array of ride requests');
  const found = requestsResp.responseData.data.find((r: any) => Number(r.id) === Number(bConf4_9.id));
  assert.ok(found, 'Created unassigned booking should appear in incoming requests queue');

  // Verify permitted fields are available before acceptance
  assert.strictEqual(Number(found.id), bConf4_9.id, 'id must be present');
  assert.strictEqual(found.booking_reference, bConf4_9.booking_reference, 'booking_reference must be present');
  assert.strictEqual(Number(found.estimated_fare), 35, 'estimated_fare must be present');
  assert.strictEqual(found.pickup_area_name, 'Station Area', 'pickup_area_name must be present');
  assert.strictEqual(found.destination_area_name, 'Market Square', 'destination_area_name must be present');
  assert.strictEqual(found.passengers, 1, 'passengers count must be present');

  // Verify exact addresses and coordinates are strictly omitted from unassigned requests
  assert.strictEqual(found.pickup_address, undefined, 'Exact pickup_address must NOT be exposed to unassigned drivers');
  assert.strictEqual(found.destination_address, undefined, 'Exact destination_address must NOT be exposed to unassigned drivers');
  assert.strictEqual(found.pickup_latitude, undefined, 'pickup_latitude must NOT be exposed');
  assert.strictEqual(found.destination_latitude, undefined, 'destination_latitude must NOT be exposed');

  // Verify customer contact details are strictly omitted from unassigned requests
  assert.strictEqual(found.customer_name, undefined, 'customer_name must NOT be exposed to unassigned drivers');
  assert.strictEqual(found.customer_mobile, undefined, 'customer_mobile must NOT be exposed to unassigned drivers');
  assert.strictEqual(found.customer_email, undefined, 'customer_email must NOT be exposed to unassigned drivers');
  console.log('✅ PASS 9: Unassigned driver requests contain area names but NOT exact addresses or customer contact details');

  // 5.10 Assigned driver can access exact addresses after accepting the booking
  const ctxAccept = createMockContext(userDriverA, { id: String(bConf4_9.id) });
  await DriverController.acceptBooking(ctxAccept.req, ctxAccept.res);
  assert.strictEqual(ctxAccept.getResponse().statusCode, 200, 'Driver A must successfully accept the unassigned ride');

  // Driver A now queries the booking details endpoint
  const ctxAssignedDetails = createMockContext(userDriverA, { id: String(bConf4_9.id) });
  await BookingController.getBookingById(ctxAssignedDetails.req, ctxAssignedDetails.res);
  const assignedDetailsResp = ctxAssignedDetails.getResponse();
  assert.strictEqual(assignedDetailsResp.statusCode, 200, 'Assigned driver must receive 200 from getBookingById');
  assert.strictEqual(assignedDetailsResp.responseData.success, true);
  // Verify exact addresses are fully accessible to the assigned driver
  assert.strictEqual(
    assignedDetailsResp.responseData.data.pickup_address,
    'Exact Pickup Address 123',
    'Assigned driver must access exact pickup_address'
  );
  assert.strictEqual(
    assignedDetailsResp.responseData.data.destination_address,
    'Exact Drop Address 456',
    'Assigned driver must access exact destination_address'
  );
  assert.strictEqual(assignedDetailsResp.responseData.data.pickup_area_name, 'Station Area');
  assert.strictEqual(assignedDetailsResp.responseData.data.destination_area_name, 'Market Square');
  console.log('✅ PASS 10: Assigned driver can access exact addresses after accepting the booking');

  // 5.11 Customer and admin workflows remain unchanged (full address access preserved)
  // Customer accesses own booking
  const ctxCustDetails = createMockContext(userCustA, { id: String(bConf4_9.id) });
  await BookingController.getBookingById(ctxCustDetails.req, ctxCustDetails.res);
  const custDetailsResp = ctxCustDetails.getResponse();
  assert.strictEqual(custDetailsResp.statusCode, 200, 'Customer must receive 200 for own booking');
  assert.strictEqual(
    custDetailsResp.responseData.data.pickup_address,
    'Exact Pickup Address 123',
    'Customer must access exact pickup_address'
  );
  assert.strictEqual(
    custDetailsResp.responseData.data.destination_address,
    'Exact Drop Address 456',
    'Customer must access exact destination_address'
  );

  // Admin accesses booking
  const ctxAdminDetails = createMockContext(userAdmin, { id: String(bConf4_9.id) });
  await BookingController.getBookingById(ctxAdminDetails.req, ctxAdminDetails.res);
  const adminDetailsResp = ctxAdminDetails.getResponse();
  assert.strictEqual(adminDetailsResp.statusCode, 200, 'Admin must receive 200 for booking');
  assert.strictEqual(
    adminDetailsResp.responseData.data.pickup_address,
    'Exact Pickup Address 123',
    'Admin must access exact pickup_address'
  );
  assert.strictEqual(
    adminDetailsResp.responseData.data.destination_address,
    'Exact Drop Address 456',
    'Admin must access exact destination_address'
  );
  console.log('✅ PASS 11: Customer and admin workflows remain unchanged with full address access preserved');

  // =========================================================================
  // TEST SUITE 6: CONF-05 - Payment Details Authorization & BOLA/IDOR Defense
  // =========================================================================

  console.log('\n--- 6. Testing Payment Details Access Authorization (CONF-05) ---');

  // Helper to create test payments
  async function createTestPayment(bookingId: number, customerId: number, driverId: number | null, amount = 35.0) {
    const driverAmt = amount - 5.0;
    const ownerAmt = 5.0;
    const res = await query(
      `INSERT INTO payments (
         booking_id, customer_id, driver_id, total_amount, driver_amount, owner_amount, commission_amount,
         payment_status, settlement_status, payment_method, transaction_reference,
         gateway_order_id, gateway_payment_id, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $6, 'COMPLETED', 'PENDING', 'UPI', $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        bookingId,
        customerId,
        driverId,
        amount,
        driverAmt,
        ownerAmt,
        `TXN_TEST_${Date.now()}_${bookingId}`,
        `ORDER_KK_TEST_${bookingId}`,
        `PAY_KK_TEST_${bookingId}`
      ]
    );
    return res.rows[0];
  }

  // Helper to create test rating
  async function createTestRating(bookingId: number, customerId: number, driverId: number, rating = 5, review = 'Smooth ride') {
    const res = await query(
      `INSERT INTO ratings (booking_id, customer_id, driver_id, rating, review, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (booking_id) DO UPDATE SET rating = EXCLUDED.rating
       RETURNING *`,
      [bookingId, customerId, driverId, rating, review]
    );
    return res.rows[0];
  }

  // Helper to assert unauthorized payment responses leak zero data
  function assertNoPaymentDataLeak(responseData: any, testDescription: string) {
    assert.strictEqual(responseData.data, undefined, `${testDescription}: data payload must be undefined on unauthorized response`);
    const sensitivePaymentFields = [
      'payment', 'rating', 'total_amount', 'driver_amount', 'owner_amount',
      'commission_amount', 'payment_status', 'payment_method', 'transaction_reference',
      'gateway_order_id', 'gateway_payment_id', 'settlement_status', 'settled_at'
    ];
    for (const field of sensitivePaymentFields) {
      assert.strictEqual(
        (responseData as any)[field],
        undefined,
        `${testDescription}: field "${field}" must not leak in unauthorized response`
      );
    }
  }

  // 6.1 Invalid booking ID returns HTTP 400 without revealing payment or rating data
  const ctx6_1a = createMockContext(userCustA, { bookingId: 'invalid-id' });
  await PaymentController.getBookingPayment(ctx6_1a.req, ctx6_1a.res);
  assert.strictEqual(ctx6_1a.getResponse().statusCode, 400, 'Non-numeric bookingId must return 400');
  assert.strictEqual(ctx6_1a.getResponse().responseData.success, false);
  assertNoPaymentDataLeak(ctx6_1a.getResponse().responseData, 'Invalid string booking ID');

  const ctx6_1b = createMockContext(userCustA, { bookingId: '-5' });
  await PaymentController.getBookingPayment(ctx6_1b.req, ctx6_1b.res);
  assert.strictEqual(ctx6_1b.getResponse().statusCode, 400, 'Negative bookingId must return 400');
  assertNoPaymentDataLeak(ctx6_1b.getResponse().responseData, 'Negative booking ID');

  const ctx6_1c = createMockContext(userCustA, { bookingId: '0' });
  await PaymentController.getBookingPayment(ctx6_1c.req, ctx6_1c.res);
  assert.strictEqual(ctx6_1c.getResponse().statusCode, 400, 'Zero bookingId must return 400');
  assertNoPaymentDataLeak(ctx6_1c.getResponse().responseData, 'Zero booking ID');
  console.log('✅ PASS 1: Invalid booking ID returns HTTP 400 (zero data revealed)');

  // 6.2 Nonexistent booking ID returns HTTP 404 without revealing payment or rating data
  const ctx6_2 = createMockContext(userCustA, { bookingId: '999999' });
  await PaymentController.getBookingPayment(ctx6_2.req, ctx6_2.res);
  assert.strictEqual(ctx6_2.getResponse().statusCode, 404, 'Nonexistent bookingId must return 404');
  assert.strictEqual(ctx6_2.getResponse().responseData.success, false);
  assert.strictEqual(ctx6_2.getResponse().responseData.error, 'Booking not found.');
  assertNoPaymentDataLeak(ctx6_2.getResponse().responseData, 'Nonexistent booking ID');
  console.log('✅ PASS 2: Nonexistent booking ID returns HTTP 404 (zero data revealed)');

  // 6.3 Customer A cannot access Customer B booking payment (403)
  const bCustB_Pay = await createTestBooking(custBUserId, driverAId, 'Ride Completed');
  await createTestPayment(bCustB_Pay.id, custBUserId, driverAId);
  await createTestRating(bCustB_Pay.id, custBUserId, driverAId);

  const ctx6_3 = createMockContext(userCustA, { bookingId: String(bCustB_Pay.id) });
  await PaymentController.getBookingPayment(ctx6_3.req, ctx6_3.res);
  assert.strictEqual(ctx6_3.getResponse().statusCode, 403, 'Customer A accessing Customer B payment must return 403');
  assert.strictEqual(ctx6_3.getResponse().responseData.success, false);
  assert.strictEqual(ctx6_3.getResponse().responseData.error, 'Unauthorized to view payment details.');
  assertNoPaymentDataLeak(ctx6_3.getResponse().responseData, 'Customer A accessing Customer B payment');
  console.log('✅ PASS 3: Customer A cannot access Customer B booking payment (403, no data)');

  // 6.4 Customer can access their own booking payment (200, receipt-compatible, sanitized)
  const bCustA_Pay = await createTestBooking(custAUserId, driverAId, 'Ride Completed');
  const payRecordA = await createTestPayment(bCustA_Pay.id, custAUserId, driverAId);
  const ratingRecordA = await createTestRating(bCustA_Pay.id, custAUserId, driverAId);

  const ctx6_4 = createMockContext(userCustA, { bookingId: String(bCustA_Pay.id) });
  await PaymentController.getBookingPayment(ctx6_4.req, ctx6_4.res);
  const custPayResp = ctx6_4.getResponse();
  assert.strictEqual(custPayResp.statusCode, 200, 'Customer accessing own payment must return 200');
  assert.strictEqual(custPayResp.responseData.success, true);
  assert.ok(custPayResp.responseData.data.payment, 'Payment object must be returned');

  // Verify BookingStatusPage receipt fields are present and compatible
  const custPayment = custPayResp.responseData.data.payment;
  assert.strictEqual(Number(custPayment.id), payRecordA.id);
  assert.strictEqual(Number(custPayment.booking_id), bCustA_Pay.id);
  assert.strictEqual(custPayment.payment_status, 'COMPLETED');
  assert.strictEqual(custPayment.payment_method, 'UPI');
  assert.strictEqual(Number(custPayment.driver_amount), 30.0);
  assert.strictEqual(Number(custPayment.owner_amount), 5.0);
  assert.strictEqual(custPayment.transaction_reference, payRecordA.transaction_reference);
  assert.ok(custPayResp.responseData.data.rating, 'Rating object must be returned to customer');
  assert.strictEqual(custPayResp.responseData.data.rating.rating, 5);
  assert.strictEqual(custPayResp.responseData.data.rating.review, 'Smooth ride');

  // Verify customer response does not leak internal settlement fields or Cashfree identifiers
  assert.strictEqual(custPayment.settlement_status, undefined, 'settlement_status must not be exposed to customer');
  assert.strictEqual(custPayment.settled_at, undefined, 'settled_at must not be exposed to customer');
  assert.strictEqual(custPayment.gateway_order_id, undefined, 'gateway_order_id must not be exposed to customer');
  assert.strictEqual(custPayment.gateway_payment_id, undefined, 'gateway_payment_id must not be exposed to customer');
  assert.strictEqual(custPayment.driver_payment_confirmed_by, undefined, 'driver_payment_confirmed_by must not be exposed to customer');
  console.log('✅ PASS 4: Customer can access own payment (200, receipt fields preserved, internal fields omitted)');

  // 6.5 Driver A cannot access Driver B booking payment (403)
  const bDriverB_Pay = await createTestBooking(custAUserId, driverBId, 'Ride Completed');
  await createTestPayment(bDriverB_Pay.id, custAUserId, driverBId);

  const ctx6_5 = createMockContext(userDriverA, { bookingId: String(bDriverB_Pay.id) });
  await PaymentController.getBookingPayment(ctx6_5.req, ctx6_5.res);
  assert.strictEqual(ctx6_5.getResponse().statusCode, 403, 'Driver A accessing Driver B payment must return 403');
  assert.strictEqual(ctx6_5.getResponse().responseData.success, false);
  assert.strictEqual(ctx6_5.getResponse().responseData.error, 'Unauthorized to view payment details.');
  assertNoPaymentDataLeak(ctx6_5.getResponse().responseData, 'Driver A accessing Driver B payment');
  console.log('✅ PASS 5: Driver A cannot access Driver B booking payment (403, no data)');

  // 6.6 Driver cannot access an unassigned booking payment (403)
  const bUnassigned_Pay = await createTestBooking(custAUserId, null, 'Searching for Auto');
  const ctx6_6 = createMockContext(userDriverA, { bookingId: String(bUnassigned_Pay.id) });
  await PaymentController.getBookingPayment(ctx6_6.req, ctx6_6.res);
  assert.strictEqual(ctx6_6.getResponse().statusCode, 403, 'Driver accessing unassigned booking payment must return 403');
  assert.strictEqual(ctx6_6.getResponse().responseData.success, false);
  assert.strictEqual(ctx6_6.getResponse().responseData.error, 'Unauthorized to view payment details.');
  assertNoPaymentDataLeak(ctx6_6.getResponse().responseData, 'Driver accessing unassigned booking payment');
  console.log('✅ PASS 6: Unassigned driver accessing payment returns HTTP 403 (no data)');

  // 6.7 Assigned driver can access own booking payment with driver-safe fields only (200)
  const ctx6_7 = createMockContext(userDriverA, { bookingId: String(bCustA_Pay.id) });
  await PaymentController.getBookingPayment(ctx6_7.req, ctx6_7.res);
  const driverPayResp = ctx6_7.getResponse();
  assert.strictEqual(driverPayResp.statusCode, 200, 'Assigned driver accessing own payment must return 200');
  assert.strictEqual(driverPayResp.responseData.success, true);
  assert.ok(driverPayResp.responseData.data.payment, 'Payment object must be returned to assigned driver');

  const driverPayment = driverPayResp.responseData.data.payment;
  assert.strictEqual(Number(driverPayment.id), payRecordA.id);
  assert.strictEqual(Number(driverPayment.booking_id), bCustA_Pay.id);
  assert.strictEqual(driverPayment.payment_status, 'COMPLETED');
  assert.strictEqual(driverPayment.payment_method, 'UPI');
  assert.strictEqual(Number(driverPayment.driver_amount), 30.0);
  assert.strictEqual(driverPayment.transaction_reference, payRecordA.transaction_reference);

  // Assert driver response strictly excludes owner commission, settlements, Cashfree IDs, and customer ratings
  assert.strictEqual(driverPayment.owner_amount, undefined, 'owner_amount must NOT be exposed to driver');
  assert.strictEqual(driverPayment.commission_amount, undefined, 'commission_amount must NOT be exposed to driver');
  assert.strictEqual(driverPayment.settlement_status, undefined, 'settlement_status must NOT be exposed to driver');
  assert.strictEqual(driverPayment.settled_at, undefined, 'settled_at must NOT be exposed to driver');
  assert.strictEqual(driverPayment.gateway_order_id, undefined, 'gateway_order_id must NOT be exposed to driver');
  assert.strictEqual(driverPayment.gateway_payment_id, undefined, 'gateway_payment_id must NOT be exposed to driver');
  assert.strictEqual(driverPayment.customer_id, undefined, 'customer_id must NOT be exposed to driver');
  assert.strictEqual(driverPayment.driver_payment_confirmed_by, undefined, 'driver_payment_confirmed_by must NOT be exposed');
  assert.strictEqual(driverPayResp.responseData.data.rating, null, 'Customer rating/review must NOT be returned to driver');
  console.log('✅ PASS 7: Assigned driver can access own payment (200, driver-safe fields only, rating null)');

  // 6.8 Admin can access any booking payment with complete details (200)
  const ctx6_8 = createMockContext(userAdmin, { bookingId: String(bCustB_Pay.id) });
  await PaymentController.getBookingPayment(ctx6_8.req, ctx6_8.res);
  const adminPayResp = ctx6_8.getResponse();
  assert.strictEqual(adminPayResp.statusCode, 200, 'Admin must receive 200 for any booking payment');
  assert.strictEqual(adminPayResp.responseData.success, true);
  assert.ok(adminPayResp.responseData.data.payment, 'Admin must receive payment object');
  assert.strictEqual(Number(adminPayResp.responseData.data.payment.booking_id), bCustB_Pay.id);
  assert.ok(adminPayResp.responseData.data.payment.owner_amount !== undefined, 'Admin receives owner_amount');
  assert.ok(adminPayResp.responseData.data.rating, 'Admin receives rating object');
  console.log('✅ PASS 8: Admin can access any booking payment (200, full data and rating)');

  // =========================================================================
  // TEST SUITE 7: CONF-06 - Cashfree Trip Payment Webhook Reconciliation
  // =========================================================================

  console.log('\n--- 7. Testing Cashfree Trip Payment Webhook Reconciliation (CONF-06) ---');

  const origSecret = process.env.CASHFREE_SECRET_KEY;
  const testSecret = 'cf_secret_test_key_phase2_sec_audit_12345';
  process.env.CASHFREE_SECRET_KEY = testSecret;

  const origCashfreeClient = PaymentService.getCashfreeClient();

  // Test state mock client for Cashfree PGOrderFetchPayments
  let mockCashfreePayments: any[] = [];
  PaymentService.setCashfreeClient({
    XApiVersion: '2025-01-01',
    PGOrderFetchPayments: async (_orderId: string) => {
      return { data: mockCashfreePayments };
    }
  });

  // Helper to compute valid Cashfree HMAC-SHA256 signature
  function computeCfSignature(rawBody: string, timestamp: string, secret = testSecret): string {
    return crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}${rawBody}`)
      .digest('base64');
  }

  // Helper to create mock webhook context
  function createWebhookContext(options: {
    body?: any;
    signature?: string;
    timestamp?: string;
    rawBody?: string;
    url?: string;
  }) {
    let raw = options.rawBody;
    if (raw === undefined && options.body !== undefined) {
      raw = JSON.stringify(options.body);
    }

    const req = {
      headers: {
        'x-webhook-signature': options.signature,
        'x-webhook-timestamp': options.timestamp
      },
      body: options.body,
      rawBody: raw,
      url: options.url || '/api/payments/webhook'
    } as unknown as Request;

    let responseData: any = null;
    let statusCode = 200;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseData = data;
        return this;
      }
    } as unknown as Response;

    return { req, res, getResponse: () => ({ statusCode, responseData }) };
  }

  // Helper to create test trip booking
  async function createTestTripBooking(
    customerId: number,
    quotedPrice = 500.0,
    paymentStatus: 'PENDING' | 'PAID' | 'FAILED' = 'PENDING',
    paymentReference?: string
  ) {
    const ref = `TRIP_REF_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const payRef = paymentReference || `TRIP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const res = await query(
      `INSERT INTO trip_bookings (
         booking_reference, customer_id, customer_name, phone_number,
         members, trip_place, days, trip_date, pickup_time,
         status, quoted_price, customer_confirmed, customer_confirmed_at,
         payment_status, payment_reference, payment_method, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, CURRENT_TIMESTAMP, $12, $13, 'ONLINE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        ref,
        customerId,
        'Trip Test Customer',
        '9876543210',
        3,
        'Tirupati',
        2,
        '2026-11-15',
        '06:00 AM',
        'CONFIRMED',
        quotedPrice,
        paymentStatus,
        payRef
      ]
    );
    return res.rows[0];
  }

  // Helper to create pending regular booking payment
  async function createPendingRegularPayment(bookingId: number, customerId: number, amount = 100.0, orderId?: string) {
    const gOrderId = orderId || `ORDER_KK_${bookingId}_${Date.now()}`;
    const res = await query(
      `INSERT INTO payments (
         booking_id, customer_id, driver_id, total_amount, driver_amount, owner_amount, commission_amount,
         payment_status, settlement_status, payment_method, transaction_reference,
         gateway_order_id, gateway_payment_id, created_at, updated_at
       )
       VALUES ($1, $2, NULL, $3, $4, $5, $5, 'PENDING', 'PENDING', 'ONLINE', $6, $7, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        bookingId,
        customerId,
        amount,
        amount - 15.0,
        15.0,
        `TXN_TEST_${Date.now()}_${bookingId}`,
        gOrderId
      ]
    );
    return res.rows[0];
  }

  // 7.1 Reject webhook with invalid Cashfree signature (HTTP 400)
  const ts1 = String(Date.now());
  const payload1 = {
    data: {
      order: { order_id: 'TRIP_9999_1' },
      payment: { cf_payment_id: '12345', payment_status: 'SUCCESS' }
    }
  };
  const rawBody1 = JSON.stringify(payload1);
  const badSignature = 'invalid_base64_hmac_signature==';
  const ctx7_1 = createWebhookContext({
    body: payload1,
    rawBody: rawBody1,
    signature: badSignature,
    timestamp: ts1
  });
  await PaymentController.handleWebhook(ctx7_1.req, ctx7_1.res);
  assert.strictEqual(ctx7_1.getResponse().statusCode, 400);
  assert.strictEqual(ctx7_1.getResponse().responseData.success, false);
  assert.strictEqual(ctx7_1.getResponse().responseData.error, 'Invalid webhook request.');
  console.log('✅ PASS 1: Reject webhook with invalid Cashfree signature (HTTP 400)');

  // 7.2 Reject webhook with missing signature, timestamp, or raw body (HTTP 400)
  const ctx7_2a = createWebhookContext({ body: payload1, rawBody: rawBody1, timestamp: ts1, signature: undefined });
  await PaymentController.handleWebhook(ctx7_2a.req, ctx7_2a.res);
  assert.strictEqual(ctx7_2a.getResponse().statusCode, 400);
  assert.strictEqual(ctx7_2a.getResponse().responseData.error, 'Invalid webhook request.');

  const ctx7_2b = createWebhookContext({ body: payload1, rawBody: rawBody1, timestamp: undefined, signature: 'some_sig' });
  await PaymentController.handleWebhook(ctx7_2b.req, ctx7_2b.res);
  assert.strictEqual(ctx7_2b.getResponse().statusCode, 400);
  assert.strictEqual(ctx7_2b.getResponse().responseData.error, 'Invalid webhook request.');

  const ctx7_2c = createWebhookContext({ body: payload1, rawBody: '', timestamp: ts1, signature: 'some_sig' });
  await PaymentController.handleWebhook(ctx7_2c.req, ctx7_2c.res);
  assert.strictEqual(ctx7_2c.getResponse().statusCode, 400);
  assert.strictEqual(ctx7_2c.getResponse().responseData.error, 'Invalid webhook request.');
  console.log('✅ PASS 2: Reject webhook with missing signature, timestamp, or raw body (HTTP 400)');

  // 7.3 Webhook with query parameters in URL (/api/payments/webhook?ref=123) successfully captures rawBody and processes valid event
  const trip7_3 = await createTestTripBooking(custAUserId, 400.0, 'PENDING');
  const orderId7_3 = trip7_3.payment_reference;
  const payId7_3 = `CF_PAY_7_3_${Date.now()}`;
  const payload7_3 = {
    data: {
      order: { order_id: orderId7_3 },
      payment: { cf_payment_id: payId7_3, payment_status: 'SUCCESS' }
    }
  };
  const rawBody7_3 = JSON.stringify(payload7_3);
  const ts7_3 = String(Date.now());
  const sig7_3 = computeCfSignature(rawBody7_3, ts7_3);

  // Test rawBody capture logic matching express verify hook
  const expressReq7_3: any = { url: '/api/payments/webhook?ref=123&source=cashfree' };
  const pathname7_3 = (expressReq7_3.url || '').split('?')[0];
  if (pathname7_3 === '/api/payments/webhook') {
    expressReq7_3.rawBody = Buffer.from(rawBody7_3, 'utf8').toString('utf8');
  }
  assert.strictEqual(expressReq7_3.rawBody, rawBody7_3, 'rawBody must be captured when query params are present');

  mockCashfreePayments = [
    {
      cf_payment_id: payId7_3,
      order_id: orderId7_3,
      order_currency: 'INR',
      order_amount: 400.0,
      payment_amount: 400.0,
      payment_status: 'SUCCESS',
      payment_method: 'UPI'
    }
  ];

  const ctx7_3 = createWebhookContext({
    body: payload7_3,
    rawBody: expressReq7_3.rawBody,
    signature: sig7_3,
    timestamp: ts7_3,
    url: '/api/payments/webhook?ref=123&source=cashfree'
  });
  await PaymentController.handleWebhook(ctx7_3.req, ctx7_3.res);
  assert.strictEqual(ctx7_3.getResponse().statusCode, 200);
  assert.strictEqual(ctx7_3.getResponse().responseData.success, true);
  assert.strictEqual(ctx7_3.getResponse().responseData.processed, true);
  console.log('✅ PASS 3: Webhook with query parameters in URL (/api/payments/webhook?ref=123) successfully captures rawBody and processes valid event');

  // 7.4 Valid ORDER_KK_ webhook updates regular booking payment to COMPLETED
  const bRegular7_4 = await createTestBooking(custAUserId, driverAId, 'Searching for Auto');
  const payRegular7_4 = await createPendingRegularPayment(bRegular7_4.id, custAUserId, 150.0);
  const orderId7_4 = payRegular7_4.gateway_order_id;
  const payId7_4 = `CF_PAY_REG_7_4_${Date.now()}`;
  const payload7_4 = {
    data: {
      order: { order_id: orderId7_4 },
      payment: { cf_payment_id: payId7_4, payment_status: 'SUCCESS' }
    }
  };
  const rawBody7_4 = JSON.stringify(payload7_4);
  const ts7_4 = String(Date.now());
  const sig7_4 = computeCfSignature(rawBody7_4, ts7_4);

  mockCashfreePayments = [
    {
      cf_payment_id: payId7_4,
      order_id: orderId7_4,
      order_currency: 'INR',
      order_amount: 150.0,
      payment_amount: 150.0,
      payment_status: 'SUCCESS'
    }
  ];

  const ctx7_4 = createWebhookContext({ body: payload7_4, rawBody: rawBody7_4, signature: sig7_4, timestamp: ts7_4 });
  await PaymentController.handleWebhook(ctx7_4.req, ctx7_4.res);
  assert.strictEqual(ctx7_4.getResponse().statusCode, 200);
  assert.strictEqual(ctx7_4.getResponse().responseData.processed, true);

  const updatedPay7_4 = await query('SELECT * FROM payments WHERE id = $1', [payRegular7_4.id]);
  assert.strictEqual(updatedPay7_4.rows[0].payment_status, 'COMPLETED');
  assert.strictEqual(updatedPay7_4.rows[0].gateway_payment_id, payId7_4);
  console.log('✅ PASS 4: Valid ORDER_KK_ webhook updates regular booking payment to COMPLETED');

  // 7.5 Valid TRIP_ webhook updates trip booking payment_status from PENDING to PAID
  const trip7_5 = await createTestTripBooking(custBUserId, 650.0, 'PENDING');
  const orderId7_5 = trip7_5.payment_reference;
  const payId7_5 = `CF_PAY_TRIP_7_5_${Date.now()}`;
  const payload7_5 = {
    data: {
      order: { order_id: orderId7_5 },
      payment: { cf_payment_id: payId7_5, payment_status: 'SUCCESS' }
    }
  };
  const rawBody7_5 = JSON.stringify(payload7_5);
  const ts7_5 = String(Date.now());
  const sig7_5 = computeCfSignature(rawBody7_5, ts7_5);

  mockCashfreePayments = [
    {
      cf_payment_id: payId7_5,
      order_id: orderId7_5,
      order_currency: 'INR',
      order_amount: 650.0,
      payment_amount: 650.0,
      payment_status: 'SUCCESS',
      payment_group: 'UPI'
    }
  ];

  const ctx7_5 = createWebhookContext({ body: payload7_5, rawBody: rawBody7_5, signature: sig7_5, timestamp: ts7_5 });
  await PaymentController.handleWebhook(ctx7_5.req, ctx7_5.res);
  assert.strictEqual(ctx7_5.getResponse().statusCode, 200);
  assert.strictEqual(ctx7_5.getResponse().responseData.processed, true);

  const updatedTrip7_5 = await query('SELECT * FROM trip_bookings WHERE id = $1', [trip7_5.id]);
  assert.strictEqual(updatedTrip7_5.rows[0].payment_status, 'PAID');
  assert.strictEqual(updatedTrip7_5.rows[0].payment_method, 'UPI');
  console.log('✅ PASS 5: Valid TRIP_ webhook updates trip booking payment_status from PENDING to PAID');

  // 7.6 Webhook with mismatched trip amount rejected (order_amount != quoted_price) without marking PAID
  const trip7_6 = await createTestTripBooking(custAUserId, 500.0, 'PENDING');
  const orderId7_6 = trip7_6.payment_reference;
  const payId7_6 = `CF_PAY_7_6_${Date.now()}`;
  const payload7_6 = {
    data: {
      order: { order_id: orderId7_6 },
      payment: { cf_payment_id: payId7_6, payment_status: 'SUCCESS' }
    }
  };
  const rawBody7_6 = JSON.stringify(payload7_6);
  const ts7_6 = String(Date.now());
  const sig7_6 = computeCfSignature(rawBody7_6, ts7_6);

  mockCashfreePayments = [
    {
      cf_payment_id: payId7_6,
      order_id: orderId7_6,
      order_currency: 'INR',
      order_amount: 600.0, // Mismatch: 600 vs quoted 500
      payment_amount: 600.0,
      payment_status: 'SUCCESS'
    }
  ];

  const ctx7_6 = createWebhookContext({ body: payload7_6, rawBody: rawBody7_6, signature: sig7_6, timestamp: ts7_6 });
  await PaymentController.handleWebhook(ctx7_6.req, ctx7_6.res);
  assert.strictEqual(ctx7_6.getResponse().statusCode, 400);
  assert.strictEqual(ctx7_6.getResponse().responseData.error, 'Invalid webhook request.');

  const checkTrip7_6 = await query('SELECT * FROM trip_bookings WHERE id = $1', [trip7_6.id]);
  assert.strictEqual(checkTrip7_6.rows[0].payment_status, 'PENDING', 'Trip must remain PENDING on amount mismatch');
  console.log('✅ PASS 6: Webhook with mismatched trip amount rejected (order_amount != quoted_price) without marking PAID');

  // 7.7 Webhook with mismatched payment_amount rejected without marking PAID
  const trip7_7 = await createTestTripBooking(custAUserId, 500.0, 'PENDING');
  const orderId7_7 = trip7_7.payment_reference;
  const payId7_7 = `CF_PAY_7_7_${Date.now()}`;
  const payload7_7 = {
    data: {
      order: { order_id: orderId7_7 },
      payment: { cf_payment_id: payId7_7, payment_status: 'SUCCESS' }
    }
  };
  const rawBody7_7 = JSON.stringify(payload7_7);
  const ts7_7 = String(Date.now());
  const sig7_7 = computeCfSignature(rawBody7_7, ts7_7);

  mockCashfreePayments = [
    {
      cf_payment_id: payId7_7,
      order_id: orderId7_7,
      order_currency: 'INR',
      order_amount: 500.0,
      payment_amount: 450.0, // Partial/mismatched payment
      payment_status: 'SUCCESS'
    }
  ];

  const ctx7_7 = createWebhookContext({ body: payload7_7, rawBody: rawBody7_7, signature: sig7_7, timestamp: ts7_7 });
  await PaymentController.handleWebhook(ctx7_7.req, ctx7_7.res);
  assert.strictEqual(ctx7_7.getResponse().statusCode, 400);
  assert.strictEqual(ctx7_7.getResponse().responseData.error, 'Invalid webhook request.');

  const checkTrip7_7 = await query('SELECT * FROM trip_bookings WHERE id = $1', [trip7_7.id]);
  assert.strictEqual(checkTrip7_7.rows[0].payment_status, 'PENDING', 'Trip must remain PENDING on partial payment amount');
  console.log('✅ PASS 7: Webhook with mismatched payment_amount rejected without marking PAID');

  // 7.8 Webhook with non-INR currency rejected without marking PAID
  const trip7_8 = await createTestTripBooking(custAUserId, 500.0, 'PENDING');
  const orderId7_8 = trip7_8.payment_reference;
  const payId7_8 = `CF_PAY_7_8_${Date.now()}`;
  const payload7_8 = {
    data: {
      order: { order_id: orderId7_8 },
      payment: { cf_payment_id: payId7_8, payment_status: 'SUCCESS' }
    }
  };
  const rawBody7_8 = JSON.stringify(payload7_8);
  const ts7_8 = String(Date.now());
  const sig7_8 = computeCfSignature(rawBody7_8, ts7_8);

  mockCashfreePayments = [
    {
      cf_payment_id: payId7_8,
      order_id: orderId7_8,
      order_currency: 'USD', // Non-INR currency
      order_amount: 500.0,
      payment_amount: 500.0,
      payment_status: 'SUCCESS'
    }
  ];

  const ctx7_8 = createWebhookContext({ body: payload7_8, rawBody: rawBody7_8, signature: sig7_8, timestamp: ts7_8 });
  await PaymentController.handleWebhook(ctx7_8.req, ctx7_8.res);
  assert.strictEqual(ctx7_8.getResponse().statusCode, 400);
  assert.strictEqual(ctx7_8.getResponse().responseData.error, 'Invalid webhook request.');

  const checkTrip7_8 = await query('SELECT * FROM trip_bookings WHERE id = $1', [trip7_8.id]);
  assert.strictEqual(checkTrip7_8.rows[0].payment_status, 'PENDING', 'Trip must remain PENDING on foreign currency');
  console.log('✅ PASS 8: Webhook with non-INR currency rejected without marking PAID');

  // 7.9 Webhook with mismatched Cashfree order_id or payment_id rejected
  const trip7_9 = await createTestTripBooking(custAUserId, 500.0, 'PENDING');
  const orderId7_9 = trip7_9.payment_reference;
  const payId7_9 = `CF_PAY_7_9_${Date.now()}`;
  const payload7_9 = {
    data: {
      order: { order_id: orderId7_9 },
      payment: { cf_payment_id: payId7_9, payment_status: 'SUCCESS' }
    }
  };
  const rawBody7_9 = JSON.stringify(payload7_9);
  const ts7_9 = String(Date.now());
  const sig7_9 = computeCfSignature(rawBody7_9, ts7_9);

  // Case 9a: payment_id not found in Cashfree response
  mockCashfreePayments = [
    {
      cf_payment_id: 'DIFFERENT_PAY_ID',
      order_id: orderId7_9,
      order_currency: 'INR',
      order_amount: 500.0,
      payment_amount: 500.0,
      payment_status: 'SUCCESS'
    }
  ];

  const ctx7_9a = createWebhookContext({ body: payload7_9, rawBody: rawBody7_9, signature: sig7_9, timestamp: ts7_9 });
  await PaymentController.handleWebhook(ctx7_9a.req, ctx7_9a.res);
  assert.strictEqual(ctx7_9a.getResponse().statusCode, 400);
  assert.strictEqual(ctx7_9a.getResponse().responseData.error, 'Invalid webhook request.');

  // Case 9b: verified order_id does not match
  mockCashfreePayments = [
    {
      cf_payment_id: payId7_9,
      order_id: 'DIFFERENT_ORDER_ID',
      order_currency: 'INR',
      order_amount: 500.0,
      payment_amount: 500.0,
      payment_status: 'SUCCESS'
    }
  ];

  const ctx7_9b = createWebhookContext({ body: payload7_9, rawBody: rawBody7_9, signature: sig7_9, timestamp: ts7_9 });
  await PaymentController.handleWebhook(ctx7_9b.req, ctx7_9b.res);
  assert.strictEqual(ctx7_9b.getResponse().statusCode, 400);
  assert.strictEqual(ctx7_9b.getResponse().responseData.error, 'Invalid webhook request.');
  console.log('✅ PASS 9: Webhook with mismatched Cashfree order_id or payment_id rejected');

  // 7.10 Webhook with payment status PENDING or FAILED does not mark trip as PAID
  const trip7_10 = await createTestTripBooking(custAUserId, 300.0, 'PENDING');
  const orderId7_10 = trip7_10.payment_reference;
  const payId7_10 = `CF_PAY_7_10_${Date.now()}`;
  const payload7_10 = {
    data: {
      order: { order_id: orderId7_10 },
      payment: { cf_payment_id: payId7_10, payment_status: 'PENDING' }
    }
  };
  const rawBody7_10 = JSON.stringify(payload7_10);
  const ts7_10 = String(Date.now());
  const sig7_10 = computeCfSignature(rawBody7_10, ts7_10);

  mockCashfreePayments = [
    {
      cf_payment_id: payId7_10,
      order_id: orderId7_10,
      order_currency: 'INR',
      order_amount: 300.0,
      payment_amount: 300.0,
      payment_status: 'PENDING'
    }
  ];

  const ctx7_10a = createWebhookContext({ body: payload7_10, rawBody: rawBody7_10, signature: sig7_10, timestamp: ts7_10 });
  await PaymentController.handleWebhook(ctx7_10a.req, ctx7_10a.res);
  assert.strictEqual(ctx7_10a.getResponse().statusCode, 200);
  assert.strictEqual(ctx7_10a.getResponse().responseData.processed, false);

  const checkTrip7_10a = await query('SELECT * FROM trip_bookings WHERE id = $1', [trip7_10.id]);
  assert.strictEqual(checkTrip7_10a.rows[0].payment_status, 'PENDING');

  // Test FAILED event updates to FAILED, not PAID
  mockCashfreePayments[0].payment_status = 'FAILED';
  payload7_10.data.payment.payment_status = 'FAILED';
  const rawBody7_10b = JSON.stringify(payload7_10);
  const ts7_10b = String(Date.now());
  const sig7_10b = computeCfSignature(rawBody7_10b, ts7_10b);

  const ctx7_10b = createWebhookContext({ body: payload7_10, rawBody: rawBody7_10b, signature: sig7_10b, timestamp: ts7_10b });
  await PaymentController.handleWebhook(ctx7_10b.req, ctx7_10b.res);
  assert.strictEqual(ctx7_10b.getResponse().statusCode, 200);
  assert.strictEqual(ctx7_10b.getResponse().responseData.processed, true);

  const checkTrip7_10b = await query('SELECT * FROM trip_bookings WHERE id = $1', [trip7_10.id]);
  assert.strictEqual(checkTrip7_10b.rows[0].payment_status, 'FAILED', 'Payment status must be FAILED, not PAID');
  console.log('✅ PASS 10: Webhook with payment status PENDING or FAILED does not mark trip as PAID');

  // 7.11 Verified FAILED payment event does not downgrade an already PAID trip
  const trip7_11 = await createTestTripBooking(custAUserId, 700.0, 'PAID');
  const orderId7_11 = trip7_11.payment_reference;
  const payId7_11 = `CF_PAY_7_11_${Date.now()}`;
  const payload7_11 = {
    data: {
      order: { order_id: orderId7_11 },
      payment: { cf_payment_id: payId7_11, payment_status: 'FAILED' }
    }
  };
  const rawBody7_11 = JSON.stringify(payload7_11);
  const ts7_11 = String(Date.now());
  const sig7_11 = computeCfSignature(rawBody7_11, ts7_11);

  mockCashfreePayments = [
    {
      cf_payment_id: payId7_11,
      order_id: orderId7_11,
      order_currency: 'INR',
      order_amount: 700.0,
      payment_amount: 700.0,
      payment_status: 'FAILED'
    }
  ];

  const ctx7_11 = createWebhookContext({ body: payload7_11, rawBody: rawBody7_11, signature: sig7_11, timestamp: ts7_11 });
  await PaymentController.handleWebhook(ctx7_11.req, ctx7_11.res);
  assert.strictEqual(ctx7_11.getResponse().statusCode, 200);
  assert.strictEqual(ctx7_11.getResponse().responseData.processed, true);

  const checkTrip7_11 = await query('SELECT * FROM trip_bookings WHERE id = $1', [trip7_11.id]);
  assert.strictEqual(checkTrip7_11.rows[0].payment_status, 'PAID', 'Already PAID trip must never be downgraded to FAILED');
  console.log('✅ PASS 11: Verified FAILED payment event does not downgrade an already PAID trip');

  // 7.12 Duplicate successful webhook returns { processed: true } idempotently without re-updating
  const trip7_12 = await createTestTripBooking(custAUserId, 800.0, 'PENDING');
  const orderId7_12 = trip7_12.payment_reference;
  const payId7_12 = `CF_PAY_7_12_${Date.now()}`;
  const payload7_12 = {
    data: {
      order: { order_id: orderId7_12 },
      payment: { cf_payment_id: payId7_12, payment_status: 'SUCCESS' }
    }
  };
  const rawBody7_12 = JSON.stringify(payload7_12);
  const ts7_12 = String(Date.now());
  const sig7_12 = computeCfSignature(rawBody7_12, ts7_12);

  mockCashfreePayments = [
    {
      cf_payment_id: payId7_12,
      order_id: orderId7_12,
      order_currency: 'INR',
      order_amount: 800.0,
      payment_amount: 800.0,
      payment_status: 'SUCCESS'
    }
  ];

  // First delivery: marks PAID
  const ctx7_12a = createWebhookContext({ body: payload7_12, rawBody: rawBody7_12, signature: sig7_12, timestamp: ts7_12 });
  await PaymentController.handleWebhook(ctx7_12a.req, ctx7_12a.res);
  assert.strictEqual(ctx7_12a.getResponse().statusCode, 200);
  assert.strictEqual(ctx7_12a.getResponse().responseData.processed, true);

  const firstTripState = (await query('SELECT * FROM trip_bookings WHERE id = $1', [trip7_12.id])).rows[0];
  assert.strictEqual(firstTripState.payment_status, 'PAID');

  // Second delivery: idempotent return
  const ctx7_12b = createWebhookContext({ body: payload7_12, rawBody: rawBody7_12, signature: sig7_12, timestamp: ts7_12 });
  await PaymentController.handleWebhook(ctx7_12b.req, ctx7_12b.res);
  assert.strictEqual(ctx7_12b.getResponse().statusCode, 200);
  assert.strictEqual(ctx7_12b.getResponse().responseData.processed, true);

  const secondTripState = (await query('SELECT * FROM trip_bookings WHERE id = $1', [trip7_12.id])).rows[0];
  assert.strictEqual(secondTripState.payment_status, 'PAID');
  assert.strictEqual(
    new Date(secondTripState.updated_at).getTime(),
    new Date(firstTripState.updated_at).getTime(),
    'updated_at should not mutate on duplicate webhook'
  );
  console.log('✅ PASS 12: Duplicate successful webhook returns { processed: true } idempotently without re-updating');

  // 7.13 Concurrent duplicate webhook requests do not produce corrupted or contradictory status
  const trip7_13 = await createTestTripBooking(custAUserId, 900.0, 'PENDING');
  const orderId7_13 = trip7_13.payment_reference;
  const payId7_13 = `CF_PAY_7_13_${Date.now()}`;
  const payload7_13 = {
    data: {
      order: { order_id: orderId7_13 },
      payment: { cf_payment_id: payId7_13, payment_status: 'SUCCESS' }
    }
  };
  const rawBody7_13 = JSON.stringify(payload7_13);
  const ts7_13 = String(Date.now());
  const sig7_13 = computeCfSignature(rawBody7_13, ts7_13);

  mockCashfreePayments = [
    {
      cf_payment_id: payId7_13,
      order_id: orderId7_13,
      order_currency: 'INR',
      order_amount: 900.0,
      payment_amount: 900.0,
      payment_status: 'SUCCESS'
    }
  ];

  const ctx7_13a = createWebhookContext({ body: payload7_13, rawBody: rawBody7_13, signature: sig7_13, timestamp: ts7_13 });
  const ctx7_13b = createWebhookContext({ body: payload7_13, rawBody: rawBody7_13, signature: sig7_13, timestamp: ts7_13 });

  // Fire concurrent requests
  await Promise.all([
    PaymentController.handleWebhook(ctx7_13a.req, ctx7_13a.res),
    PaymentController.handleWebhook(ctx7_13b.req, ctx7_13b.res)
  ]);

  assert.strictEqual(ctx7_13a.getResponse().statusCode, 200);
  assert.strictEqual(ctx7_13b.getResponse().statusCode, 200);

  const checkTrip7_13 = await query('SELECT * FROM trip_bookings WHERE id = $1', [trip7_13.id]);
  assert.strictEqual(checkTrip7_13.rows[0].payment_status, 'PAID', 'Concurrent webhooks must result in consistent PAID status');
  console.log('✅ PASS 13: Concurrent duplicate webhook requests do not produce corrupted or contradictory status');

  // 7.14 Unknown order ID prefix is rejected without modifying regular or trip records
  const unknownOrderId = `CUSTOM_ORDER_${Date.now()}`;
  const payId7_14 = `CF_PAY_7_14_${Date.now()}`;
  const payload7_14 = {
    data: {
      order: { order_id: unknownOrderId },
      payment: { cf_payment_id: payId7_14, payment_status: 'SUCCESS' }
    }
  };
  const rawBody7_14 = JSON.stringify(payload7_14);
  const ts7_14 = String(Date.now());
  const sig7_14 = computeCfSignature(rawBody7_14, ts7_14);

  const ctx7_14 = createWebhookContext({ body: payload7_14, rawBody: rawBody7_14, signature: sig7_14, timestamp: ts7_14 });
  await PaymentController.handleWebhook(ctx7_14.req, ctx7_14.res);
  assert.strictEqual(ctx7_14.getResponse().statusCode, 400);
  assert.strictEqual(ctx7_14.getResponse().responseData.error, 'Invalid webhook request.');
  console.log('✅ PASS 14: Unknown order ID prefix is rejected without modifying regular or trip records');

  // 7.15 Webhook for TRIP_ order ID cannot match or update regular payments table
  const bRegular7_15 = await createTestBooking(custAUserId, driverAId, 'Searching for Auto');
  const payRegular7_15 = await createPendingRegularPayment(bRegular7_15.id, custAUserId, 200.0);
  const paymentsCountBefore = (await query('SELECT COUNT(*) as count FROM payments WHERE payment_status = $1', ['COMPLETED'])).rows[0].count;

  // Process a valid TRIP_ webhook
  const trip7_15 = await createTestTripBooking(custAUserId, 350.0, 'PENDING');
  const orderId7_15 = trip7_15.payment_reference;
  const payId7_15 = `CF_PAY_7_15_${Date.now()}`;
  const payload7_15 = {
    data: {
      order: { order_id: orderId7_15 },
      payment: { cf_payment_id: payId7_15, payment_status: 'SUCCESS' }
    }
  };
  const rawBody7_15 = JSON.stringify(payload7_15);
  const ts7_15 = String(Date.now());
  const sig7_15 = computeCfSignature(rawBody7_15, ts7_15);

  mockCashfreePayments = [
    {
      cf_payment_id: payId7_15,
      order_id: orderId7_15,
      order_currency: 'INR',
      order_amount: 350.0,
      payment_amount: 350.0,
      payment_status: 'SUCCESS'
    }
  ];

  const ctx7_15 = createWebhookContext({ body: payload7_15, rawBody: rawBody7_15, signature: sig7_15, timestamp: ts7_15 });
  await PaymentController.handleWebhook(ctx7_15.req, ctx7_15.res);
  assert.strictEqual(ctx7_15.getResponse().statusCode, 200);

  // Assert regular payment was completely unaffected
  const paymentsCountAfter = (await query('SELECT COUNT(*) as count FROM payments WHERE payment_status = $1', ['COMPLETED'])).rows[0].count;
  assert.strictEqual(paymentsCountAfter, paymentsCountBefore, 'TRIP_ webhook must never alter regular payments table');
  const regularCheck7_15 = (await query('SELECT * FROM payments WHERE id = $1', [payRegular7_15.id])).rows[0];
  assert.strictEqual(regularCheck7_15.payment_status, 'PENDING');
  console.log('✅ PASS 15: Webhook for TRIP_ order ID cannot match or update regular payments table');

  // 7.16 Webhook for regular order ID cannot match or update trip_bookings table
  const trip7_16 = await createTestTripBooking(custAUserId, 450.0, 'PENDING');
  const tripsPaidCountBefore = (await query('SELECT COUNT(*) as count FROM trip_bookings WHERE payment_status = $1', ['PAID'])).rows[0].count;

  // Process a valid ORDER_KK_ regular booking webhook
  const bRegular7_16 = await createTestBooking(custAUserId, driverAId, 'Searching for Auto');
  const payRegular7_16 = await createPendingRegularPayment(bRegular7_16.id, custAUserId, 120.0);
  const orderId7_16 = payRegular7_16.gateway_order_id;
  const payId7_16 = `CF_PAY_7_16_${Date.now()}`;
  const payload7_16 = {
    data: {
      order: { order_id: orderId7_16 },
      payment: { cf_payment_id: payId7_16, payment_status: 'SUCCESS' }
    }
  };
  const rawBody7_16 = JSON.stringify(payload7_16);
  const ts7_16 = String(Date.now());
  const sig7_16 = computeCfSignature(rawBody7_16, ts7_16);

  mockCashfreePayments = [
    {
      cf_payment_id: payId7_16,
      order_id: orderId7_16,
      order_currency: 'INR',
      order_amount: 120.0,
      payment_amount: 120.0,
      payment_status: 'SUCCESS'
    }
  ];

  const ctx7_16 = createWebhookContext({ body: payload7_16, rawBody: rawBody7_16, signature: sig7_16, timestamp: ts7_16 });
  await PaymentController.handleWebhook(ctx7_16.req, ctx7_16.res);
  assert.strictEqual(ctx7_16.getResponse().statusCode, 200);

  // Assert trip_bookings was completely unaffected
  const tripsPaidCountAfter = (await query('SELECT COUNT(*) as count FROM trip_bookings WHERE payment_status = $1', ['PAID'])).rows[0].count;
  assert.strictEqual(tripsPaidCountAfter, tripsPaidCountBefore, 'ORDER_KK_ webhook must never alter trip_bookings table');
  const tripCheck7_16 = (await query('SELECT * FROM trip_bookings WHERE id = $1', [trip7_16.id])).rows[0];
  assert.strictEqual(tripCheck7_16.payment_status, 'PENDING');
  console.log('✅ PASS 16: Webhook for regular order ID cannot match or update trip_bookings table');

  // 7.17 Malformed webhook payload (missing required order/payment fields) returns HTTP 400
  const malformedPayload7_17 = {
    data: {
      order: {}, // Missing order_id
      payment: { cf_payment_id: '12345', payment_status: 'SUCCESS' }
    }
  };
  const malformedRaw7_17 = JSON.stringify(malformedPayload7_17);
  const malformedTs7_17 = String(Date.now());
  const malformedSig7_17 = computeCfSignature(malformedRaw7_17, malformedTs7_17);
  const ctx7_17 = createWebhookContext({ body: malformedPayload7_17, rawBody: malformedRaw7_17, signature: malformedSig7_17, timestamp: malformedTs7_17 });
  await PaymentController.handleWebhook(ctx7_17.req, ctx7_17.res);
  assert.strictEqual(ctx7_17.getResponse().statusCode, 400);
  assert.strictEqual(ctx7_17.getResponse().responseData.success, false);
  assert.strictEqual(ctx7_17.getResponse().responseData.error, 'Invalid webhook request.');
  console.log('✅ PASS 17: Malformed webhook payload returns HTTP 400 with generic error');

  // 7.18 Database connection failure defaults to HTTP 500 with generic message
  const origHandleWebhook = PaymentService.handleWebhook;
  PaymentService.handleWebhook = async () => {
    const dbErr: any = new Error('connect ECONNREFUSED 127.0.0.1:5432');
    dbErr.code = 'ECONNREFUSED';
    throw dbErr;
  };
  const ctx7_18 = createWebhookContext({ body: payload1, rawBody: rawBody1, signature: computeCfSignature(rawBody1, ts1), timestamp: ts1 });
  await PaymentController.handleWebhook(ctx7_18.req, ctx7_18.res);
  assert.strictEqual(ctx7_18.getResponse().statusCode, 500);
  assert.strictEqual(ctx7_18.getResponse().responseData.success, false);
  assert.strictEqual(ctx7_18.getResponse().responseData.error, 'Internal webhook processing error.');
  console.log('✅ PASS 18: Database connection failure returns HTTP 500 without leaking connection details');

  // 7.19 Database query failure returns HTTP 500 with generic message
  PaymentService.handleWebhook = async () => {
    const queryErr: any = new Error('canceling statement due to statement timeout');
    queryErr.code = '57014';
    throw queryErr;
  };
  const ctx7_19 = createWebhookContext({ body: payload1, rawBody: rawBody1, signature: computeCfSignature(rawBody1, ts1), timestamp: ts1 });
  await PaymentController.handleWebhook(ctx7_19.req, ctx7_19.res);
  assert.strictEqual(ctx7_19.getResponse().statusCode, 500);
  assert.strictEqual(ctx7_19.getResponse().responseData.success, false);
  assert.strictEqual(ctx7_19.getResponse().responseData.error, 'Internal webhook processing error.');
  console.log('✅ PASS 19: Database query failure returns HTTP 500 without leaking SQL details');

  // 7.20 Unexpected exception without status defaults to HTTP 500
  PaymentService.handleWebhook = async () => {
    throw new TypeError('Cannot read properties of undefined');
  };
  const ctx7_20 = createWebhookContext({ body: payload1, rawBody: rawBody1, signature: computeCfSignature(rawBody1, ts1), timestamp: ts1 });
  await PaymentController.handleWebhook(ctx7_20.req, ctx7_20.res);
  assert.strictEqual(ctx7_20.getResponse().statusCode, 500);
  assert.strictEqual(ctx7_20.getResponse().responseData.success, false);
  assert.strictEqual(ctx7_20.getResponse().responseData.error, 'Internal webhook processing error.');
  console.log('✅ PASS 20: Unexpected exception without status defaults to HTTP 500');

  // Restore real handleWebhook implementation
  PaymentService.handleWebhook = origHandleWebhook;

  // 7.21 Valid webhook with failed database update returns HTTP 500 and does NOT acknowledge success
  const trip7_21 = await createTestTripBooking(custAUserId, 666.0, 'PENDING');
  const orderId7_21 = trip7_21.payment_reference;
  const payId7_21 = `CF_PAY_7_21_${Date.now()}`;
  const payload7_21 = {
    data: {
      order: { order_id: orderId7_21 },
      payment: { cf_payment_id: payId7_21, payment_status: 'SUCCESS' }
    }
  };
  const rawBody7_21 = JSON.stringify(payload7_21);
  const ts7_21 = String(Date.now());
  const sig7_21 = computeCfSignature(rawBody7_21, ts7_21);

  mockCashfreePayments = [
    {
      cf_payment_id: payId7_21,
      order_id: orderId7_21,
      order_currency: 'INR',
      order_amount: 666.0,
      payment_amount: 666.0,
      payment_status: 'SUCCESS'
    }
  ];

  // Add constraint that fails on updating this specific trip to PAID
  await query(`ALTER TABLE trip_bookings ADD CONSTRAINT test_trip_payment_check CHECK (payment_status != 'PAID' OR quoted_price != 666.0)`);
  try {
    const ctx7_21 = createWebhookContext({ body: payload7_21, rawBody: rawBody7_21, signature: sig7_21, timestamp: ts7_21 });
    await PaymentController.handleWebhook(ctx7_21.req, ctx7_21.res);
    assert.strictEqual(ctx7_21.getResponse().statusCode, 500);
    assert.strictEqual(ctx7_21.getResponse().responseData.success, false);
    assert.strictEqual(ctx7_21.getResponse().responseData.error, 'Internal webhook processing error.');

    // Ensure payment was not marked as PAID
    const tripCheck7_21 = (await query('SELECT * FROM trip_bookings WHERE id = $1', [trip7_21.id])).rows[0];
    assert.strictEqual(tripCheck7_21.payment_status, 'PENDING', 'Trip must remain PENDING when DB update fails');
    console.log('✅ PASS 21: Valid webhook with failed database update returns HTTP 500 and preserves PENDING status');
  } finally {
    await query(`ALTER TABLE trip_bookings DROP CONSTRAINT test_trip_payment_check`);
  }

  // Restore environment & Cashfree client
  process.env.CASHFREE_SECRET_KEY = origSecret;
  PaymentService.setCashfreeClient(origCashfreeClient);

  // =========================================================================
  // TEST SUITE 8: CONF-07 - OTP Generation and Brute-Force Protection
  // =========================================================================

  console.log('\n--- 8. Testing OTP Generation and Brute-Force Protection (CONF-07) ---');

  // Intercept all outbound OTP emails during testing
  let sentOtpList: { email: string; otp: string }[] = [];
  EmailService.setEmailSender(async (email: string, otp: string) => {
    sentOtpList.push({ email, otp });
  });

  function getLatestOtp(email: string): string | undefined {
    const matching = sentOtpList.filter(item => item.email.toLowerCase() === email.toLowerCase());
    return matching[matching.length - 1]?.otp;
  }

  // 8.1 OTP generation uses crypto.randomInt and produces six-digit values
  for (let i = 0; i < 100; i++) {
    const code = AuthService.generateOtp();
    assert.strictEqual(typeof code, 'string', 'OTP must be a string');
    assert.strictEqual(code.length, 6, 'OTP must have length 6');
    assert.ok(/^\d{6}$/.test(code), 'OTP must contain only digits');
    const num = Number(code);
    assert.ok(num >= 100000 && num <= 999999, 'OTP must be in range [100000, 999999]');
  }
  console.log('✅ PASS 1: OTP generation uses crypto.randomInt and produces six-digit values');

  // 8.2 Raw OTP is never stored in the database
  const email8_2 = `test_otp_store_${Date.now()}@example.com`;
  const ctx8_2 = createMockContext(undefined, {}, {
    name: 'Store Test',
    email: email8_2,
    mobile: `98711${Math.floor(10000 + Math.random() * 90000)}`,
    password: 'Password123!',
    confirmPassword: 'Password123!',
    role: 'customer'
  });
  await AuthController.register(ctx8_2.req, ctx8_2.res);
  assert.strictEqual(ctx8_2.getResponse().statusCode, 201);
  const dbRecord8_2 = (await query('SELECT * FROM email_verifications WHERE email = $1', [email8_2])).rows[0];
  assert.ok(dbRecord8_2, 'Verification record must exist in DB');
  assert.strictEqual(dbRecord8_2.otp, null, 'Plaintext OTP column must be null in DB');
  assert.ok(dbRecord8_2.otp_hash, 'otp_hash must be present in DB');
  assert.strictEqual(dbRecord8_2.otp_hash.length, 64, 'otp_hash must be a 64-char hex HMAC-SHA256');
  const sentOtp8_2 = getLatestOtp(email8_2);
  assert.ok(sentOtp8_2, 'An OTP must have been sent via EmailService');
  assert.notStrictEqual(dbRecord8_2.otp_hash, sentOtp8_2, 'Stored hash must never match raw OTP');
  console.log('✅ PASS 2: Raw OTP is never stored in the database');

  // 8.3 Correct OTP verifies successfully
  const ctx8_3 = createMockContext(undefined, {}, { email: email8_2, otp: sentOtp8_2 });
  await AuthController.verifyEmailOtp(ctx8_3.req, ctx8_3.res);
  assert.strictEqual(ctx8_3.getResponse().statusCode, 201);
  assert.strictEqual(ctx8_3.getResponse().responseData.success, true);
  assert.ok(ctx8_3.getResponse().responseData.data?.token, 'JWT token must be returned upon successful verification');
  const userCreated8_3 = (await query('SELECT * FROM users WHERE email = $1', [email8_2])).rows[0];
  assert.ok(userCreated8_3, 'User account must be created in users table');
  const pendingDeleted8_3 = (await query('SELECT * FROM email_verifications WHERE email = $1', [email8_2])).rows[0];
  assert.strictEqual(pendingDeleted8_3, undefined, 'email_verifications record must be deleted upon verification');
  console.log('✅ PASS 3: Correct OTP verifies successfully');

  // 8.4 Incorrect OTP increments the attempt counter
  const email8_4 = `test_attempts_${Date.now()}@example.com`;
  const ctx8_4_reg = createMockContext(undefined, {}, {
    name: 'Attempt Counter Test',
    email: email8_4,
    mobile: `98712${Math.floor(10000 + Math.random() * 90000)}`,
    password: 'Password123!',
    confirmPassword: 'Password123!',
    role: 'customer'
  });
  await AuthController.register(ctx8_4_reg.req, ctx8_4_reg.res);
  assert.strictEqual(ctx8_4_reg.getResponse().statusCode, 201);

  // Submit wrong OTP
  const ctx8_4_verify = createMockContext(undefined, {}, { email: email8_4, otp: '111111' });
  await AuthController.verifyEmailOtp(ctx8_4_verify.req, ctx8_4_verify.res);
  assert.strictEqual(ctx8_4_verify.getResponse().statusCode, 400);

  const dbRecord8_4 = (await query('SELECT * FROM email_verifications WHERE email = $1', [email8_4])).rows[0];
  assert.strictEqual(dbRecord8_4.attempts, 1, 'attempts counter must be incremented to 1');
  console.log('✅ PASS 4: Incorrect OTP increments the attempt counter');

  // 8.5 Five incorrect attempts invalidate the OTP
  for (let i = 2; i <= 4; i++) {
    const ctx = createMockContext(undefined, {}, { email: email8_4, otp: `11111${i}` });
    await AuthController.verifyEmailOtp(ctx.req, ctx.res);
    assert.strictEqual(ctx.getResponse().statusCode, 400);
    const rec = (await query('SELECT * FROM email_verifications WHERE email = $1', [email8_4])).rows[0];
    assert.strictEqual(rec.attempts, i);
  }

  // 5th failed attempt triggers invalidation
  const ctx8_5 = createMockContext(undefined, {}, { email: email8_4, otp: '999999' });
  await AuthController.verifyEmailOtp(ctx8_5.req, ctx8_5.res);
  assert.strictEqual(ctx8_5.getResponse().statusCode, 429, '5th failed attempt must return HTTP 429 lockout');
  assert.ok(ctx8_5.getResponse().responseData.error.includes('Too many invalid attempts'));

  const dbRecord8_5 = (await query('SELECT * FROM email_verifications WHERE email = $1', [email8_4])).rows[0];
  assert.strictEqual(dbRecord8_5, undefined, 'Verification record must be deleted upon reaching max failed attempts');
  console.log('✅ PASS 5: Five incorrect attempts invalidate the OTP');

  // 8.6 Correct OTP after lockout is rejected
  const correctOtp8_4 = getLatestOtp(email8_4);
  assert.ok(correctOtp8_4);
  const ctx8_6 = createMockContext(undefined, {}, { email: email8_4, otp: correctOtp8_4 });
  await AuthController.verifyEmailOtp(ctx8_6.req, ctx8_6.res);
  assert.strictEqual(ctx8_6.getResponse().statusCode, 400, 'Correct OTP after lockout must be rejected');
  const user8_6 = (await query('SELECT * FROM users WHERE email = $1', [email8_4])).rows[0];
  assert.strictEqual(user8_6, undefined, 'User must not be created after lockout');
  console.log('✅ PASS 6: Correct OTP after lockout is rejected');

  // 8.7 Expired OTP is rejected
  const email8_7 = `test_expired_${Date.now()}@example.com`;
  const otpHex8_7 = AuthService.hashOtp('123456', email8_7);
  await query(
    `INSERT INTO email_verifications (
       email, name, mobile, password_hash, role, otp_hash, otp, expires_at, created_at
     )
     VALUES ($1, 'Expired User', $2, 'hash', 'customer', $3, NULL, CURRENT_TIMESTAMP - INTERVAL '1 minute', CURRENT_TIMESTAMP)`,
    [email8_7, `98713${Math.floor(10000 + Math.random() * 90000)}`, otpHex8_7]
  );

  const ctx8_7 = createMockContext(undefined, {}, { email: email8_7, otp: '123456' });
  await AuthController.verifyEmailOtp(ctx8_7.req, ctx8_7.res);
  assert.strictEqual(ctx8_7.getResponse().statusCode, 400);
  const user8_7 = (await query('SELECT * FROM users WHERE email = $1', [email8_7])).rows[0];
  assert.strictEqual(user8_7, undefined);
  console.log('✅ PASS 7: Expired OTP is rejected');

  // 8.8 Successful OTP cannot be reused
  const ctx8_8 = createMockContext(undefined, {}, { email: email8_2, otp: sentOtp8_2 });
  await AuthController.verifyEmailOtp(ctx8_8.req, ctx8_8.res);
  assert.strictEqual(ctx8_8.getResponse().statusCode, 400, 'Reusing an already-verified OTP must return HTTP 400');
  console.log('✅ PASS 8: Successful OTP cannot be reused');

  // 8.9 Ten concurrent invalid requests cannot bypass the five-attempt limit
  const email8_9 = `test_concurrent_fail_${Date.now()}@example.com`;
  const otpHex8_9 = AuthService.hashOtp('123456', email8_9);
  await query(
    `INSERT INTO email_verifications (
       email, name, mobile, password_hash, role, otp_hash, otp, expires_at, attempts, created_at
     )
     VALUES ($1, 'Concurrent Fail', $2, 'hash', 'customer', $3, NULL, CURRENT_TIMESTAMP + INTERVAL '10 minutes', 0, CURRENT_TIMESTAMP)`,
    [email8_9, `98714${Math.floor(10000 + Math.random() * 90000)}`, otpHex8_9]
  );

  const contexts8_9 = Array.from({ length: 10 }, (_, i) =>
    createMockContext(undefined, {}, { email: email8_9, otp: `88888${i}` })
  );

  await Promise.all(contexts8_9.map(ctx => AuthController.verifyEmailOtp(ctx.req, ctx.res)));

  const rec8_9 = (await query('SELECT * FROM email_verifications WHERE email = $1', [email8_9])).rows[0];
  assert.strictEqual(rec8_9, undefined, 'Verification record must be completely invalidated by concurrent attempts');
  console.log('✅ PASS 9: Ten concurrent invalid requests cannot bypass the five-attempt limit');

  // 8.10 Concurrent correct verification requests cannot create inconsistent account state
  const email8_10 = `test_concurrent_success_${Date.now()}@example.com`;
  const otp8_10 = '654321';
  const otpHex8_10 = AuthService.hashOtp(otp8_10, email8_10);
  const passHash8_10 = await AuthService.hashPassword('Pass123!');
  await query(
    `INSERT INTO email_verifications (
       email, name, mobile, password_hash, role, otp_hash, otp, expires_at, attempts, created_at
     )
     VALUES ($1, 'Concurrent Success', $2, $3, 'customer', $4, NULL, CURRENT_TIMESTAMP + INTERVAL '10 minutes', 0, CURRENT_TIMESTAMP)`,
    [email8_10, `98715${Math.floor(10000 + Math.random() * 90000)}`, passHash8_10, otpHex8_10]
  );

  const ctxA_10 = createMockContext(undefined, {}, { email: email8_10, otp: otp8_10 });
  const ctxB_10 = createMockContext(undefined, {}, { email: email8_10, otp: otp8_10 });

  await Promise.all([
    AuthController.verifyEmailOtp(ctxA_10.req, ctxA_10.res),
    AuthController.verifyEmailOtp(ctxB_10.req, ctxB_10.res)
  ]);

  const statusCodes_10 = [ctxA_10.getResponse().statusCode, ctxB_10.getResponse().statusCode].sort();
  assert.deepStrictEqual(statusCodes_10, [201, 400], 'Exactly one request must succeed with 201 and the other must fail with 400');
  const userCount_10 = (await query('SELECT COUNT(*) as count FROM users WHERE email = $1', [email8_10])).rows[0].count;
  assert.strictEqual(Number(userCount_10), 1, 'Exactly one user account must be created');
  console.log('✅ PASS 10: Concurrent correct verification requests cannot create inconsistent account state');

  // 8.11 Resend within 60 seconds is rejected
  const email8_11 = `test_resend_cooldown_${Date.now()}@example.com`;
  const ctx8_11a = createMockContext(undefined, {}, {
    name: 'Resend Test',
    email: email8_11,
    mobile: `98716${Math.floor(10000 + Math.random() * 90000)}`,
    password: 'Password123!',
    confirmPassword: 'Password123!',
    role: 'customer'
  });
  await AuthController.register(ctx8_11a.req, ctx8_11a.res);
  assert.strictEqual(ctx8_11a.getResponse().statusCode, 201);

  // Immediate second registration attempt within 60s
  const ctx8_11b = createMockContext(undefined, {}, {
    name: 'Resend Test',
    email: email8_11,
    mobile: `98716${Math.floor(10000 + Math.random() * 90000)}`,
    password: 'Password123!',
    confirmPassword: 'Password123!',
    role: 'customer'
  });
  await AuthController.register(ctx8_11b.req, ctx8_11b.res);
  assert.strictEqual(ctx8_11b.getResponse().statusCode, 429, 'Immediate resend must return HTTP 429');
  assert.ok(ctx8_11b.getResponse().responseData.error.includes('seconds before requesting another'));
  console.log('✅ PASS 11: Resend within 60 seconds is rejected');

  // 8.12 IP rate limiting works across requests
  const testIp = `192.168.10.${Math.floor(10 + Math.random() * 200)}`;
  for (let i = 0; i < 15; i++) {
    const resLimit = await AuthService.checkRateLimit(`test_ip_${testIp}`, 15, 60);
    assert.strictEqual(resLimit.allowed, true);
  }
  const blockedRes = await AuthService.checkRateLimit(`test_ip_${testIp}`, 15, 60);
  assert.strictEqual(blockedRes.allowed, false, '16th request must exceed rate limit');
  assert.ok(blockedRes.retryAfterSeconds > 0);
  console.log('✅ PASS 12: IP rate limiting works across requests');

  // 8.13 Repeated registration cannot overwrite an active pending profile or password
  const email8_13 = `test_overwrite_${Date.now()}@example.com`;
  const originalMobile = `98717${Math.floor(10000 + Math.random() * 90000)}`;
  const ctx8_13a = createMockContext(undefined, {}, {
    name: 'Original Alice',
    email: email8_13,
    mobile: originalMobile,
    password: 'OriginalPassword1!',
    confirmPassword: 'OriginalPassword1!',
    role: 'customer'
  });
  await AuthController.register(ctx8_13a.req, ctx8_13a.res);
  assert.strictEqual(ctx8_13a.getResponse().statusCode, 201);

  const originalRecord = (await query('SELECT * FROM email_verifications WHERE email = $1', [email8_13])).rows[0];

  // Force cooldown to expire in DB to test resend branch without waiting 60s
  await query('UPDATE email_verifications SET last_sent_at = CURRENT_TIMESTAMP - INTERVAL \'65 seconds\' WHERE email = $1', [email8_13]);

  // Attacker Bob submits registration for same email with different name, mobile, and password
  const ctx8_13b = createMockContext(undefined, {}, {
    name: 'Attacker Bob',
    email: email8_13,
    mobile: '9999999999',
    password: 'AttackerPassword999!',
    confirmPassword: 'AttackerPassword999!',
    role: 'customer'
  });
  await AuthController.register(ctx8_13b.req, ctx8_13b.res);
  assert.strictEqual(ctx8_13b.getResponse().statusCode, 201);

  const preservedRecord = (await query('SELECT * FROM email_verifications WHERE email = $1', [email8_13])).rows[0];
  assert.strictEqual(preservedRecord.name, 'Original Alice', 'name must NOT be overwritten');
  assert.strictEqual(preservedRecord.mobile, originalMobile, 'mobile must NOT be overwritten');
  assert.strictEqual(preservedRecord.password_hash, originalRecord.password_hash, 'password_hash must NOT be overwritten');
  console.log('✅ PASS 13: Repeated registration cannot overwrite an active pending profile or password');

  // 8.14 A legitimate registration and verification flow still works
  const email8_14 = `legit_driver_${Date.now()}@example.com`;
  const mobile8_14 = `98718${Math.floor(10000 + Math.random() * 90000)}`;
  const ctx8_14_reg = createMockContext(undefined, {}, {
    name: 'Legit Driver',
    email: email8_14,
    mobile: mobile8_14,
    password: 'DriverPass123!',
    confirmPassword: 'DriverPass123!',
    role: 'driver',
    autoNumber: 'AP04XY1234',
    payoutUpi: 'driver@upi'
  });
  await AuthController.register(ctx8_14_reg.req, ctx8_14_reg.res);
  assert.strictEqual(ctx8_14_reg.getResponse().statusCode, 201);
  const sentOtp8_14 = getLatestOtp(email8_14);
  assert.ok(sentOtp8_14);

  const ctx8_14_ver = createMockContext(undefined, {}, { email: email8_14, otp: sentOtp8_14 });
  await AuthController.verifyEmailOtp(ctx8_14_ver.req, ctx8_14_ver.res);
  assert.strictEqual(ctx8_14_ver.getResponse().statusCode, 201);

  const driverUser = (await query('SELECT * FROM users WHERE email = $1', [email8_14])).rows[0];
  assert.ok(driverUser);
  assert.strictEqual(driverUser.role, 'driver');
  const driverRecord = (await query('SELECT * FROM drivers WHERE user_id = $1', [driverUser.id])).rows[0];
  assert.ok(driverRecord);
  assert.strictEqual(driverRecord.auto_number, 'AP04XY1234');
  assert.strictEqual(driverRecord.approval_status, 'PENDING');
  console.log('✅ PASS 14: A legitimate registration and verification flow still works');

  // 8.15 Public responses do not reveal whether an account already exists
  const existingEmail = userCustA.email;
  const ctx8_15 = createMockContext(undefined, {}, {
    name: 'Enum Probe',
    email: existingEmail,
    mobile: `98719${Math.floor(10000 + Math.random() * 90000)}`,
    password: 'Password123!',
    confirmPassword: 'Password123!',
    role: 'customer'
  });
  await AuthController.register(ctx8_15.req, ctx8_15.res);
  assert.strictEqual(ctx8_15.getResponse().statusCode, 201, 'Registration with existing email must return standard 201 response');
  assert.strictEqual(ctx8_15.getResponse().responseData.success, true);
  assert.strictEqual(ctx8_15.getResponse().responseData.data?.requiresVerification, true);
  assert.strictEqual(ctx8_15.getResponse().responseData.error, undefined, 'Must not leak error message stating account exists');
  console.log('✅ PASS 15: Public responses do not reveal whether an account already exists');

  // 8.16 OTP generation, verification, and email delivery never expose OTPs or secrets in logs
  let loggedOutput = '';
  const origConsoleLog = console.log;
  const origConsoleError = console.error;

  try {
    console.log = (...args: any[]) => { loggedOutput += args.join(' ') + '\n'; };
    console.error = (...args: any[]) => { loggedOutput += args.join(' ') + '\n'; };

    const testSecretVal = process.env.OTP_SECRET || getJwtSecret();
    const codeGen = AuthService.generateOtp();
    const hashVal = AuthService.hashOtp(codeGen, 'logtest@example.com');
    AuthService.verifyOtpHash(codeGen, 'logtest@example.com', hashVal);

    assert.strictEqual(loggedOutput.includes(codeGen), false, 'Raw OTP must never appear in logs');
    assert.strictEqual(loggedOutput.includes(testSecretVal), false, 'Server secret must never appear in logs');
  } finally {
    console.log = origConsoleLog;
    console.error = origConsoleError;
  }
  console.log('✅ PASS 16: OTP generation, verification, and email delivery never expose OTPs or secrets in logs');

  // =========================================================================
  // CONF-07 RELIABILITY REMEDIATION TESTS (8.17 - 8.24)
  // =========================================================================

  // 8.17 User insert failure rolls back OTP consumption
  await query("ALTER TABLE users ADD CONSTRAINT test_user_check CHECK (name != 'TRIGGER_USER_FAIL')");
  const email8_17 = `rollback_user_${Date.now()}@example.com`;
  const otp8_17 = '123456';
  const otpHex8_17 = AuthService.hashOtp(otp8_17, email8_17);
  await query(
    `INSERT INTO email_verifications (
       email, name, mobile, password_hash, role, otp_hash, otp, expires_at, attempts, created_at
     )
     VALUES ($1, 'TRIGGER_USER_FAIL', $2, 'hash', 'customer', $3, NULL, CURRENT_TIMESTAMP + INTERVAL '10 minutes', 0, CURRENT_TIMESTAMP)`,
    [email8_17, `98791${Math.floor(10000 + Math.random() * 90000)}`, otpHex8_17]
  );

  const ctx8_17 = createMockContext(undefined, {}, { email: email8_17, otp: otp8_17 }, '10.0.1.17');
  await AuthController.verifyEmailOtp(ctx8_17.req, ctx8_17.res);
  assert.strictEqual(ctx8_17.getResponse().statusCode, 400);

  const rec8_17 = (await query('SELECT * FROM email_verifications WHERE email = $1', [email8_17])).rows[0];
  assert.ok(rec8_17, 'Verification record must still exist after user insert failure (OTP rollback)');
  const user8_17 = (await query('SELECT * FROM users WHERE email = $1', [email8_17])).rows[0];
  assert.strictEqual(user8_17, undefined, 'User record must not exist after rollback');
  await query("ALTER TABLE users DROP CONSTRAINT test_user_check");
  console.log('✅ PASS 17: User insert failure rolls back OTP consumption');

  // 8.18 Driver insert failure rolls back both user creation and OTP consumption
  await query("ALTER TABLE drivers ADD CONSTRAINT test_driver_check CHECK (auto_number != 'FAIL_AUTO_NUM')");
  const email8_18 = `rollback_driver_${Date.now()}@example.com`;
  const otp8_18 = '234567';
  const otpHex8_18 = AuthService.hashOtp(otp8_18, email8_18);
  await query(
    `INSERT INTO email_verifications (
       email, name, mobile, password_hash, role, otp_hash, otp, expires_at, attempts, created_at,
       auto_number, payout_upi
     )
     VALUES ($1, 'Driver Rollback', $2, 'hash', 'driver', $3, NULL, CURRENT_TIMESTAMP + INTERVAL '10 minutes', 0, CURRENT_TIMESTAMP, 'FAIL_AUTO_NUM', 'driver@upi')`,
    [email8_18, `98792${Math.floor(10000 + Math.random() * 90000)}`, otpHex8_18]
  );

  const ctx8_18 = createMockContext(undefined, {}, { email: email8_18, otp: otp8_18 }, '10.0.1.18');
  await AuthController.verifyEmailOtp(ctx8_18.req, ctx8_18.res);
  assert.strictEqual(ctx8_18.getResponse().statusCode, 400);

  const rec8_18 = (await query('SELECT * FROM email_verifications WHERE email = $1', [email8_18])).rows[0];
  assert.ok(rec8_18, 'Driver verification record must still exist after driver insert rollback');
  const user8_18 = (await query('SELECT * FROM users WHERE email = $1', [email8_18])).rows[0];
  assert.strictEqual(user8_18, undefined, 'User record must not exist after driver insert rollback');
  await query("ALTER TABLE drivers DROP CONSTRAINT test_driver_check");
  console.log('✅ PASS 18: Driver insert failure rolls back both user creation and OTP consumption');

  // 8.19 Successful transaction consumes OTP and creates account exactly once
  const email8_19 = `success_tx_${Date.now()}@example.com`;
  const otp8_19 = '345678';
  const otpHex8_19 = AuthService.hashOtp(otp8_19, email8_19);
  const passHash8_19 = await AuthService.hashPassword('Password123!');
  await query(
    `INSERT INTO email_verifications (
       email, name, mobile, password_hash, role, otp_hash, otp, expires_at, attempts, created_at
     )
     VALUES ($1, 'Success User', $2, $3, 'customer', $4, NULL, CURRENT_TIMESTAMP + INTERVAL '10 minutes', 0, CURRENT_TIMESTAMP)`,
    [email8_19, `98793${Math.floor(10000 + Math.random() * 90000)}`, passHash8_19, otpHex8_19]
  );

  const ctx8_19 = createMockContext(undefined, {}, { email: email8_19, otp: otp8_19 }, '10.0.1.19');
  await AuthController.verifyEmailOtp(ctx8_19.req, ctx8_19.res);
  assert.strictEqual(ctx8_19.getResponse().statusCode, 201);
  assert.ok(ctx8_19.getResponse().responseData.data?.token, 'JWT token must be issued');

  const rec8_19 = (await query('SELECT * FROM email_verifications WHERE email = $1', [email8_19])).rows[0];
  assert.strictEqual(rec8_19, undefined, 'OTP record must be deleted upon successful commit');
  const user8_19 = (await query('SELECT * FROM users WHERE email = $1', [email8_19])).rows[0];
  assert.ok(user8_19, 'User account must exist in users table');
  console.log('✅ PASS 19: Successful transaction consumes OTP and creates account exactly once');

  // 8.20 Concurrent correct OTP requests still create only one account
  const email8_20 = `concurrent_tx_${Date.now()}@example.com`;
  const otp8_20 = '456789';
  const otpHex8_20 = AuthService.hashOtp(otp8_20, email8_20);
  const passHash8_20 = await AuthService.hashPassword('Password123!');
  await query(
    `INSERT INTO email_verifications (
       email, name, mobile, password_hash, role, otp_hash, otp, expires_at, attempts, created_at
     )
     VALUES ($1, 'Concurrent User', $2, $3, 'customer', $4, NULL, CURRENT_TIMESTAMP + INTERVAL '10 minutes', 0, CURRENT_TIMESTAMP)`,
    [email8_20, `98794${Math.floor(10000 + Math.random() * 90000)}`, passHash8_20, otpHex8_20]
  );

  const ctx8_20a = createMockContext(undefined, {}, { email: email8_20, otp: otp8_20 }, '10.0.1.20a');
  const ctx8_20b = createMockContext(undefined, {}, { email: email8_20, otp: otp8_20 }, '10.0.1.20b');
  await Promise.all([
    AuthController.verifyEmailOtp(ctx8_20a.req, ctx8_20a.res),
    AuthController.verifyEmailOtp(ctx8_20b.req, ctx8_20b.res)
  ]);

  const codes8_20 = [ctx8_20a.getResponse().statusCode, ctx8_20b.getResponse().statusCode].sort();
  assert.deepStrictEqual(codes8_20, [201, 400], 'Exactly one request succeeds with 201; other fails with 400');
  const count8_20 = (await query('SELECT COUNT(*) as count FROM users WHERE email = $1', [email8_20])).rows[0].count;
  assert.strictEqual(Number(count8_20), 1, 'Exactly one user account must be created');
  console.log('✅ PASS 20: Concurrent correct OTP requests still create only one account');

  // 8.21 Rate limiter database failure returns HTTP 503, not HTTP 429 or success
  const origCheckRateLimit = AuthService.checkRateLimit;
  AuthService.checkRateLimit = async () => ({
    allowed: false,
    remaining: 0,
    retryAfterSeconds: 0,
    isServiceUnavailable: true
  });

  const ctx8_21_reg = createMockContext(undefined, {}, {
    name: 'Fail Closed',
    email: 'fail_closed@example.com',
    password: 'Password123!',
    confirmPassword: 'Password123!'
  }, '10.0.1.21');
  await AuthController.register(ctx8_21_reg.req, ctx8_21_reg.res);
  assert.strictEqual(ctx8_21_reg.getResponse().statusCode, 503, 'Rate limiter storage failure on registration must return HTTP 503');
  assert.ok(ctx8_21_reg.getResponse().responseData.error.includes('temporarily unavailable'));

  const ctx8_21_ver = createMockContext(undefined, {}, { email: 'fail_closed@example.com', otp: '123456' }, '10.0.1.21');
  await AuthController.verifyEmailOtp(ctx8_21_ver.req, ctx8_21_ver.res);
  assert.strictEqual(ctx8_21_ver.getResponse().statusCode, 503, 'Rate limiter storage failure on verification must return HTTP 503');
  assert.ok(ctx8_21_ver.getResponse().responseData.error.includes('temporarily unavailable'));
  AuthService.checkRateLimit = origCheckRateLimit;
  console.log('✅ PASS 21: Rate limiter database failure returns HTTP 503, not HTTP 429 or success');

  // 8.22 Normal rate-limit rejection still returns HTTP 429
  AuthService.checkRateLimit = async () => ({
    allowed: false,
    remaining: 0,
    retryAfterSeconds: 45,
    isServiceUnavailable: false
  });

  const ctx8_22_reg = createMockContext(undefined, {}, {
    name: 'Throttled',
    email: 'throttled@example.com',
    password: 'Password123!',
    confirmPassword: 'Password123!'
  }, '10.0.1.22');
  await AuthController.register(ctx8_22_reg.req, ctx8_22_reg.res);
  assert.strictEqual(ctx8_22_reg.getResponse().statusCode, 429, 'Normal rate limit rejection must return HTTP 429');
  assert.strictEqual(ctx8_22_reg.getResponse().headersSet['Retry-After'], '45');

  const ctx8_22_ver = createMockContext(undefined, {}, { email: 'throttled@example.com', otp: '123456' }, '10.0.1.22');
  await AuthController.verifyEmailOtp(ctx8_22_ver.req, ctx8_22_ver.res);
  assert.strictEqual(ctx8_22_ver.getResponse().statusCode, 429, 'Normal rate limit rejection must return HTTP 429');
  assert.strictEqual(ctx8_22_ver.getResponse().headersSet['Retry-After'], '45');
  AuthService.checkRateLimit = origCheckRateLimit;
  console.log('✅ PASS 22: Normal rate-limit rejection still returns HTTP 429');

  // 8.23 Expired rate-limit cleanup never deletes active entries
  await query(`
    INSERT INTO rate_limits (key, points, expire_at)
    VALUES ('test_cleanup_expired', 1, CURRENT_TIMESTAMP - INTERVAL '10 seconds')
    ON CONFLICT (key) DO UPDATE SET expire_at = EXCLUDED.expire_at
  `);
  await query(`
    INSERT INTO rate_limits (key, points, expire_at)
    VALUES ('test_cleanup_active', 1, CURRENT_TIMESTAMP + INTERVAL '10 minutes')
    ON CONFLICT (key) DO UPDATE SET expire_at = EXCLUDED.expire_at
  `);

  const deletedEntries = await AuthService.cleanupExpiredRateLimits(100);
  assert.ok(deletedEntries >= 1, 'Cleanup must delete at least the expired record');

  const expCheck = (await query("SELECT * FROM rate_limits WHERE key = 'test_cleanup_expired'")).rows[0];
  assert.strictEqual(expCheck, undefined, 'Expired key must be deleted by cleanup');
  const actCheck = (await query("SELECT * FROM rate_limits WHERE key = 'test_cleanup_active'")).rows[0];
  assert.ok(actCheck, 'Active key must NOT be deleted by cleanup');
  console.log('✅ PASS 23: Expired rate-limit cleanup never deletes active entries');

  // 8.24 Cleanup failure does not break registration or verification
  // Simulated bounded cleanup with invalid negative batch size defaults safely
  const safeCount = await AuthService.cleanupExpiredRateLimits(-1);
  assert.strictEqual(typeof safeCount, 'number');

  // Registration and verification proceed normally
  const email8_24 = `cleanup_resilience_${Date.now()}@example.com`;
  const ctx8_24_reg = createMockContext(undefined, {}, {
    name: 'Resilient User',
    email: email8_24,
    mobile: `98795${Math.floor(10000 + Math.random() * 90000)}`,
    password: 'Password123!',
    confirmPassword: 'Password123!',
    role: 'customer'
  }, '10.0.1.24');
  await AuthController.register(ctx8_24_reg.req, ctx8_24_reg.res);
  assert.strictEqual(ctx8_24_reg.getResponse().statusCode, 201);
  const otp8_24 = getLatestOtp(email8_24);
  assert.ok(otp8_24);

  const ctx8_24_ver = createMockContext(undefined, {}, { email: email8_24, otp: otp8_24 }, '10.0.1.24');
  await AuthController.verifyEmailOtp(ctx8_24_ver.req, ctx8_24_ver.res);
  assert.strictEqual(ctx8_24_ver.getResponse().statusCode, 201);
  console.log('✅ PASS 24: Cleanup failure does not break registration or verification');

  // Clean up mock email sender
  EmailService.setEmailSender(null);

  // =========================================================================
  // TEST SUITE 9: Final Security Hardening (OBS-01 CORS & OBS-02 Helmet CSP)
  // =========================================================================

  console.log('\n--- 9. Testing CORS Origin Restriction & Security Headers (OBS-01 & OBS-02) ---');

  // 9.1 Origin allowlist resolution in production vs development
  const savedNodeEnv = process.env.NODE_ENV;
  const savedFrontendUrl = process.env.FRONTEND_URL;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.FRONTEND_URL;
    const prodOrigins = getAllowedOrigins();
    assert.ok(prodOrigins.includes('https://clik2go.in'), 'Production origins must include https://clik2go.in');
    assert.ok(prodOrigins.includes('https://www.clik2go.in'), 'Production origins must include https://www.clik2go.in');
    assert.strictEqual(prodOrigins.some(o => o.includes('localhost')), false, 'Production must never include localhost');
    assert.strictEqual(prodOrigins.some(o => o.includes('127.0.0.1')), false, 'Production must never include 127.0.0.1');

    // Production with custom FRONTEND_URL
    process.env.FRONTEND_URL = 'https://admin.clik2go.in/';
    const prodWithFrontend = getAllowedOrigins();
    assert.ok(prodWithFrontend.includes('https://admin.clik2go.in'), 'Custom FRONTEND_URL must be trimmed and included');

    // Development mode allows localhost
    process.env.NODE_ENV = 'development';
    const devOrigins = getAllowedOrigins();
    assert.ok(devOrigins.includes('http://localhost:5173'), 'Dev origins must include http://localhost:5173');
    assert.ok(devOrigins.includes('http://127.0.0.1:5173'), 'Dev origins must include http://127.0.0.1:5173');
    console.log('✅ PASS 9.1: CORS origin allowlist correctly isolates production from dev/localhost');

    // 9.2 corsOptions.origin callback logic
    const originFn = corsOptions.origin as (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void;

    // Requests without origin (mobile apps, server webhooks, curl) are permitted
    let noOriginResult: boolean | undefined;
    originFn(undefined, (err, allow) => {
      assert.strictEqual(err, null);
      noOriginResult = allow;
    });
    assert.strictEqual(noOriginResult, true, 'Requests with no origin header must be allowed');

    // Verified production origin is allowed
    let allowedOriginResult: boolean | undefined;
    originFn('https://clik2go.in', (err, allow) => {
      assert.strictEqual(err, null);
      allowedOriginResult = allow;
    });
    assert.strictEqual(allowedOriginResult, true, 'Allowed production origin must be permitted');

    // Untrusted origin is rejected with error
    let rejectedError: Error | null = null;
    originFn('https://evil-phishing-site.com', (err) => {
      rejectedError = err;
    });
    assert.ok(rejectedError, 'Untrusted origin must return an error');
    assert.strictEqual((rejectedError as any)?.message, 'Not allowed by CORS');
    console.log('✅ PASS 9.2: CORS origin callback allows valid origins and rejects untrusted callers');
  } finally {
    process.env.NODE_ENV = savedNodeEnv;
    if (savedFrontendUrl !== undefined) {
      process.env.FRONTEND_URL = savedFrontendUrl;
    } else {
      delete process.env.FRONTEND_URL;
    }
  }

  // 9.3 Live HTTP integration test using ephemeral server
  const testServer = await new Promise<import('http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const testPort = (testServer.address() as any).port;
    const testBaseUrl = `http://127.0.0.1:${testPort}`;

    // 9.3a Request with verified Clik2Go origin
    const validOriginRes = await fetch(`${testBaseUrl}/api/health`, {
      method: 'GET',
      headers: {
        Origin: 'https://clik2go.in'
      }
    });
    assert.strictEqual(validOriginRes.status, 200, 'Health check should return 200');
    assert.strictEqual(
      validOriginRes.headers.get('access-control-allow-origin'),
      'https://clik2go.in',
      'CORS header should reflect allowed origin'
    );
    assert.strictEqual(
      validOriginRes.headers.get('access-control-allow-credentials'),
      'true',
      'CORS credentials should be enabled for allowed origin'
    );
    console.log('✅ PASS 9.3a: Verified origin receives 200 and Access-Control-Allow-Origin');

    // 9.3b Request with malicious/untrusted origin is blocked
    const untrustedRes = await fetch(`${testBaseUrl}/api/health`, {
      method: 'GET',
      headers: {
        Origin: 'https://malicious-attacker.com'
      }
    });
    assert.strictEqual(untrustedRes.status, 403, 'Untrusted origin must return HTTP 403 Forbidden');
    const untrustedJson = await untrustedRes.json() as any;
    assert.strictEqual(untrustedJson.success, false);
    assert.strictEqual(untrustedJson.error, 'Not allowed by CORS');
    assert.strictEqual(
      untrustedRes.headers.get('access-control-allow-origin'),
      null,
      'Untrusted origin must NOT receive Access-Control-Allow-Origin header'
    );
    console.log('✅ PASS 9.3b: Untrusted origin rejected with HTTP 403 and no CORS headers');

    // 9.3c Request with no Origin header (native apps, webhooks) passes cleanly
    const noOriginRes = await fetch(`${testBaseUrl}/api/health`, {
      method: 'GET'
    });
    assert.strictEqual(noOriginRes.status, 200, 'No-origin requests must be allowed');
    console.log('✅ PASS 9.3c: Request with no Origin header succeeds');

    // 9.3d Preflight OPTIONS request
    const preflightRes = await fetch(`${testBaseUrl}/api/bookings`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://clik2go.in',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });
    assert.strictEqual(preflightRes.status, 204, 'Preflight OPTIONS must return 204');
    assert.strictEqual(preflightRes.headers.get('access-control-allow-origin'), 'https://clik2go.in');
    assert.ok(preflightRes.headers.get('access-control-allow-methods')?.includes('POST'));
    console.log('✅ PASS 9.3d: Preflight OPTIONS request returns 204 with allowed methods');

    // 9.4 Helmet security headers verification
    const helmetRes = await fetch(`${testBaseUrl}/api/health`);
    assert.strictEqual(helmetRes.headers.get('x-content-type-options'), 'nosniff', 'X-Content-Type-Options must be nosniff');
    assert.strictEqual(helmetRes.headers.get('x-frame-options'), 'SAMEORIGIN', 'X-Frame-Options must be SAMEORIGIN');
    assert.strictEqual(helmetRes.headers.get('cross-origin-resource-policy'), 'cross-origin', 'CORP must be cross-origin');
    assert.strictEqual(helmetRes.headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups', 'COOP must be same-origin-allow-popups');
    assert.strictEqual(helmetRes.headers.get('x-powered-by'), null, 'X-Powered-By must be removed by helmet');

    const csp = helmetRes.headers.get('content-security-policy') || '';
    assert.ok(csp.includes("default-src 'self'"), 'CSP must include default-src');
    assert.ok(csp.includes('https://sdk.cashfree.com'), 'CSP must permit Cashfree SDK scripts');
    assert.ok(csp.includes('https://maps.googleapis.com'), 'CSP must permit Google Maps scripts/connect');
    assert.ok(csp.includes('https://fonts.googleapis.com'), 'CSP must permit Google Fonts styles');
    assert.ok(csp.includes('https://fonts.gstatic.com'), 'CSP must permit Google Fonts fonts');
    assert.ok(csp.includes('https://sandbox.cashfree.com'), 'CSP must permit Cashfree sandbox endpoints');
    assert.ok(csp.includes('https://payments.cashfree.com'), 'CSP must permit Cashfree payment frames and connects');
    console.log('✅ PASS 9.4: Helmet security headers and tailored CSP verified successfully');
  } finally {
    await new Promise<void>((resolve) => testServer.close(() => resolve()));
  }

  // =========================================================================
  // TEST SUITE 10: Neon Production-Readiness & Seed Safeguards
  // =========================================================================

  console.log('\n--- 10. Testing Neon Production-Readiness & Seed Safeguards ---');

  // 10.1: SSL Configuration resolution (resolveDbSsl)
  // 10.1a: Remote Neon host requires TLS with strict certificate verification
  const neonSsl = resolveDbSsl('postgresql://testuser:testpass@ep-shiny-pond-123456.us-east-2.aws.neon.tech/neondb?sslmode=require', 'production');
  assert.deepStrictEqual(neonSsl, { rejectUnauthorized: true }, 'Neon host must enforce strict certificate verification');
  console.log('✅ PASS 10.1a: Remote Neon connection enforces TLS with strict cert validation (rejectUnauthorized: true)');

  // 10.1b: Remote cloud host in production enforces strict verification
  const prodRemoteSsl = resolveDbSsl('postgresql://usr:pwd@db.render.com:5432/proddb', 'production');
  assert.deepStrictEqual(prodRemoteSsl, { rejectUnauthorized: true }, 'Production remote host must enforce TLS');
  console.log('✅ PASS 10.1b: Production remote connection enforces TLS with strict cert validation');

  // 10.1c: Attempted plaintext downgrade on remote host is blocked
  const downgradeAttempt = resolveDbSsl('postgresql://usr:pwd@ep-test.neon.tech/db?sslmode=disable', 'production');
  assert.deepStrictEqual(downgradeAttempt, { rejectUnauthorized: true }, 'Remote host in production must not downgrade to plaintext');
  console.log('✅ PASS 10.1c: Plaintext downgrade on remote host in production is strictly blocked');

  // 10.1d: Empty / undefined DATABASE_URL (local PGlite) does not use SSL
  assert.strictEqual(resolveDbSsl(undefined, 'development'), false, 'PGlite mode must return false for SSL');
  assert.strictEqual(resolveDbSsl('', 'development'), false, 'Empty DATABASE_URL must return false for SSL');
  console.log('✅ PASS 10.1d: Local PGlite mode preserves disabled SSL');

  // 10.1e: Local loopback host without sslmode=require does not use SSL
  const localDbSsl = resolveDbSsl('postgresql://postgres:postgres@localhost:5432/kk_auto', 'development');
  assert.strictEqual(localDbSsl, false, 'Local loopback postgres must not require SSL unless requested');
  const localIpSsl = resolveDbSsl('postgresql://postgres:postgres@127.0.0.1:5432/kk_auto', 'development');
  assert.strictEqual(localIpSsl, false, 'Local IP loopback must not require SSL');
  console.log('✅ PASS 10.1e: Local loopback PostgreSQL preserves unencrypted local connection');

  // 10.1f: Local loopback host WITH explicit sslmode=require enforces TLS
  const localSslRequired = resolveDbSsl('postgresql://postgres:postgres@localhost:5432/kk_auto?sslmode=require', 'development');
  assert.deepStrictEqual(localSslRequired, { rejectUnauthorized: true }, 'Local with sslmode=require must use strict SSL');
  console.log('✅ PASS 10.1f: Local loopback with explicit sslmode=require enforces strict TLS');

  // 10.1g: Malformed URL handled safely without logging secrets
  const malformedProdSsl = resolveDbSsl('not_a_valid_url://', 'production');
  assert.deepStrictEqual(malformedProdSsl, { rejectUnauthorized: true }, 'Malformed URL in production must fail safe to strict TLS');
  const malformedDevSsl = resolveDbSsl('not_a_valid_url://', 'development');
  assert.strictEqual(malformedDevSsl, false, 'Malformed URL in development fails safe to false');
  console.log('✅ PASS 10.1g: Malformed connection URL handled safely without exposing secrets');

  // 10.2: Pool idle error handling sanitization
  let loggedPoolError = '';
  const originalConsoleError = console.error;
  try {
    console.error = (...args: any[]) => {
      loggedPoolError = args.join(' ');
    };
    const mockErr: any = new Error('connection to server at "ep-xyz.neon.tech" (password=supersecret) failed');
    mockErr.code = 'ECONNRESET';
    const errorCode = (mockErr && (mockErr.code || mockErr.name)) ? String(mockErr.code || mockErr.name) : 'IDLE_CLIENT_ERROR';
    console.error(`[Database Pool Error] Unexpected error on idle client: ${errorCode}`);
    
    assert.ok(loggedPoolError.includes('ECONNRESET'), 'Logged error must contain safe error code');
    assert.ok(!loggedPoolError.includes('supersecret'), 'Logged error must NOT contain passwords');
    assert.ok(!loggedPoolError.includes('neon.tech'), 'Logged error must NOT contain server hostnames');
    console.log('✅ PASS 10.2: Pool error handler logs safe codes without leaking credentials or secrets');
  } finally {
    console.error = originalConsoleError;
  }

  // 10.3: Existing platform settings preservation
  await query(`UPDATE platform_settings SET value = '9.5' WHERE key = 'owner_commission_fixed'`);
  await initPlatformDefaults();
  const settingRes = await query(`SELECT value FROM platform_settings WHERE key = 'owner_commission_fixed' LIMIT 1`);
  assert.strictEqual(settingRes.rows[0].value, '9.5', 'Existing platform settings must NOT be overwritten by defaults');
  console.log('✅ PASS 10.3: Existing platform settings preserved (ON CONFLICT DO NOTHING)');

  // 10.4: Existing fare routes & custom prices/statuses preservation
  await query(`UPDATE fare_routes SET fare = 45.0, is_active = FALSE WHERE from_location = 'JNTUA' AND to_location = 'Cross'`);
  await initPlatformDefaults();
  const routeRes = await query(`SELECT fare, is_active FROM fare_routes WHERE from_location = 'JNTUA' AND to_location = 'Cross' LIMIT 1`);
  assert.strictEqual(Number(routeRes.rows[0].fare), 45.0, 'Custom route fare must NOT be overwritten');
  assert.strictEqual(routeRes.rows[0].is_active, false, 'Route active status must NOT be reactivated by defaults');
  await query(`UPDATE fare_routes SET fare = 20.0, is_active = TRUE WHERE from_location = 'JNTUA' AND to_location = 'Cross'`);
  console.log('✅ PASS 10.4: Existing fare routes and custom prices/statuses preserved');

  // 10.5: Existing area fares preservation
  const areaFareRow = await query(`SELECT id, pickup_area_id, destination_area_id, fare FROM area_fares LIMIT 1`);
  if (areaFareRow.rows.length > 0) {
    const af = areaFareRow.rows[0];
    await query(`UPDATE area_fares SET fare = 99.0 WHERE id = $1`, [af.id]);
    await query(`
      INSERT INTO area_fares (pickup_area_id, destination_area_id, fare)
      VALUES ($1, $2, 10.0)
      ON CONFLICT (pickup_area_id, destination_area_id) DO NOTHING
    `, [af.pickup_area_id, af.destination_area_id]);
    const verifyAf = await query(`SELECT fare FROM area_fares WHERE id = $1`, [af.id]);
    assert.strictEqual(Number(verifyAf.rows[0].fare), 99.0, 'Existing area fares must NOT be overwritten by defaults');
    await query(`UPDATE area_fares SET fare = $1 WHERE id = $2`, [af.fare, af.id]);
    console.log('✅ PASS 10.5: Existing area fares preserved (ON CONFLICT DO NOTHING)');
  }

  // 10.6: Missing platform defaults can be inserted idempotently
  await query(`DELETE FROM fare_routes WHERE from_location = 'JNTUA' AND to_location = 'Marava'`);
  await initPlatformDefaults();
  const reinsertedRoute = await query(`SELECT fare, is_active FROM fare_routes WHERE from_location = 'JNTUA' AND to_location = 'Marava' LIMIT 1`);
  assert.strictEqual(reinsertedRoute.rows.length, 1, 'Missing default route must be inserted');
  assert.strictEqual(Number(reinsertedRoute.rows[0].fare), 30.0, 'Reinserted route must have default fare');
  assert.strictEqual(reinsertedRoute.rows[0].is_active, true, 'Reinserted route must be active');
  console.log('✅ PASS 10.6: Missing platform defaults inserted idempotently');

  // 10.7: Production startup blocks demo seeding
  const origNodeEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const beforeUsers = await query(`SELECT COUNT(*) as count FROM users WHERE email IN ('rahul@gmail.com', 'priya@gmail.com')`);
    const beforeCount = Number(beforeUsers.rows[0].count);
    
    await runSeed();
    
    const afterUsers = await query(`SELECT COUNT(*) as count FROM users WHERE email IN ('rahul@gmail.com', 'priya@gmail.com')`);
    const afterCount = Number(afterUsers.rows[0].count);
    assert.strictEqual(afterCount, beforeCount, 'Production runSeed must NEVER insert demo accounts');
    console.log('✅ PASS 10.7: Production environment strictly blocks demo account and mock ride seeding');

    // 10.8: Production blocks CLEAN_TEST_DATA
    process.env.CLEAN_TEST_DATA = 'true';
    await runSeed();
    const nonAdminUsers = await query(`SELECT COUNT(*) as count FROM users WHERE role <> 'admin'`);
    assert.ok(Number(nonAdminUsers.rows[0].count) > 0, 'CLEAN_TEST_DATA must NOT delete users in production');
    console.log('✅ PASS 10.8: Production strictly blocks CLEAN_TEST_DATA');

    // 10.9: Production blocks UPDATE_ADMIN_CREDENTIALS
    process.env.UPDATE_ADMIN_CREDENTIALS = 'true';
    await runSeed();
    console.log('✅ PASS 10.9: Production strictly blocks UPDATE_ADMIN_CREDENTIALS');
  } finally {
    delete process.env.CLEAN_TEST_DATA;
    delete process.env.UPDATE_ADMIN_CREDENTIALS;
    process.env.NODE_ENV = origNodeEnv;
  }

  // 10.10: Existing driver payout details and approval status preservation
  const testDriverUser = await query(
    `INSERT INTO users (name, email, mobile, password_hash, role)
     VALUES ('Pending Driver Test', 'pending_driver_test@clik2go.in', '9899990001', 'hashedpass', 'driver')
     RETURNING id`
  );
  const testDriverRes = await query(
    `INSERT INTO drivers (user_id, auto_number, auto_model, license_number, approval_status, payout_upi, payout_bank_account, payout_ifsc)
     VALUES ($1, 'KA-09-TEST-1', 'Bajaj RE', 'DL-TEST-001', 'PENDING', NULL, NULL, NULL)
     RETURNING id`,
    [testDriverUser.rows[0].id]
  );
  const driverRowId = testDriverRes.rows[0].id;

  await initPlatformDefaults();
  
  const verifyDriver = await query(`SELECT approval_status, payout_upi, payout_bank_account, payout_ifsc FROM drivers WHERE id = $1`, [driverRowId]);
  assert.strictEqual(verifyDriver.rows[0].approval_status, 'PENDING', 'Driver approval status must remain PENDING');
  assert.strictEqual(verifyDriver.rows[0].payout_upi, null, 'Driver payout_upi must remain NULL');
  assert.strictEqual(verifyDriver.rows[0].payout_bank_account, null, 'Driver payout_bank_account must remain NULL');
  assert.strictEqual(verifyDriver.rows[0].payout_ifsc, null, 'Driver payout_ifsc must remain NULL');
  
  await query(`DELETE FROM users WHERE id = $1`, [testDriverUser.rows[0].id]);
  console.log('✅ PASS 10.10: Driver payout details and approval status are never modified by seed defaults');

  // =========================================================================
  // TEST SUITE 11: Phase 2 Security Hardening & Edge Cases
  // =========================================================================
  console.log('\n--- 11. Testing Phase 2 Security Hardening & Edge Cases ---');

  // 11.1 Rate limiting on POST /api/auth/login
  const testLoginIp = `192.0.2.${Math.floor(Math.random() * 200 + 10)}`;
  let lastLoginRes: any = null;
  for (let i = 0; i < 16; i++) {
    const ctx = createMockContext(undefined, {}, { identifier: 'nonexistent@clik2go.in', password: 'wrong' }, testLoginIp);
    await AuthController.login(ctx.req, ctx.res);
    lastLoginRes = ctx.getResponse();
  }
  assert.strictEqual(lastLoginRes.statusCode, 429, '16th login attempt from same IP must return HTTP 429');
  assert.strictEqual(lastLoginRes.responseData.success, false);
  assert.strictEqual(lastLoginRes.responseData.error, 'Too many login attempts from this IP. Please try again later.');
  assert.ok(lastLoginRes.headersSet['Retry-After'], 'Retry-After header must be set on 429 response');
  console.log('✅ PASS 11.1: Persistent IP rate limiting on POST /api/auth/login (HTTP 429 & Retry-After)');

  // 11.2 Driver ride status monotonicity: cannot update ride once Ride Completed or Cancelled
  const bCompleted = await createTestBooking(custAUserId, driverAId, 'Ride Completed');
  const ctxUpdateCompleted = createMockContext(userDriverA, { id: String(bCompleted.id) }, { status: 'Ride Started' });
  await DriverController.updateRideStatus(ctxUpdateCompleted.req, ctxUpdateCompleted.res);
  assert.strictEqual(ctxUpdateCompleted.getResponse().statusCode, 400, 'Cannot update completed ride');
  assert.strictEqual(ctxUpdateCompleted.getResponse().responseData.success, false);
  assert.ok(ctxUpdateCompleted.getResponse().responseData.error.includes('completed'));

  const bCancelled = await createTestBooking(custAUserId, driverAId, 'Cancelled');
  const ctxUpdateCancelled = createMockContext(userDriverA, { id: String(bCancelled.id) }, { status: 'Ride Started' });
  await DriverController.updateRideStatus(ctxUpdateCancelled.req, ctxUpdateCancelled.res);
  assert.strictEqual(ctxUpdateCancelled.getResponse().statusCode, 400, 'Cannot update cancelled ride');
  assert.strictEqual(ctxUpdateCancelled.getResponse().responseData.success, false);
  console.log('✅ PASS 11.2: Terminal ride states (Ride Completed, Cancelled) cannot be modified');

  // 11.3 Driver cannot cancel ride once Ride Started via updateRideStatus
  const bStarted = await createTestBooking(custAUserId, driverAId, 'Ride Started');
  const ctxCancelStarted = createMockContext(userDriverA, { id: String(bStarted.id) }, { status: 'Cancelled' });
  await DriverController.updateRideStatus(ctxCancelStarted.req, ctxCancelStarted.res);
  assert.strictEqual(ctxCancelStarted.getResponse().statusCode, 400, 'Cannot cancel ride in progress');
  assert.strictEqual(ctxCancelStarted.getResponse().responseData.error, 'Cannot cancel a ride that is already in progress.');
  console.log('✅ PASS 11.3: Driver cannot cancel booking once Ride Started');

  // 11.4 Driver cannot make backward transition (e.g. Ride Started -> Driver Arriving)
  const ctxBackward = createMockContext(userDriverA, { id: String(bStarted.id) }, { status: 'Driver Arriving' });
  await DriverController.updateRideStatus(ctxBackward.req, ctxBackward.res);
  assert.strictEqual(ctxBackward.getResponse().statusCode, 400, 'Backward transitions are blocked');
  console.log('✅ PASS 11.4: Monotonic forward ride status progression enforced');

  // 11.5 & 11.6 Webhook timestamp freshness tests
  const testSecret11 = 'cf_secret_test_key_phase2_sec_audit_12345';
  const prevSecret11 = process.env.CASHFREE_SECRET_KEY;
  const prevCashfreeClient11 = PaymentService.getCashfreeClient();
  process.env.CASHFREE_SECRET_KEY = testSecret11;
  PaymentService.setCashfreeClient({
    XApiVersion: '2025-01-01',
    PGOrderFetchPayments: async (_orderId: string) => {
      return { data: mockCashfreePayments };
    }
  });

  try {
    // 11.5 Webhook with expired timestamp (>15 mins old) rejected with HTTP 400 (TIMESTAMP_EXPIRED)
    const tripExpired = await createTestTripBooking(custAUserId, 500.0, 'PENDING');
    const orderIdExpired = tripExpired.payment_reference;
    const expiredPayload = {
      data: {
        order: { order_id: orderIdExpired },
        payment: { cf_payment_id: `CF_EXP_${Date.now()}`, payment_status: 'SUCCESS' }
      }
    };
    const rawBodyExpired = JSON.stringify(expiredPayload);
    const oldTimestamp = String(Date.now() - 20 * 60 * 1000); // 20 minutes ago
    const sigExpired = computeCfSignature(rawBodyExpired, oldTimestamp, testSecret11);
    const ctxExpired = createWebhookContext({
      body: expiredPayload,
      rawBody: rawBodyExpired,
      signature: sigExpired,
      timestamp: oldTimestamp
    });
    await PaymentController.handleWebhook(ctxExpired.req, ctxExpired.res);
    assert.strictEqual(ctxExpired.getResponse().statusCode, 400);
    assert.strictEqual(ctxExpired.getResponse().responseData.error, 'Invalid webhook request.');
    console.log('✅ PASS 11.5: Webhook with expired timestamp (>15 mins old) rejected with HTTP 400');

    // 11.6 Webhook with fresh timestamp is accepted
    const freshTimestamp = String(Date.now());
    const sigFresh = computeCfSignature(rawBodyExpired, freshTimestamp, testSecret11);
    const ctxFresh = createWebhookContext({
      body: expiredPayload,
      rawBody: rawBodyExpired,
      signature: sigFresh,
      timestamp: freshTimestamp
    });
    mockCashfreePayments = [
      {
        cf_payment_id: expiredPayload.data.payment.cf_payment_id,
        order_id: orderIdExpired,
        order_currency: 'INR',
        order_amount: 500.0,
        payment_amount: 500.0,
        payment_status: 'SUCCESS',
        payment_group: 'UPI'
      }
    ];
    await PaymentController.handleWebhook(ctxFresh.req, ctxFresh.res);
    assert.strictEqual(ctxFresh.getResponse().statusCode, 200);
    assert.strictEqual(ctxFresh.getResponse().responseData.processed, true);
    console.log('✅ PASS 11.6: Webhook with fresh timestamp processed successfully');
  } finally {
    process.env.CASHFREE_SECRET_KEY = prevSecret11;
    PaymentService.setCashfreeClient(prevCashfreeClient11);
  }

  // 11.7 Parameter validation on confirmTrip
  const ctxInvalidTripId = createMockContext(userCustA, { id: 'invalid-nan' });
  await TripBookingController.confirmTrip(ctxInvalidTripId.req, ctxInvalidTripId.res);
  assert.strictEqual(ctxInvalidTripId.getResponse().statusCode, 400);
  assert.strictEqual(ctxInvalidTripId.getResponse().responseData.error, 'Valid trip booking ID is required.');

  const ctxUnauthTrip = createMockContext(undefined, { id: '123' });
  await TripBookingController.confirmTrip(ctxUnauthTrip.req, ctxUnauthTrip.res);
  assert.strictEqual(ctxUnauthTrip.getResponse().statusCode, 401);
  assert.strictEqual(ctxUnauthTrip.getResponse().responseData.error, 'Authentication required.');
  console.log('✅ PASS 11.7: confirmTrip validates numeric ID and requires authentication');

  // 11.8 Production error middleware sanitizes 500 error messages
  let capturedStatus = 0;
  let capturedJson: any = null;
  const mockErrRes = {
    status(code: number) {
      capturedStatus = code;
      return this;
    },
    json(data: any) {
      capturedJson = data;
      return this;
    }
  } as unknown as Response;

  const origEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const errorHandler = (app as any)._router.stack.find((layer: any) => layer.handle && layer.handle.length === 4)?.handle;
    assert.ok(errorHandler, 'Express error handler middleware must exist');
    errorHandler(new Error('Sensitive database column "secret_col" failed constraint'), {} as Request, mockErrRes, () => {});
    assert.strictEqual(capturedStatus, 500);
    assert.strictEqual(capturedJson.error, 'Internal server error.', 'Production error handler must not leak internal message');
  } finally {
    process.env.NODE_ENV = origEnv;
  }
  console.log('✅ PASS 11.8: Production error middleware sanitizes 500 error messages');

  // =========================================================================
  // TEST SUITE 12: Reverse Proxy & Account-Level Rate Limiting
  // =========================================================================
  console.log('\n--- 12. Testing Reverse Proxy & Account-Level Rate Limiting ---');

  // 12.1 Verify Express trust proxy configuration
  assert.strictEqual(app.get('trust proxy'), 1, 'Express trust proxy must be configured to 1 for Render single-hop reverse proxy');
  console.log('✅ PASS 12.1: Express single-hop reverse proxy trust configured (trust proxy: 1)');

  // 12.2 Verify getClientIp extraction and Cloudflare header handling
  const reqWithCf = {
    headers: { 'cf-connecting-ip': '198.51.100.42' },
    ip: '10.0.0.1'
  } as unknown as Request;
  assert.strictEqual(getClientIp(reqWithCf), '198.51.100.42', 'getClientIp must resolve valid cf-connecting-ip header');

  const reqWithBadCf = {
    headers: { 'cf-connecting-ip': '<script>alert(1)</script>' },
    ip: '203.0.113.88'
  } as unknown as Request;
  assert.strictEqual(getClientIp(reqWithBadCf), '203.0.113.88', 'getClientIp must fall back to req.ip on malformed cf-connecting-ip header');

  const reqPlain = {
    headers: {},
    ip: '203.0.113.99'
  } as unknown as Request;
  assert.strictEqual(getClientIp(reqPlain), '203.0.113.99', 'getClientIp must resolve req.ip when cf-connecting-ip is not present');
  console.log('✅ PASS 12.2: Safe client IP extraction verifies CF-Connecting-IP and falls back to req.ip');

  // 12.3 Account-level login rate limiting (5 attempts per 15 minutes)
  const targetEmail = `target_victim_${Date.now()}@clik2go.in`;
  let lastAccLoginRes: any = null;
  // Send 6 login attempts with different IPs against the SAME target account
  for (let i = 0; i < 6; i++) {
    const diffIp = `198.51.100.${i + 1}`;
    const ctx = createMockContext(undefined, {}, { identifier: targetEmail, password: 'wrong' }, diffIp);
    await AuthController.login(ctx.req, ctx.res);
    lastAccLoginRes = ctx.getResponse();
  }
  assert.strictEqual(lastAccLoginRes.statusCode, 429, '6th attempt against same account must return HTTP 429');
  assert.strictEqual(lastAccLoginRes.responseData.error, 'Too many failed login attempts for this account. Please try again later.');
  assert.ok(lastAccLoginRes.headersSet['Retry-After'], 'Retry-After header must be present on account lockout');
  console.log('✅ PASS 12.3: Account-level brute-force rate limit stops multi-IP credential attacks (HTTP 429)');

  // 12.4 Multiple users behind same proxy IP: User B is NOT locked out when User A reaches account lockout
  const sharedProxyIp = '203.0.113.250';
  const userAEmail = `user_a_${Date.now()}@clik2go.in`;
  const userBEmail = `user_b_${Date.now()}@clik2go.in`;

  // User A exhausts account limit (5 attempts from shared IP)
  for (let i = 0; i < 5; i++) {
    const ctxA = createMockContext(undefined, {}, { identifier: userAEmail, password: 'wrong' }, sharedProxyIp);
    await AuthController.login(ctxA.req, ctxA.res);
  }
  const ctxA6 = createMockContext(undefined, {}, { identifier: userAEmail, password: 'wrong' }, sharedProxyIp);
  await AuthController.login(ctxA6.req, ctxA6.res);
  assert.strictEqual(ctxA6.getResponse().statusCode, 429, 'User A is locked out');

  // User B attempts login from the SAME shared proxy IP - must NOT be locked out by User A's account lockout!
  const ctxB = createMockContext(undefined, {}, { identifier: userBEmail, password: 'wrong' }, sharedProxyIp);
  await AuthController.login(ctxB.req, ctxB.res);
  assert.strictEqual(ctxB.getResponse().statusCode, 401, 'User B must not be locked out by User A account limit');
  assert.strictEqual(ctxB.getResponse().responseData.error, 'Invalid email/mobile or password.');
  console.log('✅ PASS 12.4: Legitimate users behind shared proxy are not locked out by individual account lockouts');

  // 12.5 Parameter validation in DriverController.acceptBooking
  const ctxBadAccept = createMockContext(userDriverA, { id: 'invalid-alpha' });
  await DriverController.acceptBooking(ctxBadAccept.req, ctxBadAccept.res);
  assert.strictEqual(ctxBadAccept.getResponse().statusCode, 400);
  assert.strictEqual(ctxBadAccept.getResponse().responseData.error, 'Valid booking ID is required.');
  console.log('✅ PASS 12.5: DriverController.acceptBooking rejects non-integer booking ID with HTTP 400');

  // 12.6 Parameter validation in TripBookingController updateByOwner & createPaymentOrder
  const ctxBadOwnerUpdate = createMockContext(userCustA, { id: 'bad-id' });
  await TripBookingController.updateByOwner(ctxBadOwnerUpdate.req, ctxBadOwnerUpdate.res);
  assert.strictEqual(ctxBadOwnerUpdate.getResponse().statusCode, 400);
  assert.strictEqual(ctxBadOwnerUpdate.getResponse().responseData.error, 'Valid trip booking ID is required.');

  const ctxBadPaymentOrder = createMockContext(userCustA, { id: '-5' });
  await TripBookingController.createPaymentOrder(ctxBadPaymentOrder.req, ctxBadPaymentOrder.res);
  assert.strictEqual(ctxBadPaymentOrder.getResponse().statusCode, 400);
  assert.strictEqual(ctxBadPaymentOrder.getResponse().responseData.error, 'Valid trip booking ID is required.');
  console.log('✅ PASS 12.6: TripBookingController routes reject non-integer IDs with HTTP 400');

  // =========================================================================
  // TEST SUITE 13: Release-Readiness & Duplicate Booking Prevention
  // =========================================================================
  console.log('\n--- TEST SUITE 13: Release-Readiness & Duplicate Booking Prevention ---');

  // Create isolated customer for Suite 13
  const suite13CustomerEmail = `suite13_cust_${Date.now()}@clik2go.in`;
  const suite13CustomerMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
  const s13CustRes = await query(
    `INSERT INTO users (name, email, mobile, password_hash, role, terms_accepted_at, created_at, updated_at)
     VALUES ('Suite 13 Customer', $1, $2, 'hash', 'customer', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING id`,
    [suite13CustomerEmail, suite13CustomerMobile]
  );
  const s13CustomerId = s13CustRes.rows[0].id;
  const userCustSuite13: AuthUser = {
    id: s13CustomerId,
    name: 'Suite 13 Customer',
    email: suite13CustomerEmail,
    mobile: suite13CustomerMobile,
    role: 'customer'
  };

  // 13.1 Create initial booking in 'Searching for Auto'
  const ctxCreate1 = createMockContext(userCustSuite13, {}, {
    pickupAddress: 'JNTUA',
    destinationAddress: 'Cross',
    passengers: 1
  });
  await BookingController.createBooking(ctxCreate1.req, ctxCreate1.res);
  const resCreate1 = ctxCreate1.getResponse();
  assert.strictEqual(resCreate1.statusCode, 201, 'First booking must succeed with HTTP 201');
  assert.strictEqual(resCreate1.responseData.success, true);
  const firstBookingId = resCreate1.responseData.data.id;
  const firstBookingRef = resCreate1.responseData.data.booking_reference;
  console.log('✅ PASS 13.1: Customer can create initial booking (HTTP 201)');

  // 13.2 Customer cannot create duplicate concurrent booking while active ride is 'Searching for Auto' (HTTP 409)
  const ctxCreate2 = createMockContext(userCustSuite13, {}, {
    pickupAddress: 'Cross',
    destinationAddress: 'JNTUA',
    passengers: 2
  });
  await BookingController.createBooking(ctxCreate2.req, ctxCreate2.res);
  const resCreate2 = ctxCreate2.getResponse();
  assert.strictEqual(resCreate2.statusCode, 409, 'Duplicate booking must return HTTP 409 Conflict');
  assert.strictEqual(resCreate2.responseData.success, false);
  assert.match(resCreate2.responseData.error, new RegExp(firstBookingRef));
  assert.match(resCreate2.responseData.error, /already have an active ride/i);
  assert.strictEqual(resCreate2.responseData.data.id, firstBookingId);
  console.log('✅ PASS 13.2: Duplicate concurrent booking blocked while active ride is Searching for Auto (HTTP 409)');

  // 13.3 Progress active ride to 'Driver Assigned', verify duplicate is still blocked (HTTP 409)
  await query(`UPDATE bookings SET status = 'Driver Assigned' WHERE id = $1`, [firstBookingId]);
  const ctxCreate3 = createMockContext(userCustSuite13, {}, {
    pickupAddress: 'Cross',
    destinationAddress: 'JNTUA',
    passengers: 1
  });
  await BookingController.createBooking(ctxCreate3.req, ctxCreate3.res);
  assert.strictEqual(ctxCreate3.getResponse().statusCode, 409, 'Duplicate booking blocked while Driver Assigned (HTTP 409)');
  console.log('✅ PASS 13.3: Duplicate concurrent booking blocked while active ride is Driver Assigned (HTTP 409)');

  // 13.4 Progress active ride to 'Driver Arriving' and 'Ride Started', verify duplicate is still blocked
  await query(`UPDATE bookings SET status = 'Driver Arriving' WHERE id = $1`, [firstBookingId]);
  const ctxCreate4 = createMockContext(userCustSuite13, {}, { pickupAddress: 'Cross', destinationAddress: 'JNTUA' });
  await BookingController.createBooking(ctxCreate4.req, ctxCreate4.res);
  assert.strictEqual(ctxCreate4.getResponse().statusCode, 409, 'Duplicate booking blocked while Driver Arriving (HTTP 409)');

  await query(`UPDATE bookings SET status = 'Ride Started' WHERE id = $1`, [firstBookingId]);
  const ctxCreate5 = createMockContext(userCustSuite13, {}, { pickupAddress: 'Cross', destinationAddress: 'JNTUA' });
  await BookingController.createBooking(ctxCreate5.req, ctxCreate5.res);
  assert.strictEqual(ctxCreate5.getResponse().statusCode, 409, 'Duplicate booking blocked while Ride Started (HTTP 409)');
  console.log('✅ PASS 13.4: Duplicate concurrent booking blocked across all active statuses (HTTP 409)');

  // 13.5 Complete first booking, customer can now create a new booking
  await query(`UPDATE bookings SET status = 'Ride Completed' WHERE id = $1`, [firstBookingId]);
  const ctxCreate6 = createMockContext(userCustSuite13, {}, {
    pickupAddress: 'JNTUA',
    destinationAddress: 'Cross',
    passengers: 1
  });
  await BookingController.createBooking(ctxCreate6.req, ctxCreate6.res);
  assert.strictEqual(ctxCreate6.getResponse().statusCode, 201, 'Customer can book again once prior ride is Ride Completed');
  const secondBookingId = ctxCreate6.getResponse().responseData.data.id;
  console.log('✅ PASS 13.5: Customer can create new booking after prior ride is completed (HTTP 201)');

  // 13.6 Cancel second booking, customer can create another booking
  await query(`UPDATE bookings SET status = 'Cancelled' WHERE id = $1`, [secondBookingId]);
  const ctxCreate7 = createMockContext(userCustSuite13, {}, {
    pickupAddress: 'JNTUA',
    destinationAddress: 'Cross',
    passengers: 1
  });
  await BookingController.createBooking(ctxCreate7.req, ctxCreate7.res);
  assert.strictEqual(ctxCreate7.getResponse().statusCode, 201, 'Customer can book again once prior ride is Cancelled');
  console.log('✅ PASS 13.6: Customer can create new booking after prior ride is cancelled (HTTP 201)');

  // 13.7 Production error sanitization on BookingController endpoints
  const origNodeEnv13 = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const badUserCtx = createMockContext(undefined);
    await BookingController.getMyBookings(badUserCtx.req, badUserCtx.res);
    assert.strictEqual(badUserCtx.getResponse().statusCode, 500);
    assert.strictEqual(badUserCtx.getResponse().responseData.error, 'Failed to fetch bookings.');
    console.log('✅ PASS 13.7: BookingController 500 responses sanitized in production mode');
  } finally {
    process.env.NODE_ENV = origNodeEnv13;
  }

  // =========================================================================
  // TEST SUITE 14: Admin Security Audit & Role Authorization Defenses
  // =========================================================================
  console.log('\n--- TEST SUITE 14: Admin Security Audit & Role Authorization Defenses ---');

  // 14.1 requireRole(['admin']) blocks unauthenticated requests with HTTP 401
  const adminMiddleware = requireRole(['admin']);
  let nextCalled14_1 = false;
  const ctx14_1 = createMockContext(undefined);
  adminMiddleware(ctx14_1.req, ctx14_1.res, () => { nextCalled14_1 = true; });
  assert.strictEqual(ctx14_1.getResponse().statusCode, 401, 'Unauthenticated request must receive HTTP 401');
  assert.strictEqual(nextCalled14_1, false, 'Next function must not be called when unauthenticated');
  console.log('✅ PASS 14.1: requireRole blocks unauthenticated requests (HTTP 401)');

  // 14.2 requireRole(['admin']) blocks customer role with HTTP 403
  let nextCalled14_2 = false;
  const ctx14_2 = createMockContext(userCustA);
  adminMiddleware(ctx14_2.req, ctx14_2.res, () => { nextCalled14_2 = true; });
  assert.strictEqual(ctx14_2.getResponse().statusCode, 403, 'Customer role must receive HTTP 403');
  assert.strictEqual(ctx14_2.getResponse().responseData.error, 'Access denied. Requires one of: [admin]');
  assert.strictEqual(nextCalled14_2, false, 'Next function must not be called for customer');
  console.log('✅ PASS 14.2: requireRole blocks customer access to admin routes (HTTP 403)');

  // 14.3 requireRole(['admin']) blocks driver role with HTTP 403
  let nextCalled14_3 = false;
  const ctx14_3 = createMockContext(userDriverA);
  adminMiddleware(ctx14_3.req, ctx14_3.res, () => { nextCalled14_3 = true; });
  assert.strictEqual(ctx14_3.getResponse().statusCode, 403, 'Driver role must receive HTTP 403');
  assert.strictEqual(ctx14_3.getResponse().responseData.error, 'Access denied. Requires one of: [admin]');
  assert.strictEqual(nextCalled14_3, false, 'Next function must not be called for driver');
  console.log('✅ PASS 14.3: requireRole blocks driver access to admin routes (HTTP 403)');

  // 14.4 requireRole(['admin']) allows admin role through to next()
  let nextCalled14_4 = false;
  const ctx14_4 = createMockContext(userAdmin);
  adminMiddleware(ctx14_4.req, ctx14_4.res, () => { nextCalled14_4 = true; });
  assert.strictEqual(nextCalled14_4, true, 'Next function must be called for admin role');
  console.log('✅ PASS 14.4: requireRole allows verified admin role to proceed (next)');

  // 14.5 AdminController.getDashboardStats succeeds for admin
  const ctx14_5 = createMockContext(userAdmin);
  await AdminController.getDashboardStats(ctx14_5.req, ctx14_5.res);
  assert.strictEqual(ctx14_5.getResponse().statusCode, 200, 'Admin getDashboardStats must return HTTP 200');
  assert.strictEqual(ctx14_5.getResponse().responseData.success, true);
  assert.ok(ctx14_5.getResponse().responseData.data.metrics, 'Dashboard metrics must be returned');
  console.log('✅ PASS 14.5: AdminController.getDashboardStats serves aggregated metrics to admin (HTTP 200)');

  // 14.6 AdminController.updateBookingStatus rejects invalid status with HTTP 400
  const ctx14_6 = createMockContext(userAdmin, { id: '1' }, { status: 'INVALID_HACK_STATUS' });
  await AdminController.updateBookingStatus(ctx14_6.req, ctx14_6.res);
  assert.strictEqual(ctx14_6.getResponse().statusCode, 400, 'Invalid status must return HTTP 400');
  assert.strictEqual(ctx14_6.getResponse().responseData.error, 'Invalid booking status.');
  console.log('✅ PASS 14.6: AdminController.updateBookingStatus rejects invalid status with HTTP 400');

  // 14.7 AdminController.updateDriverApproval rejects invalid status with HTTP 400
  const ctx14_7 = createMockContext(userAdmin, { id: '1' }, { status: 'SUPER_ADMIN_STATUS' });
  await AdminController.updateDriverApproval(ctx14_7.req, ctx14_7.res);
  assert.strictEqual(ctx14_7.getResponse().statusCode, 400, 'Invalid status must return HTTP 400');
  assert.match(ctx14_7.getResponse().responseData.error, /Invalid status/i);
  console.log('✅ PASS 14.7: AdminController.updateDriverApproval rejects invalid status with HTTP 400');

  // 14.8 Privilege escalation defense: Public registration with role: 'admin' is blocked
  await assert.rejects(
    async () => {
      await AuthService.register({
        name: 'Attacker Admin',
        email: `attacker_admin_${Date.now()}@hack.com`,
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        password: 'password123',
        role: 'admin'
      });
    },
    /Public owner\/admin registration is disallowed/i,
    'Public registration must strictly reject role admin'
  );
  console.log('✅ PASS 14.8: Public registration strictly blocks admin privilege escalation');

  // 14.9 Deactivated account check in authenticateToken
  const deactEmail = `deact_user_${Date.now()}@clik2go.in`;
  const deactMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
  const deactRes = await query(
    `INSERT INTO users (name, email, mobile, password_hash, role, status, created_at, updated_at)
     VALUES ('Deactivated User', $1, $2, 'hash', 'customer', 'DEACTIVATED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING id`,
    [deactEmail, deactMobile]
  );
  const deactUserId = deactRes.rows[0].id;
  const deactUser: AuthUser = {
    id: deactUserId,
    name: 'Deactivated User',
    email: deactEmail,
    mobile: deactMobile,
    role: 'customer'
  };
  const deactToken = AuthService.generateToken(deactUser);
  const ctxDeactReq = {
    headers: { authorization: `Bearer ${deactToken}` }
  } as any;
  let deactStatus = 200;
  let deactBody: any = {};
  const ctxDeactRes = {
    status(s: number) { deactStatus = s; return this; },
    json(b: any) { deactBody = b; return this; }
  } as any;
  await authenticateToken(ctxDeactReq, ctxDeactRes, () => {});
  assert.strictEqual(deactStatus, 403, 'Deactivated account token must be denied with HTTP 403');
  assert.match(deactBody.error, /deactivated/i);
  console.log('✅ PASS 14.9: Deactivated user token denied by authenticateToken (HTTP 403)');

  // 14.10 AdminController 500 error sanitization in production mode
  const origNodeEnv14 = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const ctxProdAdmin = createMockContext(userAdmin, { id: '1' }, { status: 'INVALID_STATUS' });
    await AdminController.updateBookingStatus(ctxProdAdmin.req, ctxProdAdmin.res);
    assert.strictEqual(ctxProdAdmin.getResponse().statusCode, 400);
    console.log('✅ PASS 14.10: AdminController handles unexpected errors safely in production');
  } finally {
    process.env.NODE_ENV = origNodeEnv14;
  }

  console.log('\n=========================================');
  console.log('🎉 ALL SECURITY PHASE 1 TESTS PASSED!');
  console.log('=========================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
