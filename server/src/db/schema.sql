-- Kk_Auto Relational PostgreSQL Schema (Fixed-Route 3-Role Auto Fare & Split Payment Architecture)

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  mobile VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  auto_number VARCHAR(50) NOT NULL,
  auto_model VARCHAR(100) NOT NULL DEFAULT 'Bajaj Compact 4S',
  license_number VARCHAR(100) NOT NULL DEFAULT 'DL-AUTO-2024-8899',
  availability_status VARCHAR(50) NOT NULL DEFAULT 'available',
  approval_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  payout_upi VARCHAR(100),
  cashfree_vendor_id VARCHAR(100),
  payout_bank_account VARCHAR(100),
  payout_ifsc VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS driver_push_subscriptions (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fare_routes (
  id SERIAL PRIMARY KEY,
  from_location VARCHAR(100) NOT NULL,
  to_location VARCHAR(100) NOT NULL,
  fare DOUBLE PRECISION NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_route UNIQUE (from_location, to_location)
);
-- GPS-based fare zones
CREATE TABLE IF NOT EXISTS fare_areas (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  boundary JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- Initial GPS fare zones
INSERT INTO fare_areas (name, boundary)
VALUES
(
  'Indiramma Colony',
  '[[78.7950714,13.6573957],[78.7942417,13.6532393],[78.7982757,13.6533366],[78.7983902,13.6574652],[78.7950714,13.6573957]]'
),
(
  'Beedi Colony',
  '[[78.8013199,13.6532114],[78.8015058,13.6547266],[78.7998035,13.654803],[78.7997248,13.6532878],[78.8013199,13.6532114]]'
),
(
  'Cross Road',
  '[[78.8031913,13.6529136],[78.8031127,13.6514123],[78.8039424,13.6513914],[78.8040353,13.6528858],[78.8031913,13.6529136]]'
),
(
  'Bus Stand',
  '[[78.8036255,13.6447949],[78.8039402,13.6470192],[78.8032357,13.6469618],[78.8032142,13.6448071],[78.8036255,13.6447949]]'
),
(
  'Marava',
  '[[78.799982,13.6402189],[78.8003432,13.6400747],[78.8018256,13.6413536],[78.8013428,13.6414701],[78.799982,13.6402189]]'
),
(
  'JNTUA Main Gate',
  '[[78.7851353,13.6510706],[78.7856717,13.6500975],[78.7868805,13.6506257],[78.7863012,13.6514251],[78.7851353,13.6510706]]'
),
(
  'JNTUA Girls Hostel',
  '[[78.7819546,13.6543736],[78.78223,13.6534839],[78.7846439,13.6540052],[78.7843793,13.6549852],[78.7819546,13.6543736]]'
),
(
  'JNTUA Boys Hostel',
  '[[78.7902277,13.6541918],[78.7901455,13.6548173],[78.7892621,13.6545219],[78.7894946,13.6538095],[78.7902277,13.6541918]]'
)
ON CONFLICT (name) DO NOTHING;

-- Fare between two GPS-based fare zones
CREATE TABLE IF NOT EXISTS area_fares (
  id SERIAL PRIMARY KEY,
  pickup_area_id INTEGER NOT NULL REFERENCES fare_areas(id) ON DELETE CASCADE,
  destination_area_id INTEGER NOT NULL REFERENCES fare_areas(id) ON DELETE CASCADE,
  fare DOUBLE PRECISION NOT NULL CHECK (fare >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_area_fare
    UNIQUE (pickup_area_id, destination_area_id)
);

CREATE INDEX IF NOT EXISTS idx_fare_areas_active
ON fare_areas(is_active);

CREATE INDEX IF NOT EXISTS idx_area_fares_pickup_destination
ON area_fares(pickup_area_id, destination_area_id);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  booking_reference VARCHAR(50) UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
  pickup_address VARCHAR(100) NOT NULL,
  destination_address VARCHAR(100) NOT NULL,
  pickup_area_name VARCHAR(100),
  destination_area_name VARCHAR(100),
  pickup_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  passengers INTEGER NOT NULL DEFAULT 1,
  estimated_fare DOUBLE PRECISION NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Searching for Auto',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_settings (
  key VARCHAR(100) PRIMARY KEY,
  value VARCHAR(255) NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
  total_amount DOUBLE PRECISION NOT NULL,
  driver_amount DOUBLE PRECISION NOT NULL,
  owner_amount DOUBLE PRECISION NOT NULL,
  commission_amount DOUBLE PRECISION NOT NULL,
  payment_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  settlement_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  payment_method VARCHAR(50) NOT NULL DEFAULT 'UPI',
  transaction_reference VARCHAR(100) UNIQUE,
  gateway_order_id VARCHAR(100),
  gateway_payment_id VARCHAR(100),
  settled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- Initial zone-to-zone fares
INSERT INTO area_fares (
  pickup_area_id,
  destination_area_id,
  fare
)
SELECT
  p.id,
  d.id,
  v.fare
FROM (
  VALUES
    ('Indiramma Colony', 'Cross Road', 10),
    ('Cross Road', 'Indiramma Colony', 10),

    ('Indiramma Colony', 'Bus Stand', 10),
    ('Bus Stand', 'Indiramma Colony', 10),

    ('Indiramma Colony', 'Marava', 22),
    ('Marava', 'Indiramma Colony', 22),

    ('JNTUA Main Gate', 'Cross Road', 30),
    ('Cross Road', 'JNTUA Main Gate', 30),

    ('JNTUA Girls Hostel', 'Cross Road', 50),
    ('Cross Road', 'JNTUA Girls Hostel', 50),

    ('JNTUA Girls Hostel', 'Bus Stand', 50),
    ('Bus Stand', 'JNTUA Girls Hostel', 50),

    ('JNTUA Main Gate', 'Bus Stand', 50),
    ('Bus Stand', 'JNTUA Main Gate', 50),

    ('JNTUA Boys Hostel', 'Cross Road', 30),
    ('Cross Road', 'JNTUA Boys Hostel', 30),

    ('JNTUA Boys Hostel', 'Bus Stand', 40),
    ('Bus Stand', 'JNTUA Boys Hostel', 40)
) AS v(pickup_name, destination_name, fare)
JOIN fare_areas p ON p.name = v.pickup_name
JOIN fare_areas d ON d.name = v.destination_name
ON CONFLICT (pickup_area_id, destination_area_id)
DO UPDATE SET
  fare = EXCLUDED.fare,
  updated_at = CURRENT_TIMESTAMP;
-- Idempotent column migrations for existing instances
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) NOT NULL DEFAULT 'PENDING';
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS payout_upi VARCHAR(100);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS payout_bank_account VARCHAR(100);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS payout_ifsc VARCHAR(50);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS cashfree_vendor_id VARCHAR(100);
ALTER TABLE fare_routes ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE drivers
SET cashfree_vendor_id = 'KKDRIVER001'
WHERE id = (
  SELECT d.id
  FROM drivers d
  JOIN users u ON u.id = d.user_id
  WHERE u.email = 'ramesh@kkauto.com'
  LIMIT 1
)
AND cashfree_vendor_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);
CREATE INDEX IF NOT EXISTS idx_bookings_ref ON bookings(booking_reference);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_driver ON bookings(driver_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_fare_routes_from_to ON fare_routes(from_location, to_location);
CREATE INDEX IF NOT EXISTS idx_drivers_approval ON drivers(approval_status);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_driver ON payments(driver_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_settlement ON payments(settlement_status);
CREATE INDEX IF NOT EXISTS idx_driver_push_subscriptions_driver
ON driver_push_subscriptions(driver_id);

-- Car / Outstation Trip Bookings (Separate from 3-wheeler Auto Bookings)
CREATE TABLE IF NOT EXISTS trip_bookings (
  id SERIAL PRIMARY KEY,
  booking_reference VARCHAR(50) UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(50) NOT NULL,
  members INTEGER NOT NULL CHECK (members > 0),
  trip_place VARCHAR(255) NOT NULL,
  days INTEGER NOT NULL CHECK (days > 0),
  trip_date VARCHAR(50) NOT NULL,
  pickup_time VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'NEW',
  quoted_price DOUBLE PRECISION,
  customer_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  customer_confirmed_at TIMESTAMP WITH TIME ZONE,
  payment_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  payment_reference VARCHAR(100),
  payment_method VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_trip_bookings_customer ON trip_bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_trip_bookings_ref ON trip_bookings(booking_reference);
CREATE INDEX IF NOT EXISTS idx_trip_bookings_status ON trip_bookings(status);
CREATE INDEX IF NOT EXISTS idx_trip_bookings_payment ON trip_bookings(payment_status);
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS pickup_area_name VARCHAR(100);

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS destination_area_name VARCHAR(100);