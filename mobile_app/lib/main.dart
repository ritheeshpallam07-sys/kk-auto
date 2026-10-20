import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'services/auth_state.dart';
import 'theme/app_colors.dart';
import 'theme/app_theme.dart';
import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/verify_otp_screen.dart';
import 'screens/home_screen.dart';
import 'screens/booking_screen.dart';
import 'screens/ride_tracking_screen.dart';
import 'screens/my_rides_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/driver_dashboard_screen.dart';
import 'screens/admin_dashboard_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Set immersive system status bar and navigation bar styling
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: AppColors.background,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  // Initialize persistent authentication and session state
  final authState = AuthState();
  await authState.initialize();

  runApp(const Clik2GoApp());
}

class Clik2GoApp extends StatelessWidget {
  const Clik2GoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Clik2Go Kadiri',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      initialRoute: '/',
      routes: {
        '/': (context) => const SplashScreen(),
        '/login': (context) => const LoginScreen(),
        '/register': (context) => const RegisterScreen(),
        '/verify-otp': (context) => const VerifyOtpScreen(),
        '/home': (context) => const HomeScreen(),
        '/book': (context) => const BookingScreen(),
        '/booking': (context) => const BookingScreen(),
        '/tracking': (context) => const RideTrackingScreen(),
        '/my-rides': (context) => const MyRidesScreen(),
        '/profile': (context) => const ProfileScreen(),
        '/driver': (context) => const DriverDashboardScreen(),
        '/driver-dashboard': (context) => const DriverDashboardScreen(),
        '/admin': (context) => const AdminDashboardScreen(),
        '/admin-dashboard': (context) => const AdminDashboardScreen(),
      },
      onGenerateRoute: (settings) {
        if (settings.name == '/book' || settings.name == '/booking') {
          if (settings.arguments is Map) {
            final args = settings.arguments as Map;
            return MaterialPageRoute(
              builder: (_) => BookingScreen(
                initialFrom: args['from']?.toString() ??
                    args['pickup']?.toString() ??
                    args['prefilledPickup']?.toString(),
                initialTo: args['to']?.toString() ??
                    args['destination']?.toString() ??
                    args['prefilledDestination']?.toString(),
                prefilledPickup: args['from']?.toString() ??
                    args['pickup']?.toString() ??
                    args['prefilledPickup']?.toString(),
                prefilledDestination: args['to']?.toString() ??
                    args['destination']?.toString() ??
                    args['prefilledDestination']?.toString(),
              ),
              settings: settings,
            );
          }
        }

        if (settings.name == '/tracking') {
          int? id;
          if (settings.arguments is int) {
            id = settings.arguments as int;
          } else if (settings.arguments is Map) {
            final args = settings.arguments as Map;
            id = int.tryParse(args['bookingId']?.toString() ?? '');
          }
          return MaterialPageRoute(
            builder: (_) => RideTrackingScreen(bookingId: id),
            settings: settings,
          );
        }

        if (settings.name == '/verify-otp') {
          String? email;
          if (settings.arguments is String) {
            email = settings.arguments as String;
          } else if (settings.arguments is Map) {
            email = (settings.arguments as Map)['email']?.toString();
          }
          return MaterialPageRoute(
            builder: (_) => VerifyOtpScreen(email: email),
            settings: settings,
          );
        }

        return null;
      },
    );
  }
}
