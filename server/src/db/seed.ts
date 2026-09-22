import { query, initDb } from '../config/db';
import { AuthService } from '../services/authService';

export async function runSeed() {
  console.log('[Seed] Initializing database schema...');
  await initDb();

  // Always ensure platform settings exist
  await query(
    `INSERT INTO platform_settings (key, value, description, updated_at)
     VALUES ('owner_commission_fixed', '5.0', 'Fixed platform commission retained by owner per completed auto trip', CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
  );

  console.log('[Seed] Seeding fixed locations...');
  const locations = ['JNTUA', 'Cross', 'Bus Stand', 'Marava'];
  for (const loc of locations) {
    await query('INSERT INTO locations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [loc]);
  }

  console.log('[Seed] Seeding authorized fixed routes...');
  // Exact 6 routes:
  // JNTUA -> Cross = ₹20, Cross -> JNTUA = ₹20
  // JNTUA -> Bus Stand = ₹25, Bus Stand -> JNTUA = ₹25
  // JNTUA -> Marava = ₹30, Marava -> JNTUA = ₹30
  const routes = [
    { from: 'JNTUA', to: 'Cross', fare: 20.0 },
    { from: 'Cross', to: 'JNTUA', fare: 20.0 },
    { from: 'JNTUA', to: 'Bus Stand', fare: 25.0 },
    { from: 'Bus Stand', to: 'JNTUA', fare: 25.0 },
    { from: 'JNTUA', to: 'Marava', fare: 30.0 },
    { from: 'Marava', to: 'JNTUA', fare: 30.0 }
  ];

  for (const r of routes) {
    await query(
      `INSERT INTO fare_routes (from_location, to_location, fare, is_active, updated_at)
       VALUES ($1, $2, $3, TRUE, CURRENT_TIMESTAMP)
       ON CONFLICT (from_location, to_location) DO UPDATE SET fare = EXCLUDED.fare, is_active = TRUE`,
      [r.from, r.to, r.fare]
    );
  }

  // Check if users already seeded
  const existing = await query('SELECT COUNT(*) as count FROM users');
  const userCount = parseInt(existing.rows[0].count, 10);

  let adminId: number;
  let driver1Id: number;
  let driver2Id: number;
  let driver3PendingId: number;
  let customerId: number;
  let customer2Id: number;

  if (userCount === 0) {
    console.log('[Seed] Seeding sample users...');

    // 1. Admin User
    const adminHash = await AuthService.hashPassword('admin123');
    const adminRes = await query(
      `INSERT INTO users (name, email, mobile, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin') RETURNING id`,
      ['Kk_Auto Admin', 'admin@kkauto.com', '9876543210', adminHash]
    );
    adminId = adminRes.rows[0].id;

    // 2. Driver 1 - Ramesh Kumar (Approved)
    const driverHash = await AuthService.hashPassword('driver123');
    const d1UserRes = await query(
      `INSERT INTO users (name, email, mobile, password_hash, role)
       VALUES ($1, $2, $3, $4, 'driver') RETURNING id`,
      ['Ramesh Kumar', 'ramesh@kkauto.com', '9876543211', driverHash]
    );
    const d1UserId = d1UserRes.rows[0].id;
    const d1Res = await query(
      `INSERT INTO drivers (user_id, auto_number, auto_model, license_number, availability_status, approval_status, payout_upi, payout_bank_account, payout_ifsc)
       VALUES ($1, $2, $3, $4, 'available', 'APPROVED', 'ramesh@oksbi', '302910482910', 'SBIN0001234') RETURNING id`,
      [d1UserId, 'KA-01-AK-1984', 'Bajaj RE 4S CNG', 'DL-KA-2018-009871']
    );
    driver1Id = d1Res.rows[0].id;

    // 3. Driver 2 - Suresh Gowda (Approved)
    const d2UserRes = await query(
      `INSERT INTO users (name, email, mobile, password_hash, role)
       VALUES ($1, $2, $3, $4, 'driver') RETURNING id`,
      ['Suresh Gowda', 'suresh@kkauto.com', '9876543212', driverHash]
    );
    const d2UserId = d2UserRes.rows[0].id;
    const d2Res = await query(
      `INSERT INTO drivers (user_id, auto_number, auto_model, license_number, availability_status, approval_status, payout_upi, payout_bank_account, payout_ifsc)
       VALUES ($1, $2, $3, $4, 'available', 'APPROVED', 'suresh@upi', '492019482019', 'HDFC0000456') RETURNING id`,
      [d2UserId, 'KA-04-MZ-4022', 'Piaggio Ape City NXT', 'DL-KA-2020-004312']
    );
    driver2Id = d2Res.rows[0].id;

    // 4. Driver 3 - Venkatesh Rao (Pending approval)
    const d3UserRes = await query(
      `INSERT INTO users (name, email, mobile, password_hash, role)
       VALUES ($1, $2, $3, $4, 'driver') RETURNING id`,
      ['Venkatesh Rao', 'venkat@kkauto.com', '9876543215', driverHash]
    );
    const d3UserId = d3UserRes.rows[0].id;
    const d3Res = await query(
      `INSERT INTO drivers (user_id, auto_number, auto_model, license_number, availability_status, approval_status, payout_upi, payout_bank_account, payout_ifsc)
       VALUES ($1, $2, $3, $4, 'available', 'PENDING', 'venkat@apl', '552019482088', 'ICIC0000789') RETURNING id`,
      [d3UserId, 'KA-05-AB-7890', 'Bajaj Maxima Z Electric', 'DL-KA-2022-005678']
    );
    driver3PendingId = d3Res.rows[0].id;

    // 5. Customer 1 - Rahul Sharma
    const customerHash = await AuthService.hashPassword('customer123');
    const customerRes = await query(
      `INSERT INTO users (name, email, mobile, password_hash, role)
       VALUES ($1, $2, $3, $4, 'customer') RETURNING id`,
      ['Rahul Sharma', 'rahul@gmail.com', '9876543213', customerHash]
    );
    customerId = customerRes.rows[0].id;

    // 6. Customer 2 - Priya Patel
    const customer2Res = await query(
      `INSERT INTO users (name, email, mobile, password_hash, role)
       VALUES ($1, $2, $3, $4, 'customer') RETURNING id`,
      ['Priya Patel', 'priya@gmail.com', '9876543214', customerHash]
    );
    customer2Id = customer2Res.rows[0].id;

    console.log('[Seed] Seeding sample rides on authorized fixed routes...');

    // Completed ride 1: JNTUA -> Cross (₹20)
    const b1 = await query(
      `INSERT INTO bookings (
        booking_reference, customer_id, driver_id, pickup_address, destination_address,
        pickup_datetime, passengers, estimated_fare, status, created_at
      ) VALUES (
        'KK-104821', $1, $2, 'JNTUA', 'Cross',
        NOW() - INTERVAL '2 days', 2, 20.0, 'Ride Completed', NOW() - INTERVAL '2 days'
      ) RETURNING id`,
      [customerId, driver1Id]
    );

    // Completed ride 2: Bus Stand -> JNTUA (₹25)
    const b2 = await query(
      `INSERT INTO bookings (
        booking_reference, customer_id, driver_id, pickup_address, destination_address,
        pickup_datetime, passengers, estimated_fare, status, created_at
      ) VALUES (
        'KK-284912', $1, $2, 'Bus Stand', 'JNTUA',
        NOW() - INTERVAL '1 day', 1, 25.0, 'Ride Completed', NOW() - INTERVAL '1 day'
      ) RETURNING id`,
      [customer2Id, driver2Id]
    );

    // Active ride: JNTUA -> Marava (₹30)
    await query(
      `INSERT INTO bookings (
        booking_reference, customer_id, driver_id, pickup_address, destination_address,
        pickup_datetime, passengers, estimated_fare, status, created_at
      ) VALUES (
        'KK-592031', $1, $2, 'JNTUA', 'Marava',
        NOW() + INTERVAL '30 minutes', 3, 30.0, 'Driver Assigned', NOW() - INTERVAL '10 minutes'
      )`,
      [customerId, driver1Id]
    );

    // Incoming ride: Cross -> JNTUA (₹20)
    await query(
      `INSERT INTO bookings (
        booking_reference, customer_id, pickup_address, destination_address,
        pickup_datetime, passengers, estimated_fare, status, created_at
      ) VALUES (
        'KK-930214', $1, 'Cross', 'JNTUA',
        NOW() + INTERVAL '1 hour', 2, 20.0, 'Searching for Auto', NOW() - INTERVAL '5 minutes'
      )`,
      [customer2Id]
    );

    // Cancelled ride: JNTUA -> Bus Stand (₹25)
    await query(
      `INSERT INTO bookings (
        booking_reference, customer_id, pickup_address, destination_address,
        pickup_datetime, passengers, estimated_fare, status, created_at
      ) VALUES (
        'KK-401923', $1, 'JNTUA', 'Bus Stand',
        NOW() - INTERVAL '3 hours', 1, 25.0, 'Cancelled', NOW() - INTERVAL '3 hours'
      )`,
      [customerId]
    );

    // Seed Marketplace Payments for completed rides
    console.log('[Seed] Seeding marketplace split payments...');
    // Payment 1: ₹20 -> Driver ₹15, Owner ₹5 (SETTLED)
    await query(
      `INSERT INTO payments (
        booking_id, customer_id, driver_id, total_amount, driver_amount, owner_amount, commission_amount,
        payment_status, settlement_status, payment_method, transaction_reference, gateway_order_id,
        gateway_payment_id, settled_at, created_at
      ) VALUES (
        $1, $2, $3, 20.0, 15.0, 5.0, 5.0,
        'COMPLETED', 'SETTLED', 'UPI', 'TXN_KK_918231', 'ORDER_KK_819201', 'PAY_KK_291024',
        NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 days'
      )`,
      [b1.rows[0].id, customerId, driver1Id]
    );

    // Payment 2: ₹25 -> Driver ₹20, Owner ₹5 (PENDING SETTLEMENT)
    await query(
      `INSERT INTO payments (
        booking_id, customer_id, driver_id, total_amount, driver_amount, owner_amount, commission_amount,
        payment_status, settlement_status, payment_method, transaction_reference, gateway_order_id,
        gateway_payment_id, created_at
      ) VALUES (
        $1, $2, $3, 25.0, 20.0, 5.0, 5.0,
        'COMPLETED', 'PENDING', 'UPI', 'TXN_KK_381920', 'ORDER_KK_192834', 'PAY_KK_482910',
        NOW() - INTERVAL '1 day'
      )`,
      [b2.rows[0].id, customer2Id, driver2Id]
    );

    // Seed Driver Rating for ride 1
    await query(
      `INSERT INTO ratings (booking_id, customer_id, driver_id, rating, review, created_at)
       VALUES ($1, $2, $3, 5, 'Smooth ride and polite auto driver. Exact fixed fare charged!', NOW() - INTERVAL '2 days')`,
      [b1.rows[0].id, customerId, driver1Id]
    );
  } else {
    // Make sure existing drivers have approval_status and payout details populated
    await query(
      `UPDATE drivers SET 
         approval_status = COALESCE(approval_status, 'APPROVED'),
         payout_upi = COALESCE(payout_upi, 'ramesh@oksbi'),
         payout_bank_account = COALESCE(payout_bank_account, '302910482910'),
         payout_ifsc = COALESCE(payout_ifsc, 'SBIN0001234')
       WHERE approval_status IS NULL OR payout_upi IS NULL`
    );

    // Check if we have at least one PENDING driver for admin approval testing
    const pendingCheck = await query(`SELECT id FROM drivers WHERE approval_status = 'PENDING' LIMIT 1`);
    if (pendingCheck.rows.length === 0) {
      const driverHash = await AuthService.hashPassword('driver123');
      const d3User = await query(
        `INSERT INTO users (name, email, mobile, password_hash, role)
         VALUES ('Venkatesh Rao', 'venkat@kkauto.com', '9876543215', $1, 'driver')
         ON CONFLICT (email) DO UPDATE SET role = 'driver' RETURNING id`,
        [driverHash]
      );
      await query(
        `INSERT INTO drivers (user_id, auto_number, auto_model, license_number, availability_status, approval_status, payout_upi, payout_bank_account, payout_ifsc)
         VALUES ($1, 'KA-05-AB-7890', 'Bajaj Maxima Z Electric', 'DL-KA-2022-005678', 'available', 'PENDING', 'venkat@apl', '552019482088', 'ICIC0000789')
         ON CONFLICT DO NOTHING`,
        [d3User.rows[0].id]
      );
    }
  }

  console.log('[Seed] Database seeded successfully with fixed routes, users, split payments, and driver records!');
}

if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[Seed Error]', err);
      process.exit(1);
    });
}
