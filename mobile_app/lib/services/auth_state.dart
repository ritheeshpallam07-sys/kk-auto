import 'package:flutter/material.dart';
import '../models/user.dart';
import '../models/booking.dart';
import 'api_service.dart';

class AuthState extends ChangeNotifier {
  static final AuthState _instance = AuthState._internal();
  factory AuthState() => _instance;
  AuthState._internal();

  final ApiService _api = ApiService();

  User? _currentUser;
  bool _isLoading = true;
  Booking? _activeBooking;

  User? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _currentUser != null;
  Booking? get activeBooking => _activeBooking;

  Future<void> initialize() async {
    _isLoading = true;
    notifyListeners();

    try {
      final token = await _api.getToken();
      if (token != null && token.isNotEmpty) {
        _currentUser = await _api.getMe();
        if (_currentUser != null) {
          await loadActiveBooking();
        }
      }
    } catch (_) {
      _currentUser = null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadActiveBooking() async {
    try {
      final bookings = await _api.getMyBookings();
      final active = bookings.where((b) => b.isActive).toList();
      _activeBooking = active.isNotEmpty ? active.first : null;
      notifyListeners();
    } catch (_) {}
  }

  void setActiveBooking(Booking? booking) {
    _activeBooking = booking;
    notifyListeners();
  }

  Future<Map<String, dynamic>> login(String identifier, String password) async {
    _isLoading = true;
    notifyListeners();

    final res = await _api.login(identifier, password);
    if (res['success'] == true &&
        res['data'] != null &&
        res['data']['user'] != null) {
      _currentUser = User.fromJson(res['data']['user']);
      await loadActiveBooking();
    }

    _isLoading = false;
    notifyListeners();
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
    _isLoading = true;
    notifyListeners();

    final res = await _api.register(
      name: name,
      email: email,
      mobile: mobile,
      password: password,
      role: role,
      autoNumber: autoNumber,
      autoModel: autoModel,
      licenseNumber: licenseNumber,
    );

    if (res['success'] == true &&
        res['data'] != null &&
        res['data']['user'] != null) {
      _currentUser = User.fromJson(res['data']['user']);
    }

    _isLoading = false;
    notifyListeners();
    return res;
  }

  Future<Map<String, dynamic>> verifyEmailOtp(String email, String otp) async {
    _isLoading = true;
    notifyListeners();

    final res = await _api.verifyEmailOtp(email, otp);
    if (res['success'] == true &&
        res['data'] != null &&
        res['data']['user'] != null) {
      _currentUser = User.fromJson(res['data']['user']);
      await loadActiveBooking();
    }

    _isLoading = false;
    notifyListeners();
    return res;
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    await _api.logout();
    _currentUser = null;
    _activeBooking = null;

    _isLoading = false;
    notifyListeners();
  }

  Future<void> refreshProfile() async {
    try {
      _currentUser = await _api.getMe();
      notifyListeners();
    } catch (_) {}
  }
}
