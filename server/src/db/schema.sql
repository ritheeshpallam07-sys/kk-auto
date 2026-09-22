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
  payout_bank_account VARCHAR(100),
  payout_ifsc VARCHAR(50),
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

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  booking_reference VARCHAR(50) UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
  pickup_address VARCHAR(100) NOT NULL,
  destination_address VARCHAR(100) NOT NULL,
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

-- Idempotent column migrations for existing instances
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) NOT NULL DEFAULT 'PENDING';
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS payout_upi VARCHAR(100);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS payout_bank_account VARCHAR(100);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS payout_ifsc VARCHAR(50);
ALTER TABLE fare_routes ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

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
