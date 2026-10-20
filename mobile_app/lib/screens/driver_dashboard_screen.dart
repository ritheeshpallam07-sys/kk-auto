import 'dart:async';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/booking.dart';
import '../models/driver_profile.dart';
import '../services/api_service.dart';
import '../services/auth_state.dart';
import '../theme/app_colors.dart';
import '../widgets/custom_button.dart';
import '../widgets/metric_card.dart';
import '../widgets/status_badge.dart';
import 'profile_screen.dart';

class DriverDashboardScreen extends StatefulWidget {
  const DriverDashboardScreen({super.key});

  @override
  State<DriverDashboardScreen> createState() => _DriverDashboardScreenState();
}

class _DriverDashboardScreenState extends State<DriverDashboardScreen> {
  final ApiService _api = ApiService();
  final AuthState _auth = AuthState();

  DriverProfile? _profile;
  DriverEarningsSummary? _earnings;
  List<Booking> _requests = [];
  Booking? _activeRide;

  bool _isLoading = true;
  bool _isTogglingStatus = false;
  Timer? _refreshTimer;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
    _startPeriodicRefresh();
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  void _startPeriodicRefresh() {
    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(const Duration(seconds: 6), (_) {
      if (mounted) {
        _loadRequestsSilently();
      }
    });
  }

  Future<void> _loadDashboardData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final profileFuture = _api.getDriverProfile();
      final earningsFuture = _api.getDriverEarnings();
      final requestsFuture = _api.getDriverRequests();
      final myRidesFuture = _api.getMyBookings();

      final results = await Future.wait([
        profileFuture,
        earningsFuture,
        requestsFuture,
        myRidesFuture,
      ]);

