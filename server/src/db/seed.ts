import { query, initDb } from '../config/db';
import { AuthService } from '../services/authService';

/**
 * Essential platform defaults (settings, locations, fixed routes).
 * Uses strictly ON CONFLICT DO NOTHING to ensure existing custom prices,
 * commissions, and route statuses are never overwritten.
 * Safe to execute during every server startup in both production and development.
 */
export async function initPlatformDefaults() {
  console.log('[Bootstrap] Ensuring essential platform defaults exist...');

  // 1. Platform Settings - default fixed commission of 5.0 (preserve existing custom settings)
  await query(
    `INSERT INTO platform_settings (key, value, description, updated_at)
     VALUES ('owner_commission_fixed', '5.0', 'Fixed platform commission retained by owner per completed auto trip', CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO NOTHING`
  );

  // Support contact defaults (supportclik2go@gmail.com is official, phone/WhatsApp require verified config)
  await query(
    `INSERT INTO platform_settings (key, value, description, updated_at)
     VALUES 
       ('support_email', 'supportclik2go@gmail.com', 'Official Clik2Go customer & driver support email', CURRENT_TIMESTAMP),
       ('support_phone', '', 'Configured support helpline phone number (leave empty if not configured)', CURRENT_TIMESTAMP),
       ('support_whatsapp', '', 'Configured support WhatsApp number (leave empty if not configured)', CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO NOTHING`
  );

  // Safely update legacy default support email to the new official support address without touching custom overrides
  await query(
    `UPDATE platform_settings
     SET value = 'supportclik2go@gmail.com', updated_at = CURRENT_TIMESTAMP
     WHERE key = 'support_email' AND value = 'support@clik2go.in'`
  );

  // 2. Locations - canonical approved fare zones with coordinates
  const canonicalZones = [
    { name: 'JNTUA', lat: 13.6508, lng: 78.7860, radius: 1200 },
    { name: 'Cross', lat: 13.6525, lng: 78.8035, radius: 900 },
    { name: 'Bus Stand', lat: 13.6455, lng: 78.8035, radius: 1000 },
    { name: 'Marava', lat: 13.6408, lng: 78.8010, radius: 1000 },
    { name: 'Indiramma Colony', lat: 13.6550, lng: 78.7960, radius: 800 }
  ];
  for (const z of canonicalZones) {
    await query(
      `INSERT INTO locations (name, latitude, longitude, radius_meters)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE
       SET latitude = COALESCE(locations.latitude, EXCLUDED.latitude),
           longitude = COALESCE(locations.longitude, EXCLUDED.longitude),
           radius_meters = COALESCE(locations.radius_meters, EXCLUDED.radius_meters)`,
      [z.name, z.lat, z.lng, z.radius]
    );
  }

  // Remove any legacy/incorrect mapping of Indiramma Colony pointing to Cross
  const crossLoc = await query<{ id: number }>('SELECT id FROM locations WHERE name = $1 LIMIT 1', ['Cross']);
  if (crossLoc.rows.length > 0) {
    await query(
      `DELETE FROM location_aliases
       WHERE LOWER(TRIM(alias)) = 'indiramma colony' AND location_id = $1`,
      [crossLoc.rows[0].id]
    );
  }

  // 2b. Location / Fare Zone Aliases (Maps multiple Google Places suggestions to canonical zones)
  const zoneAliases: Record<string, string[]> = {
    'Cross': [
      'Cross',
      'Cross Road',
      'Cross Road Apollo',
      'Apollo Cross Road',
      'Apollo Pharmacy Cross',
      'Apollo Pharmacy, Cross Road',
      'Cross Circle',
      'Cross Junction',
      'Madanapalle Cross',
      'Madanapalle Cross Road',
      'Cross Center'
    ],
    'Indiramma Colony': [
      'Indiramma Colony',
      'Indiramma Colony Circle',
      'Indiramma Colony Madanapalle'
    ],
    'JNTUA': [
      'JNTUA',
      'JNTU',
      'JNTU-A',
      'JNTUA Main Gate',
      'JNTUA Girls Hostel',
      'JNTUA Boys Hostel',
      'JNTU College of Engineering',
      'JNTUA College',
      'JNTU Engineering College',
      'JNTUA College of Engineering, Pulivendula Road'
    ],
    'Bus Stand': [
      'Bus Stand',
      'APSRTC Bus Stand',
      'RTC Bus Stand',
      'Old Bus Stand',
      'New Bus Stand',
      'Bus Station',
      'Madanapalle Bus Stand',
      'RTC Bus Station'
    ],
    'Marava': [
      'Marava',
      'Marava Circle',
      'Marava Junction',
      'Marava Road',
      'Marava Gate',
      'Marava Bus Stop'
    ]
  };

  for (const [zoneName, aliases] of Object.entries(zoneAliases)) {
    const locRes = await query<{ id: number }>('SELECT id FROM locations WHERE name = $1 LIMIT 1', [zoneName]);
    if (locRes.rows.length > 0) {
      const locId = locRes.rows[0].id;
      for (const alias of aliases) {
        await query(
          `INSERT INTO location_aliases (location_id, alias)
           VALUES ($1, $2)
           ON CONFLICT (location_id, alias) DO NOTHING`,
          [locId, alias]
        );
      }
    }
  }

  // 3. Authorized Fixed Routes - insert missing routes only; preserve existing prices and statuses
  const routes = [
    { from: 'JNTUA', to: 'Cross', fare: 20.0 },
    { from: 'Cross', to: 'JNTUA', fare: 20.0 },
    { from: 'JNTUA', to: 'Bus Stand', fare: 25.0 },
    { from: 'Bus Stand', to: 'JNTUA', fare: 25.0 },
    { from: 'JNTUA', to: 'Marava', fare: 30.0 },
    { from: 'Marava', to: 'JNTUA', fare: 30.0 },
    { from: 'Indiramma Colony', to: 'Cross', fare: 10.0 },
    { from: 'Cross', to: 'Indiramma Colony', fare: 10.0 },
    { from: 'Indiramma Colony', to: 'Bus Stand', fare: 10.0 },
    { from: 'Bus Stand', to: 'Indiramma Colony', fare: 10.0 },
    { from: 'Indiramma Colony', to: 'Marava', fare: 22.0 },
    { from: 'Marava', to: 'Indiramma Colony', fare: 22.0 }
  ];

  for (const r of routes) {
    const l1 = await query<{ id: number }>('SELECT id FROM locations WHERE name = $1 LIMIT 1', [r.from]);
    const l2 = await query<{ id: number }>('SELECT id FROM locations WHERE name = $1 LIMIT 1', [r.to]);
    const fromId = l1.rows[0]?.id;
    const toId = l2.rows[0]?.id;

    await query(
      `INSERT INTO fare_routes (from_location, to_location, fare, is_active, updated_at, from_location_id, to_location_id)
       VALUES ($1, $2, $3, TRUE, CURRENT_TIMESTAMP, $4, $5)
       ON CONFLICT (from_location, to_location) DO NOTHING`,
      [r.from, r.to, r.fare, fromId, toId]
    );
  }

  // Backfill canonical IDs for any existing routes
  await query(
    `UPDATE fare_routes
     SET from_location_id = l1.id,
         to_location_id = l2.id
     FROM locations l1, locations l2
     WHERE LOWER(TRIM(fare_routes.from_location)) = LOWER(TRIM(l1.name))
       AND LOWER(TRIM(fare_routes.to_location)) = LOWER(TRIM(l2.name))
       AND (fare_routes.from_location_id IS NULL OR fare_routes.to_location_id IS NULL
            OR fare_routes.from_location_id != l1.id OR fare_routes.to_location_id != l2.id)`
  );

  // Link fare_areas to canonical locations where applicable
  await query(
    `UPDATE fare_areas
     SET location_id = l.id
     FROM locations l
     WHERE (fare_areas.location_id IS NULL OR LOWER(fare_areas.name) = 'indiramma colony')
       AND (
         (LOWER(fare_areas.name) = 'cross road' AND LOWER(l.name) = 'cross')
         OR (LOWER(fare_areas.name) LIKE '%jntua%' AND LOWER(l.name) = 'jntua')
         OR (LOWER(fare_areas.name) = 'bus stand' AND LOWER(l.name) = 'bus stand')
         OR (LOWER(fare_areas.name) = 'marava' AND LOWER(l.name) = 'marava')
         OR (LOWER(fare_areas.name) = 'indiramma colony' AND LOWER(l.name) = 'indiramma colony')
       )`
  );

  console.log('[Bootstrap] Essential platform defaults verified.');
}

