# Clik2Go Mobile App (Flutter)

A high-performance, cross-platform mobile application for **Clik2Go (Kk_Auto)** built with **Flutter & Dart**, featuring a **Black + Yellow** theme.

---

## 🎨 Theme & Color Palette

Designed specifically for Kadiri auto rickshaw services with high-contrast night visibility:

| Element | Color Hex | Preview / Usage |
| :--- | :--- | :--- |
| **Primary Background** | `#080B10` | Immersive dark OLED canvas |
| **Cards & Surfaces** | `#111722` | Elevated cards, forms, modals |
| **Card Highlight** | `#161F2E` | Secondary elevated surfaces & inputs |
| **Accent Yellow** | `#FFD400` | Primary buttons, active tabs, brand badges |
| **Accent Glow** | `#FFE033` | Focus states, selection chips |
| **Text Primary** | `#FFFFFF` | Headings, essential labels |
| **Text Secondary** | `#8E9BAE` | Subtitles, timestamps, metadata |
| **Success Green** | `#10B981` | Paid status, completed rides, online indicator |
| **Warning Orange** | `#F59E0B` | Cash on delivery, pending driver approval |
| **Error / Cancel Red** | `#EF4444` | Cancel ride, danger actions |

---

## 📱 Implemented Mobile Screens

1. **Splash Screen** (`splash_screen.dart`):
   - Animated launch with Clik2Go auto emblem and pulsing glow.
   - Automatic token restoration and role-based redirect (`/home`, `/driver`, `/admin`).

2. **Login Screen** (`login_screen.dart`):
   - Multi-role tabs: **Customer**, **Driver Partner**, and **Admin / Owner**.
   - Email/Phone identifier and password authentication.
   - Backend URL configuration shortcut.

3. **Registration Screen** (`register_screen.dart`):
   - Customer and Driver Partner sign-up.
   - Driver registration collects Auto Registration Plate, Vehicle Model, and Driving License.

4. **Email OTP Verification** (`verify_otp_screen.dart`):
   - 6-digit email security verification code input.
   - Instant verification and auto-login.

5. **Customer Home Screen** (`home_screen.dart`):
   - Live banner for active ongoing rides with 1-tap "Track Ride".
   - City Auto Booking and Outstation Trip Booking cards.
   - Quick-select route chips for Kadiri (Bus Stand, JNTUA, Cross, Marava).
   - Bottom navigation bar.

6. **Booking Screen** (`booking_screen.dart`):
   - Pickup & Destination search with Google Maps address suggestions.
   - Passenger count selector (1 to 4 passengers) with dynamic fare multiplication.
   - Real-time backend fare estimation querying Admin-configured routes.
   - Instant booking dispatch to nearby Kadiri drivers.

7. **Ride Tracking Screen** (`ride_tracking_screen.dart`):
   - 5-step visual ride progression tracker (`RideStepper`).
   - Dynamic map preview card (`MapPreviewCard`).
   - Assigned driver card with vehicle number, model, and direct phone call button.
   - Cashfree payment sheet for completed rides.
   - Post-ride driver rating modal (1 to 5 stars + review).
   - Ride cancellation with confirmation dialog.

8. **My Rides Screen** (`my_rides_screen.dart`):
   - Tabbed history: **All**, **Active**, **Completed**, and **Cancelled**.
   - Detailed trip receipts with invoice amounts, route endpoints, and driver names.
   - 1-tap "Book Again" shortcut.

9. **Driver Dashboard** (`driver_dashboard_screen.dart`):
   - Real-time **ONLINE / OFFLINE** toggle switch updating driver availability.
   - Today's earnings counter, completed rides, and pending settlement balances.
   - Active ongoing ride controller with Google Maps turn-by-turn navigation link.
   - Ride lifecycle progression buttons: "On Way to Pickup" ➔ "Ride Started" ➔ "Ride Completed".
   - Incoming ride requests queue with 1-tap "Accept Ride".

10. **Admin Console** (`admin_dashboard_screen.dart`):
    - **Overview**: Operational metrics, total platform revenue, and Cashfree settlement volumes.
    - **Driver Approvals**: Partner verification queue with Approve / Suspend / Reject actions.
    - **Payout Settlements**: Driver pending balances with instant "Settle" execution.
    - **Routes & Fares**: Live management of fixed route fares (Bus Stand, JNTUA, Cross, Marava) with enable/disable switches and fare editor.
    - **Bookings Log**: Real-time cross-platform ride monitor.