      if (mounted) {
        final profile = results[0] as DriverProfile?;
        final earnings = results[1] as DriverEarningsSummary?;
        final requests = results[2] as List<Booking>;
        final myRides = results[3] as List<Booking>;

        final active = myRides
            .where((b) =>
                b.status == 'Driver Assigned' ||
                b.status == 'Driver Arriving' ||
                b.status == 'Ride Started')
            .toList();

        setState(() {
          _profile = profile;
          _earnings = earnings;
          _requests = requests;
          _activeRide = active.isNotEmpty ? active.first : null;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Failed to load driver dashboard: $e';
        });
      }
    }
  }

  Future<void> _loadRequestsSilently() async {
    try {
      final requests = await _api.getDriverRequests();
      final myRides = await _api.getMyBookings();
      final active = myRides
          .where((b) =>
              b.status == 'Driver Assigned' ||
              b.status == 'Driver Arriving' ||
              b.status == 'Ride Started')
          .toList();

      if (mounted) {
        setState(() {
          _requests = requests;
          _activeRide = active.isNotEmpty ? active.first : null;
        });
      }
    } catch (_) {}
  }

  Future<void> _toggleAvailability(bool isOnline) async {
    setState(() => _isTogglingStatus = true);
    final targetStatus = isOnline ? 'available' : 'offline';

    try {
      final success = await _api.updateDriverStatus(targetStatus);
      if (success) {
        await _loadDashboardData();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor:
                  isOnline ? AppColors.success : AppColors.cardSecondary,
              content: Text(isOnline
                  ? 'You are now ONLINE and visible to riders!'
                  : 'You are now OFFLINE.'),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              backgroundColor: AppColors.error,
              content: Text('Error updating status: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isTogglingStatus = false);
    }
  }

  Future<void> _acceptRide(int bookingId) async {
    setState(() => _isLoading = true);
    try {
      final updated = await _api.acceptRide(bookingId);
      if (updated != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: AppColors.success,
            content: Text('Ride accepted! Navigate to pickup location.'),
          ),
        );
        await _loadDashboardData();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: AppColors.error,
            content: Text('Ride was already taken or unavailable.'),
          ),
        );
        await _loadDashboardData();
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            backgroundColor: AppColors.error,
            content: Text('Accept failed: $e')),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _updateRideStatus(String nextStatus) async {
    if (_activeRide == null) return;
    setState(() => _isLoading = true);

    try {
      final updated = await _api.updateRideStatus(_activeRide!.id, nextStatus);
      if (updated != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.success,
            content: Text('Status updated to: $nextStatus'),
          ),
        );
        await _loadDashboardData();
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            backgroundColor: AppColors.error,
            content: Text('Failed to update status: $e')),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _callCustomer(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  void _openGoogleMaps(String destination) async {
    final encoded = Uri.encodeComponent(destination);
    final url = Uri.parse(
        'https://www.google.com/maps/dir/?api=1&destination=$encoded');
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Driver Partner'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_outline_rounded),
            tooltip: 'My Profile',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const ProfileScreen()),
              ).then((_) => _loadDashboardData());
            },
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: _loadDashboardData,
          ),
        ],
      ),
      body: _isLoading && _profile == null
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.accent))
          : _errorMessage != null && _profile == null
              ? _buildErrorView()
              : RefreshIndicator(
                  color: AppColors.accent,
                  backgroundColor: AppColors.card,
                  onRefresh: _loadDashboardData,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Availability Header & Online Switch
                        _buildStatusHeader(),
                        const SizedBox(height: 16),

                        // Approval warning if not approved
                        if (_profile != null && !_profile!.isApproved) ...[
                          _buildPendingApprovalBanner(),
                          const SizedBox(height: 16),
                        ],

                        // Earnings & Rides Metrics Row
                        _buildMetricsRow(),
                        const SizedBox(height: 20),

                        // Active Ongoing Ride Section
                        if (_activeRide != null) ...[
                          _buildActiveRideSection(_activeRide!),
                          const SizedBox(height: 24),
                        ],

                        // Incoming Ride Requests Queue
                        _buildIncomingRequestsSection(),
                        const SizedBox(height: 32),
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded,
                color: AppColors.error, size: 50),
            const SizedBox(height: 16),
            Text(
              _errorMessage ?? 'Failed to load driver details',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 16),
            ),
            const SizedBox(height: 20),
            CustomButton(text: 'Retry', onPressed: _loadDashboardData),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusHeader() {
    final isOnline = _profile?.isAvailable ?? false;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isOnline
              ? AppColors.accent.withValues(alpha: 0.5)
              : AppColors.border,
          width: 1.2,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              gradient: isOnline ? AppColors.yellowGradient : null,
              color: isOnline ? null : AppColors.cardSecondary,
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.two_wheeler_rounded,
              color: isOnline ? AppColors.background : AppColors.textSecondary,
              size: 26,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _profile?.name ?? _auth.currentUser?.name ?? 'Driver Partner',
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 2),
                Text(
                  '${_profile?.autoNumber ?? "AP 02 TJ 4920"} • ${_profile?.autoModel ?? "Bajaj Auto"}',
                  style: const TextStyle(
                      color: AppColors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          Column(
            children: [
              Switch(
                value: isOnline,
                activeThumbColor: AppColors.accent,
                activeTrackColor: AppColors.accent.withValues(alpha: 0.3),
                inactiveThumbColor: AppColors.textSecondary,
                inactiveTrackColor: AppColors.cardSecondary,
                onChanged: _isTogglingStatus
                    ? null
                    : (val) => _toggleAvailability(val),
              ),
              Text(
                isOnline ? 'ONLINE' : 'OFFLINE',
                style: TextStyle(
                  color: isOnline ? AppColors.accent : AppColors.textSecondary,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.8,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPendingApprovalBanner() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.warning.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.4)),
      ),
      child: const Row(
        children: [
          Icon(Icons.hourglass_top_rounded, color: AppColors.warning, size: 24),
          SizedBox(width: 12),
          Expanded(
            child: Text(
              'Your driver account is under review by Clik2Go Admin. You will receive rides once approved.',
              style: TextStyle(color: Colors.white, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricsRow() {
    return Row(
      children: [
        Expanded(
          child: MetricCard(
            title: "Today's Fare",
            value: '₹${_earnings?.todayEarnings.toStringAsFixed(0) ?? "0"}',
            icon: Icons.currency_rupee_rounded,
            iconColor: AppColors.accent,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: MetricCard(
            title: 'Completed',
            value: '${_earnings?.completedRidesCount ?? 0}',
            icon: Icons.check_circle_rounded,
            iconColor: AppColors.success,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: MetricCard(
            title: 'Settlement',
            value: '₹${_earnings?.pendingSettlement.toStringAsFixed(0) ?? "0"}',
            icon: Icons.account_balance_wallet_rounded,
            iconColor: AppColors.accentLight,
          ),
        ),
      ],
    );
  }

  Widget _buildActiveRideSection(Booking ride) {
    String nextStatus = '';
    String actionLabel = '';
    IconData actionIcon = Icons.arrow_forward_rounded;

    if (ride.status == 'Driver Assigned') {
      nextStatus = 'Driver Arriving';
      actionLabel = 'On Way to Pickup';
      actionIcon = Icons.directions_bike_rounded;
    } else if (ride.status == 'Driver Arriving') {
      nextStatus = 'Ride Started';
      actionLabel = 'Start Ride (Customer Picked Up)';
      actionIcon = Icons.play_arrow_rounded;
    } else if (ride.status == 'Ride Started') {
      nextStatus = 'Ride Completed';
      actionLabel = 'Complete Ride (Drop Reached)';
      actionIcon = Icons.check_circle_rounded;
    }

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.accent, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: AppColors.accent.withValues(alpha: 0.1),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.stars_rounded, color: AppColors.accent, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'Active Ongoing Ride',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              StatusBadge(status: ride.status),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(color: AppColors.border, height: 1),
          const SizedBox(height: 14),

          // Customer Row with Call button
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  color: AppColors.cardSecondary,
                  shape: BoxShape.circle,
                ),
                child:
                    const Icon(Icons.person, color: AppColors.accent, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      ride.customerName ?? 'Customer',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.bold),
                    ),
                    Text(
                      '${ride.passengers} Passenger(s)',
                      style: const TextStyle(
                          color: AppColors.textSecondary, fontSize: 12),
                    ),
                  ],
                ),
              ),
              if (ride.customerMobile != null)
                IconButton.filled(
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.success,
                    foregroundColor: Colors.white,
                  ),
                  icon: const Icon(Icons.call),
                  tooltip: 'Call Customer',
                  onPressed: () => _callCustomer(ride.customerMobile),
                ),
            ],
          ),
          const SizedBox(height: 14),

          // Pickup and Drop
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.radio_button_checked,
                  color: AppColors.accent, size: 16),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  ride.pickupAddress,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.location_on, color: AppColors.error, size: 16),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  ride.destinationAddress,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Total Fare & Navigation
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Collect: ₹${ride.estimatedFare.toStringAsFixed(0)}',
                style: const TextStyle(
                  color: AppColors.accent,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.accent,
                  side: const BorderSide(color: AppColors.accent),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                icon: const Icon(Icons.navigation_rounded, size: 18),
                label: const Text('Maps',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                onPressed: () => _openGoogleMaps(
                  ride.status == 'Ride Started'
                      ? ride.destinationAddress
                      : ride.pickupAddress,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Progression Button
          if (nextStatus.isNotEmpty)
            CustomButton(
              text: actionLabel,
              icon: actionIcon,
              isLoading: _isLoading,
              onPressed: () => _updateRideStatus(nextStatus),
            ),
        ],
      ),
    );
  }

  Widget _buildIncomingRequestsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Incoming Ride Requests',
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.cardSecondary,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                '${_requests.length} Available',
                style: const TextStyle(
                    color: AppColors.accent,
                    fontSize: 11,
                    fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (!(_profile?.isAvailable ?? false))
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: const Row(
              children: [
                Icon(Icons.cloud_off_rounded,
                    color: AppColors.textSecondary, size: 28),
                SizedBox(width: 14),
                Expanded(
                  child: Text(
                    'You are OFFLINE. Turn the switch at the top to ONLINE to receive incoming ride requests in Kadiri.',
                    style:
                        TextStyle(color: AppColors.textSecondary, fontSize: 13),
                  ),
                ),
              ],
            ),
          )
        else if (_requests.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: const Center(
              child: Column(
                children: [
                  Icon(Icons.radar_rounded, color: AppColors.accent, size: 40),
                  SizedBox(height: 12),
                  Text(
                    'Waiting for new ride requests...',
                    style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 15),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Nearby requests in Kadiri will appear here automatically.',
                    textAlign: TextAlign.center,
                    style:
                        TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                ],
              ),
            ),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _requests.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final req = _requests[index];
              return _buildRequestCard(req);
            },
          ),
      ],
    );
  }

  Widget _buildRequestCard(Booking req) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '₹${req.estimatedFare.toStringAsFixed(0)}',
                style: const TextStyle(
                  color: AppColors.accent,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.accent.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${req.passengers} Passenger(s)',
                  style: const TextStyle(
                      color: AppColors.accent,
                      fontSize: 11,
                      fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.radio_button_checked,
                  color: AppColors.accent, size: 16),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  req.pickupAddress,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w500),
                ),
              ),
            ],
          ),
          const Padding(
            padding: EdgeInsets.only(left: 7.0, top: 2, bottom: 2),
            child: SizedBox(
              height: 10,
              child: VerticalDivider(color: AppColors.border, thickness: 1.2),
            ),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.location_on, color: AppColors.error, size: 16),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  req.destinationAddress,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w500),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: CustomButton(
                  text: 'Accept Ride',
                  icon: Icons.check_rounded,
                  onPressed: () => _acceptRide(req.id),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