export async function runSeed() {
  console.log('[Seed] Initializing database schema...');
  await initDb();
  await initPlatformDefaults();

  // Strict production safeguard: Never seed demo accounts, mock rides, or reset credentials in production
  if (process.env.NODE_ENV === 'production') {
    console.log('[Seed] Production environment detected: Demo accounts, test data cleaning, and credential resets are strictly disabled.');
    return;
  }

  // Guard against destructive flags in production or unless explicitly configured
  if (process.env.UPDATE_ADMIN_CREDENTIALS === 'true') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SECURITY VIOLATION: UPDATE_ADMIN_CREDENTIALS cannot be run in production.');
    }
    console.log('[Seed] Updating admin credentials...');

    const adminHash = await AuthService.hashPassword('@Kumar_00');

    await query(
      `UPDATE users
       SET email = $1,
           password_hash = $2
       WHERE role = 'admin'`,
      ['kumar@auto.com', adminHash]
    );

    console.log('[Seed] Admin credentials updated.');
  }

  if (process.env.CLEAN_TEST_DATA === 'true') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SECURITY VIOLATION: CLEAN_TEST_DATA cannot be run in production.');
    }
    console.log('[Seed] Cleaning test users and dependent test data...');

    await query(
      `DELETE FROM users
       WHERE role <> 'admin'`
    );

    console.log('[Seed] Test users and dependent test data cleaned.');
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
    const adminHash = await AuthService.hashPassword('@Kumar_00');
    const adminRes = await query(
      `INSERT INTO users (name, email, mobile, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin') RETURNING id`,
      ['Kk_Auto Admin', 'kumar@auto.com', '9876543210', adminHash]
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
  `INSERT INTO drivers (
    user_id, auto_number, auto_model, license_number,
    availability_status, approval_status, payout_upi, cashfree_vendor_id,
    payout_bank_account, payout_ifsc
  )
   VALUES ($1, $2, $3, $4, 'available', 'APPROVED', 'ramesh@oksbi', NULL, '302910482910', 'SBIN0001234') RETURNING id`,
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