11. **Profile Screen** (`profile_screen.dart`):
    - Account badge, email, phone, and role indicators.
    - Driver vehicle and license details.
    - Backend API URL configuration switcher.
    - Secure sign-out with confirmation modal.

---

## 🏗️ Folder Structure

```
mobile_app/
├── lib/
│   ├── main.dart                      # Application entrypoint & route management
│   ├── models/
│   │   ├── admin_stats.dart           # AdminMetrics, PlatformFinancials, FareRoute
│   │   ├── booking.dart               # Full booking model with status helpers
│   │   ├── driver_profile.dart        # DriverProfile & DriverEarningsSummary
│   │   ├── fare_estimate.dart         # Fare estimate response model
│   │   ├── trip_booking.dart          # Outstation trip booking model
│   │   └── user.dart                  # User session profile model
│   ├── screens/
│   │   ├── admin_dashboard_screen.dart# Admin control center
│   │   ├── booking_screen.dart        # City auto booking & route selection
│   │   ├── driver_dashboard_screen.dart# Driver partner management & requests
│   │   ├── home_screen.dart           # Customer home dashboard
│   │   ├── login_screen.dart          # Role-based login screen
│   │   ├── my_rides_screen.dart       # Ride history with filter tabs
│   │   ├── profile_screen.dart        # User profile & server settings
│   │   ├── register_screen.dart       # Customer & Driver sign-up
│   │   ├── ride_tracking_screen.dart  # Live tracking & Cashfree checkout
│   │   ├── splash_screen.dart         # Brand splash & auto-login
│   │   └── verify_otp_screen.dart     # 6-digit email OTP verification
│   ├── services/
│   │   ├── api_service.dart           # Full HTTP REST client matching Express backend
│   │   └── auth_state.dart            # ChangeNotifier singleton session manager
│   ├── theme/
│   │   ├── app_colors.dart            # Black + Yellow palette constants
│   │   └── app_theme.dart             # Dark ThemeData specification
│   └── widgets/
│       ├── cashfree_sheet.dart        # Payment bottom sheet with UPI/Card/Cash
│       ├── custom_button.dart         # Yellow primary, outline & danger buttons
│       ├── custom_text_field.dart     # High-contrast inputs with yellow focus
│       ├── map_preview_card.dart      # Vector route map with GPS pins
│       ├── metric_card.dart           # High-visibility analytics counters
│       ├── ride_stepper.dart          # 5-step horizontal progression bar
│       └── status_badge.dart          # Pill status badge with role colors
├── pubspec.yaml                       # Dependencies: http, shared_preferences, intl, url_launcher
└── README.md                          # Documentation & setup guide
```

---

## 🚀 How to Run the Mobile App

### Step 1: Install Flutter SDK (if not already installed)
1. Download Flutter SDK for Windows from [flutter.dev](https://docs.flutter.dev/get-started/install/windows/mobile).
2. Extract the zip file (e.g., to `C:\src\flutter`).
3. Add `C:\src\flutter\bin` to your Windows **User Environment PATH**.
4. Verify the installation in PowerShell:
   ```powershell
   flutter doctor
   ```

### Step 2: Start the Clik2Go Backend Server
In a separate terminal, launch the Express backend:
```powershell
npm --prefix server run dev
```
The backend will run at `http://localhost:5000/api`.

### Step 3: Install Flutter Dependencies
Navigate into the `mobile_app` directory:
```powershell
cd mobile_app
flutter pub get
```

### Step 4: Configure Backend IP for Your Device
The Flutter app automatically handles different environments:
- **Android Emulator**: Uses `http://10.0.2.2:5000/api` (default for emulators).
- **Chrome / Web**: Uses `http://localhost:5000/api`.
- **Physical Android / iOS Phone**: Connect phone to the same Wi-Fi as your PC, then update the API URL via the in-app settings dialog on the Login or Profile screen to `http://<YOUR_PC_LOCAL_IP>:5000/api` (e.g. `http://192.168.1.15:5000/api`).

### Step 5: Launch the App

- **Run in Google Chrome (Fastest Preview)**:
  ```powershell
  flutter run -d chrome
  ```

- **Run on Android Emulator or Connected Phone**:
  ```powershell
  flutter run
  ```

- **Build Production Android APK**:
  ```powershell
  flutter build apk --release
  ```
  The built APK will be generated at `build/app/outputs/flutter-apk/app-release.apk`.
