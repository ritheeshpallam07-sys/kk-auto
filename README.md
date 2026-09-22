# 🛺 Kk_Auto - Auto-Rickshaw Ride Booking Platform

> **Your ride, your way.**

**Kk_Auto** is a modern, responsive auto-rickshaw ride-booking web application built with a full-stack architecture featuring a **React + TypeScript + Tailwind CSS** frontend, a **Node.js / Express REST API** backend, and a relational **PostgreSQL** database architecture.

---

## 🚀 Key Features

### 1. Customer Experience
- **Landing Page**: Modern hero section, quick fare estimation calculator, 4-step *How It Works* guide, customer benefits, and responsive navigation.
- **Registration & Authentication**: Secure registration with password strength meter, duplicate email/mobile protection, and bcrypt hashing.
- **Polished 6-Step Booking**:
  1. Pickup location (*From*) with instant autocomplete suggestions.
  2. Destination (*To*) with instant autocomplete suggestions.
  3. Pickup Time (*Ride Now* vs. *Schedule Ride* with date & time selection; past times prevented).
  4. Number of Passengers (*1 to 4 auto-rickshaw capacity*).
  5. Server-side Fare Calculation (*Base Fare ₹30, Per-km ₹15, Minimum ₹50*).
  6. Instant Booking creation with unique alphanumeric reference (e.g., `KK-104821`).
- **Live Ride Tracking & Status**: Status progression through `Searching for Auto` → `Driver Assigned` → `Driver Arriving` → `Ride Started` → `Ride Completed`.
- **Assigned Driver Card**: Displays driver name, auto registration number (e.g., `KA-01-AK-1984`), vehicle model, and one-tap calling.
- **Booking Cancellation**: Cancellations with confirmation dialogs (locked once rides are completed).
- **Ride History (My Rides)**: Filter by *All*, *Active*, *Completed*, or *Cancelled* with detailed route inspection.

### 2. Driver Experience (`/driver`)
- **Driver Profile**: View verified vehicle registration number, auto model, and license data.
- **Availability Toggle**: Switch between `Available` (Online) and `Offline`.
- **Live Ride Requests Queue**: View incoming ride requests with customer pickup, destination, distance, and fare; accept or dismiss requests.
- **Ride Lifecycle Controller**: Step-by-step progress updates: `Driver Arriving` → `Ride Started` → `Ride Completed`.

### 3. Administrator Console (`/admin`)
- **Real-Time Fleet & Ride Metrics**: Total customers, total drivers, total bookings, active rides, completed rides, cancelled rides, and estimated revenue.
- **Dynamic Fare Configuration**: Live adjustment of Base Fare (₹), Per-Km Rate (₹), Minimum Fare (₹), Waiting Charges, and Surge Multipliers directly from the dashboard without application restarts.
- **Comprehensive Bookings Table**: Search, filter, inspect, and override booking statuses.

---

## 🛠 Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite
- **Backend**: Node.js, Express, TypeScript, REST APIs, JWT, bcryptjs
- **Database**: PostgreSQL relational schema (`users`, `drivers`, `bookings`, `fare_config`)
  - **Dual Engine**: Connects to standard PostgreSQL via `pg` when `DATABASE_URL` is set, or automatically boots embedded persistent PGlite (WASM Postgres) with zero configuration!
- **Mapping & Routing**: Modular service abstractions (`LocationService`, `MapService`, `FareService`) with interactive route simulation and pluggable hooks for Google Maps & Mapbox.

---

## 🔑 Pre-Seeded Demo Accounts

For instant testing and evaluation, the database is pre-seeded with:

| Role | Email | Password | Mobile | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Customer** | `rahul@gmail.com` | `customer123` | `9876543213` | Has past and active bookings |
| **Driver** | `ramesh@kkauto.com` | `driver123` | `9876543211` | Auto: `KA-01-AK-1984` (Bajaj RE) |
| **Admin** | `admin@kkauto.com` | `admin123` | `9876543210` | Full platform control |

*(You can also use the 1-Click fast login buttons on the `/login` page)*

---

## 💻 Running the Application

### 1. Install & Build
```bash
# In the project root
npm run build
```

### 2. Start the Application
```bash
# Starts the server on port 5000 (serves both API and production React frontend)
npm start
```
Open **http://localhost:5000** in your browser.

### 3. Development Mode (Optional)
```bash
# In one terminal:
npm run dev:server    # Backend on http://localhost:5000

# In a second terminal:
npm run dev:client    # Vite dev server on http://localhost:5173
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env`:

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your_secure_jwt_secret_key

# Optional PostgreSQL Connection (if omitted, embedded PGlite is used automatically):
# DATABASE_URL=postgresql://user:password@localhost:5432/kk_auto

# Optional Map Integrations:
# GOOGLE_MAPS_API_KEY=AIzaSy...
# MAPBOX_ACCESS_TOKEN=pk.eyJ1...
```
