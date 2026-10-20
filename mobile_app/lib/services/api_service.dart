import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../models/user.dart';
import '../models/booking.dart';
import '../models/fare_estimate.dart';
import '../models/driver_profile.dart';
import '../models/admin_stats.dart';
import '../models/trip_booking.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  // Dynamic Base URL resolver
  String _baseUrl = _defaultBaseUrl();

  static String _defaultBaseUrl() {
    if (kIsWeb) return 'http://localhost:5000/api';
    try {
      if (Platform.isAndroid) return 'http://10.0.2.2:5000/api';
      return 'http://localhost:5000/api';
    } catch (_) {
      return 'http://localhost:5000/api';
    }
  }

  String get baseUrl => _baseUrl;
  void setBaseUrl(String url) {
    _baseUrl = url.endsWith('/') ? url.substring(0, url.length - 1) : url;
  }

  // Token Management
  static const String _tokenKey = 'kk_token';

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }

  // Generic Request Helper
  Future<Map<String, dynamic>> _request(
    String endpoint, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    final url = Uri.parse('$_baseUrl$endpoint');
    final token = await getToken();

    final headers = {
      'Content-Type': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };

    try {
      http.Response response;
      if (method == 'POST') {
        response = await http.post(url,
            headers: headers, body: jsonEncode(body ?? {}));
      } else if (method == 'PATCH') {
        response = await http.patch(url,
            headers: headers, body: jsonEncode(body ?? {}));
      } else if (method == 'DELETE') {
        response = await http.delete(url, headers: headers);
      } else {
        response = await http.get(url, headers: headers);
      }

      final data = jsonDecode(response.body);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return data is Map<String, dynamic>
            ? data
            : {'success': true, 'data': data};
      } else {
        return {
          'success': false,
          'error': data['error'] ??
              data['message'] ??
              'Request failed (${response.statusCode})',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'error':
            'Connection error: Could not reach backend server ($endpoint).',
      };
    }
  }

  // ------------------- AUTH -------------------
  Future<Map<String, dynamic>> login(String identifier, String password) async {
    final res = await _request('/auth/login', method: 'POST', body: {
      'identifier': identifier,
      'password': password,
    });
    if (res['success'] == true &&
        res['data'] != null &&
        res['data']['token'] != null) {
      await saveToken(res['data']['token']);
    }
    return res;
  }

  Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String mobile,
    required String password,
    required String role,
    String? autoNumber,
    String? autoModel,
    String? licenseNumber,
  }) async {
    final res = await _request('/auth/register', method: 'POST', body: {
      'name': name,
      'email': email,
      'mobile': mobile,
      'password': password,
      'role': role,
      if (autoNumber != null) 'autoNumber': autoNumber,
      if (autoModel != null) 'autoModel': autoModel,
      if (licenseNumber != null) 'licenseNumber': licenseNumber,
    });
    if (res['success'] == true &&
        res['data'] != null &&
        res['data']['token'] != null) {
      await saveToken(res['data']['token']);
    }
    return res;
  }

  Future<Map<String, dynamic>> verifyEmailOtp(String email, String otp) async {
    final res = await _request('/auth/verify-email-otp', method: 'POST', body: {
      'email': email,
      'otp': otp,
    });
    if (res['success'] == true &&
        res['data'] != null &&
        res['data']['token'] != null) {
      await saveToken(res['data']['token']);
    }
    return res;
  }

  Future<User?> getMe() async {
    final res = await _request('/auth/me');
    if (res['success'] == true && res['data'] != null) {
      return User.fromJson(res['data']);
    }
    return null;
  }

  Future<void> logout() async {
    try {
      await _request('/auth/logout', method: 'POST');
    } catch (_) {}
    await clearToken();
  }

  // ------------------- BOOKINGS -------------------
  Future<List<String>> getLocations() async {
    final res = await _request('/bookings/locations');
    if (res['success'] == true && res['data'] != null) {
      return List<String>.from(res['data']);
    }
    return [];
  }

  Future<FareEstimate?> getFareEstimate({
    required String fromLocation,
    required String toLocation,
    int passengers = 1,
    double? pickupLatitude,
    double? pickupLongitude,
    double? destinationLatitude,
    double? destinationLongitude,
  }) async {
    final res =
        await _request('/bookings/fare-estimate', method: 'POST', body: {
      'fromLocation': fromLocation,
      'toLocation': toLocation,
      'passengers': passengers,
      if (pickupLatitude != null) 'pickupLatitude': pickupLatitude,
      if (pickupLongitude != null) 'pickupLongitude': pickupLongitude,
      if (destinationLatitude != null)
        'destinationLatitude': destinationLatitude,
      if (destinationLongitude != null)
        'destinationLongitude': destinationLongitude,
    });
    if (res['success'] == true && res['data'] != null) {
      return FareEstimate.fromJson(res['data']);
    }
    return null;
  }

  Future<Booking?> createBooking({
    required String pickupAddress,
    required String destinationAddress,
    String? pickupDateTime,
    int passengers = 1,
    double? pickupLatitude,
    double? pickupLongitude,
    double? destinationLatitude,
    double? destinationLongitude,
  }) async {
    final res = await _request('/bookings', method: 'POST', body: {
      'pickupAddress': pickupAddress,
      'destinationAddress': destinationAddress,
      if (pickupDateTime != null) 'pickupDateTime': pickupDateTime,
      'passengers': passengers,
      if (pickupLatitude != null) 'pickupLatitude': pickupLatitude,
      if (pickupLongitude != null) 'pickupLongitude': pickupLongitude,
      if (destinationLatitude != null)
        'destinationLatitude': destinationLatitude,
      if (destinationLongitude != null)
        'destinationLongitude': destinationLongitude,
    });
    if (res['success'] == true && res['data'] != null) {
      return Booking.fromJson(res['data']);
    }
    return null;
  }

  Future<List<Booking>> getMyBookings() async {
    final res = await _request('/bookings');
    if (res['success'] == true && res['data'] != null) {
      return (res['data'] as List).map((e) => Booking.fromJson(e)).toList();
    }
    return [];
  }

  Future<Booking?> getBookingById(int id) async {
    final res = await _request('/bookings/$id');
    if (res['success'] == true && res['data'] != null) {
      return Booking.fromJson(res['data']);
    }
    return null;
  }

  Future<bool> cancelBooking(int id) async {
    final res = await _request('/bookings/$id/cancel', method: 'PATCH');
    return res['success'] == true;
  }

  // ------------------- PAYMENTS -------------------
  Future<Map<String, dynamic>> createPaymentOrder(int bookingId,
      {String paymentMethod = 'UPI'}) async {
    return await _request('/payments/create-order', method: 'POST', body: {
      'bookingId': bookingId,
      'paymentMethod': paymentMethod,
    });
  }

  Future<Map<String, dynamic>> sandboxPay(int bookingId,
      {String paymentMethod = 'UPI'}) async {
    return await _request('/payments/sandbox-pay', method: 'POST', body: {
      'bookingId': bookingId,
      'paymentMethod': paymentMethod,
    });
  }

  Future<bool> rateDriver(int bookingId, int rating, {String? review}) async {
    final res = await _request('/payments/rate-driver', method: 'POST', body: {
      'bookingId': bookingId,
      'rating': rating,
      if (review != null) 'review': review,
    });
    return res['success'] == true;
  }

  // ------------------- DRIVER -------------------
  Future<DriverProfile?> getDriverProfile() async {
    final res = await _request('/drivers/me');
    if (res['success'] == true && res['data'] != null) {
      return DriverProfile.fromJson(res['data']);
    }
    return null;
  }

  Future<bool> updateDriverStatus(String status) async {
    final res = await _request('/drivers/status', method: 'PATCH', body: {
      'status': status,
    });
    return res['success'] == true;
  }

  Future<List<Booking>> getDriverRequests() async {
    final res = await _request('/drivers/requests');
    if (res['success'] == true && res['data'] != null) {
      return (res['data'] as List).map((e) => Booking.fromJson(e)).toList();
    }
    return [];
  }

  Future<Booking?> acceptRide(int bookingId) async {
    final res =
        await _request('/drivers/rides/$bookingId/accept', method: 'POST');
    if (res['success'] == true && res['data'] != null) {
      return Booking.fromJson(res['data']);
    }
    return null;
  }

  Future<Booking?> updateRideStatus(int bookingId, String status) async {
    final res = await _request('/drivers/rides/$bookingId/status',
        method: 'PATCH',
        body: {
          'status': status,
        });
    if (res['success'] == true && res['data'] != null) {
      return Booking.fromJson(res['data']);
    }
    return null;
  }

  Future<DriverEarningsSummary?> getDriverEarnings() async {
    final res = await _request('/payments/driver/earnings');
    if (res['success'] == true && res['data'] != null) {
      return DriverEarningsSummary.fromJson(res['data']);
    }
    return null;
  }

  // ------------------- ADMIN -------------------
  Future<AdminStats?> getAdminDashboard() async {
    final res = await _request('/admin/dashboard');
    if (res['success'] == true && res['data'] != null) {
      return AdminStats.fromJson(res['data']);
    }
    return null;
  }

  Future<PlatformFinancials?> getAdminFinancials() async {
    final res = await _request('/admin/financials');
    if (res['success'] == true && res['data'] != null) {
      return PlatformFinancials.fromJson(res['data']);
    }
    return null;
  }

  Future<List<dynamic>> getAdminDrivers() async {
    final res = await _request('/admin/drivers');
    if (res['success'] == true && res['data'] != null) {
      return res['data'] as List;
    }
    return [];
  }

  Future<bool> updateDriverApproval(int driverId, String status) async {
    final res = await _request('/admin/drivers/$driverId/approval',
        method: 'PATCH',
        body: {
          'status': status,
        });
    return res['success'] == true;
  }

  Future<Map<String, dynamic>> getSettlements() async {
    final res = await _request('/admin/settlements');
    if (res['success'] == true && res['data'] != null) {
      return res['data'];
    }
    return {};
  }

  Future<bool> settleDriverPayout(int driverId) async {
    final res =
        await _request('/admin/settlements/settle', method: 'POST', body: {
      'driverId': driverId,
    });
    return res['success'] == true;
  }

  Future<List<FareRoute>> getFareRoutes() async {
    final res = await _request('/admin/fare-config');
    if (res['success'] == true && res['data'] != null) {
      return (res['data'] as List).map((e) => FareRoute.fromJson(e)).toList();
    }
    return [];
  }

  Future<bool> updateFareRoute(int id, double fare) async {
    final res = await _request('/admin/fare-config', method: 'PATCH', body: {
      'id': id,
      'fare': fare,
    });
    return res['success'] == true;
  }

  Future<bool> addRoute(
      String fromLocation, String toLocation, double fare) async {
    final res = await _request('/admin/routes', method: 'POST', body: {
      'fromLocation': fromLocation,
      'toLocation': toLocation,
      'fare': fare,
    });
    return res['success'] == true;
  }

  Future<bool> toggleRoute(int id) async {
    final res = await _request('/admin/routes/$id/toggle', method: 'PATCH');
    return res['success'] == true;
  }

  Future<List<Booking>> getAllBookings() async {
    final res = await _request('/admin/bookings');
    if (res['success'] == true && res['data'] != null) {
      return (res['data'] as List).map((e) => Booking.fromJson(e)).toList();
    }
    return [];
  }

  Future<bool> updateBookingStatus(int id, String status) async {
    final res =
        await _request('/admin/bookings/$id/status', method: 'PATCH', body: {
      'status': status,
    });
    return res['success'] == true;
  }

  // ------------------- OUTSTATION TRIP BOOKINGS -------------------
  Future<TripBooking?> createTripBooking({
    required String customerName,
    required String phoneNumber,
    required int members,
    required String tripPlace,
    required int days,
    required String tripDate,
    required String pickupTime,
  }) async {
    final res = await _request('/trip-bookings', method: 'POST', body: {
      'customerName': customerName,
      'phoneNumber': phoneNumber,
      'members': members,
      'tripPlace': tripPlace,
      'days': days,
      'tripDate': tripDate,
      'pickupTime': pickupTime,
    });
    if (res['success'] == true && res['data'] != null) {
      return TripBooking.fromJson(res['data']);
    }
    return null;
  }

  Future<List<TripBooking>> getMyTripBookings() async {
    final res = await _request('/trip-bookings/my');
    if (res['success'] == true && res['data'] != null) {
      return (res['data'] as List).map((e) => TripBooking.fromJson(e)).toList();
    }
    return [];
  }

  Future<List<TripBooking>> getAllTripBookingsOwner() async {
    final res = await _request('/trip-bookings/owner/all');
    if (res['success'] == true && res['data'] != null) {
      return (res['data'] as List).map((e) => TripBooking.fromJson(e)).toList();
    }
    return [];
  }

  Future<bool> updateTripQuote(int tripId, double quote) async {
    final res =
        await _request('/trip-bookings/owner/$tripId', method: 'PATCH', body: {
      'quotedPrice': quote,
    });
    return res['success'] == true;
  }
}
