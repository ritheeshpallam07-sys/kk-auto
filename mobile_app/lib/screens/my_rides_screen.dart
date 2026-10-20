import 'package:flutter/material.dart';
import '../models/booking.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../widgets/custom_button.dart';
import '../widgets/status_badge.dart';
import 'ride_tracking_screen.dart';
import 'booking_screen.dart';

class MyRidesScreen extends StatefulWidget {
  const MyRidesScreen({super.key});

  @override
  State<MyRidesScreen> createState() => _MyRidesScreenState();
}

class _MyRidesScreenState extends State<MyRidesScreen>
    with SingleTickerProviderStateMixin {
  final ApiService _api = ApiService();
  late TabController _tabController;

  List<Booking> _allBookings = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadBookings();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadBookings() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final list = await _api.getMyBookings();
      if (mounted) {
        setState(() {
          _allBookings = list;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Could not load rides: $e';
        });
      }
    }
  }

  List<Booking> _getFilteredBookings(int tabIndex) {
    switch (tabIndex) {
      case 1: // Active
        return _allBookings.where((b) => b.isActive).toList();
      case 2: // Completed
        return _allBookings.where((b) => b.isCompleted).toList();
      case 3: // Cancelled
        return _allBookings.where((b) => b.isCancelled).toList();
      default: // All
        return _allBookings;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('My Rides'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadBookings,
            tooltip: 'Refresh',
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.accent,
          indicatorWeight: 3,
          labelColor: AppColors.accent,
          unselectedLabelColor: AppColors.textSecondary,
          labelStyle:
              const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          tabs: const [
            Tab(text: 'All'),
            Tab(text: 'Active'),
            Tab(text: 'Completed'),
            Tab(text: 'Cancelled'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.accent))
          : _errorMessage != null
              ? _buildErrorView()
              : TabBarView(
                  controller: _tabController,
                  children: List.generate(4, (index) {
                    final filtered = _getFilteredBookings(index);
                    return _buildRidesList(filtered, index);
                  }),
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
            const SizedBox(height: 14),
            Text(
              _errorMessage ?? 'Failed to load bookings.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 15),
            ),
            const SizedBox(height: 18),
            CustomButton(
              text: 'Try Again',
              onPressed: _loadBookings,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRidesList(List<Booking> bookings, int tabIndex) {
    if (bookings.isEmpty) {
      return RefreshIndicator(
        color: AppColors.accent,
        backgroundColor: AppColors.card,
        onRefresh: _loadBookings,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(32),
          children: [
            const SizedBox(height: 80),
            Center(
              child: Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: AppColors.card,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.border),
                ),
                child: const Icon(Icons.receipt_long_rounded,
                    color: AppColors.textSecondary, size: 36),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              _getEmptyTitle(tabIndex),
              textAlign: TextAlign.center,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              _getEmptySubtitle(tabIndex),
              textAlign: TextAlign.center,
              style:
                  const TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 24),
            Center(
              child: SizedBox(
                width: 180,
                child: CustomButton(
                  text: 'Book an Auto',
                  icon: Icons.two_wheeler_rounded,
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const BookingScreen()),
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: AppColors.accent,
      backgroundColor: AppColors.card,
      onRefresh: _loadBookings,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        itemCount: bookings.length,
        separatorBuilder: (_, __) => const SizedBox(height: 14),
        itemBuilder: (context, index) {
          final booking = bookings[index];
          return _buildRideCard(booking);
        },
      ),
    );
  }

  String _getEmptyTitle(int tabIndex) {
    switch (tabIndex) {
      case 1:
        return 'No Active Rides';
      case 2:
        return 'No Completed Rides Yet';
      case 3:
        return 'No Cancelled Rides';
      default:
        return 'No Rides Booked Yet';
    }
  }

  String _getEmptySubtitle(int tabIndex) {
    switch (tabIndex) {
      case 1:
        return 'You do not have any rides in progress right now.';
      case 2:
        return 'Rides you complete will be listed here with invoice history.';
      case 3:
        return 'You have not cancelled any auto bookings.';
      default:
        return 'Your travel history in Kadiri will appear here once you take your first ride.';
    }
  }

  Widget _buildRideCard(Booking booking) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: booking.isActive
              ? AppColors.accent.withValues(alpha: 0.4)
              : AppColors.border,
          width: booking.isActive ? 1.4 : 1,
        ),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Reference + Status
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.confirmation_number_outlined,
                      color: AppColors.accent, size: 16),
                  const SizedBox(width: 6),
                  Text(
                    booking.bookingReference,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
              StatusBadge(status: booking.status),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(color: AppColors.border, height: 1),
          const SizedBox(height: 12),

          // Route: Pickup -> Destination
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.radio_button_checked,
                  color: AppColors.accent, size: 16),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  booking.pickupAddress,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
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
              height: 12,
              child: VerticalDivider(color: AppColors.border, thickness: 1.2),
            ),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.location_on, color: AppColors.error, size: 16),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  booking.destinationAddress,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w500),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Fare, Date & Driver row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    booking.pickupDatetime,
                    style: const TextStyle(
                        color: AppColors.textSecondary, fontSize: 11),
                  ),
                  if (booking.driverName != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      'Driver: ${booking.driverName}',
                      style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 11,
                          fontWeight: FontWeight.w500),
                    ),
                  ],
                ],
              ),
              Text(
                '₹${booking.estimatedFare.toStringAsFixed(0)}',
                style: const TextStyle(
                  color: AppColors.accent,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Action Buttons
          Row(
            children: [
              if (booking.isActive) ...[
                Expanded(
                  child: CustomButton(
                    text: 'Track Live Ride',
                    icon: Icons.navigation_rounded,
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) =>
                              RideTrackingScreen(bookingId: booking.id),
                        ),
                      ).then((_) => _loadBookings());
                    },
                  ),
                ),
              ] else ...[
                Expanded(
                  child: CustomButton(
                    text: 'View Details',
                    type: ButtonType.secondary,
                    icon: Icons.info_outline_rounded,
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) =>
                              RideTrackingScreen(bookingId: booking.id),
                        ),
                      ).then((_) => _loadBookings());
                    },
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: CustomButton(
                    text: 'Book Again',
                    icon: Icons.repeat_rounded,
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => BookingScreen(
                            prefilledPickup: booking.pickupAddress,
                            prefilledDestination: booking.destinationAddress,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
