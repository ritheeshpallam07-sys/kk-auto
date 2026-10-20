import 'dart:async';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/booking.dart';
import '../services/api_service.dart';
import '../services/auth_state.dart';
import '../theme/app_colors.dart';
import '../widgets/custom_button.dart';
import '../widgets/map_preview_card.dart';
import '../widgets/ride_stepper.dart';
import '../widgets/status_badge.dart';
import '../widgets/cashfree_sheet.dart';

class RideTrackingScreen extends StatefulWidget {
  final int? bookingId;

  const RideTrackingScreen({super.key, this.bookingId});

  @override
  State<RideTrackingScreen> createState() => _RideTrackingScreenState();
}

class _RideTrackingScreenState extends State<RideTrackingScreen> {
  final ApiService _api = ApiService();
  final AuthState _auth = AuthState();

  Booking? _booking;
  bool _isLoading = true;
  String? _errorMessage;
  Timer? _pollingTimer;
  bool _hasPromptedRating = false;

  int get _currentBookingId {
    if (widget.bookingId != null) return widget.bookingId!;
    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is int) return args;
    if (args is Map && args['bookingId'] != null) {
      return int.tryParse(args['bookingId'].toString()) ?? 0;
    }
    return _auth.activeBooking?.id ?? 0;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadBooking(initial: true);
      _startPolling();
    });
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  void _startPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (mounted && _booking != null && !_booking!.isCancelled) {
        _loadBooking(initial: false);
      }
    });
  }

  Future<void> _loadBooking({bool initial = false}) async {
    final id = _currentBookingId;
    if (id <= 0) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'No active booking reference found.';
        });
      }
      return;
    }

    if (initial) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });
    }

    try {
      final b = await _api.getBookingById(id);
      if (mounted) {
        setState(() {
          _booking = b;
          _isLoading = false;
          if (b == null) {
            _errorMessage = 'Could not load ride details.';
          }
        });

        if (b != null) {
          _auth.setActiveBooking(b.isActive ? b : null);

          // Prompt rating if completed and not prompted yet
          if (b.isCompleted && !_hasPromptedRating && (b.driverId != null)) {
            _hasPromptedRating = true;
            Future.delayed(const Duration(milliseconds: 600), () {
              if (mounted) _showRatingDialog(b);
            });
          }
        }
      }
    } catch (e) {
      if (mounted && initial) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Failed to fetch ride status: $e';
        });
      }
    }
  }

  Future<void> _cancelRide() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.border),
        ),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: AppColors.error),
            SizedBox(width: 10),
            Text('Cancel Ride?',
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold)),
          ],
        ),
        content: const Text(
          'Are you sure you want to cancel this ride request? This cannot be undone.',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep Ride',
                style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cancel Ride'),
          ),
        ],
      ),
    );

    if (confirm == true && _booking != null) {
      final success = await _api.cancelBooking(_booking!.id);
      if (success) {
        _auth.setActiveBooking(null);
        await _loadBooking();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              backgroundColor: AppColors.error,
              content: Text('Ride has been cancelled.'),
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              backgroundColor: AppColors.error,
              content: Text('Failed to cancel ride. Please try again.'),
            ),
          );
        }
      }
    }
  }

  void _callDriver(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Cannot call $phone directly from this device.')),
        );
      }
    }
  }

  void _openCashfreePayment() {
    if (_booking == null) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CashfreeSheet(
        bookingId: _booking!.id,
        amount: _booking!.estimatedFare,
        bookingReference: _booking!.bookingReference,
        onPaymentSuccess: () {
          _loadBooking();
        },
      ),
    );
  }

  void _showRatingDialog(Booking booking) {
    int selectedRating = 5;
    final reviewController = TextEditingController();
    bool isSubmitting = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (dialogCtx, setDialogState) => AlertDialog(
          backgroundColor: AppColors.card,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: AppColors.border),
          ),
          title: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.accent.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.star_rounded,
                    color: AppColors.accent, size: 36),
              ),
              const SizedBox(height: 12),
              const Text(
                'Rate Your Ride',
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text(
                'How was your journey with ${booking.driverName ?? "your driver"}?',
                textAlign: TextAlign.center,
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 13),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (index) {
                  final starVal = index + 1;
                  return IconButton(
                    iconSize: 32,
                    onPressed: () {
                      setDialogState(() => selectedRating = starVal);
                    },
                    icon: Icon(
                      starVal <= selectedRating
                          ? Icons.star_rounded
                          : Icons.star_outline_rounded,
                      color: starVal <= selectedRating
                          ? AppColors.accent
                          : AppColors.textSecondary,
                    ),
                  );
                }),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: reviewController,
                maxLines: 2,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'Share optional feedback...',
                  hintStyle: const TextStyle(
                      color: AppColors.textSecondary, fontSize: 13),
                  filled: true,
                  fillColor: AppColors.cardSecondary,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppColors.accent),
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Skip',
                  style: TextStyle(color: AppColors.textSecondary)),
            ),
            CustomButton(
              text: isSubmitting ? 'Saving...' : 'Submit Rating',
              isLoading: isSubmitting,
              onPressed: isSubmitting
                  ? null
                  : () async {
                      setDialogState(() => isSubmitting = true);
                      final ok = await _api.rateDriver(
                        booking.id,
                        selectedRating,
                        review: reviewController.text.trim().isNotEmpty
                            ? reviewController.text.trim()
                            : null,
                      );
                      if (dialogCtx.mounted) {
                        Navigator.pop(dialogCtx);
                      }
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            backgroundColor:
                                ok ? AppColors.success : AppColors.error,
                            content: Text(ok
                                ? 'Thank you for your rating!'
                                : 'Failed to submit rating.'),
                          ),
                        );
                      }
                    },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Ride Tracking'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => _loadBooking(initial: false),
            tooltip: 'Refresh Status',
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(color: AppColors.accent),
            SizedBox(height: 16),
            Text(
              'Connecting to live ride updates...',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
            ),
          ],
        ),
      );
    }

    if (_errorMessage != null || _booking == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline_rounded,
                  color: AppColors.error, size: 54),
              const SizedBox(height: 16),
              Text(
                _errorMessage ?? 'No booking found',
                textAlign: TextAlign.center,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 20),
              CustomButton(
                text: 'Retry',
                onPressed: () => _loadBooking(initial: true),
              ),
            ],
          ),
        ),
      );
    }

    final booking = _booking!;

    return RefreshIndicator(
      color: AppColors.accent,
      backgroundColor: AppColors.card,
      onRefresh: () => _loadBooking(initial: false),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Status & Reference Pill
            _buildHeaderCard(booking),
            const SizedBox(height: 16),

            // 5-step Ride Progression Stepper
            RideStepper(currentStatus: booking.status),
            const SizedBox(height: 16),

            // Route Map Representation
            MapPreviewCard(
              pickupAddress: booking.pickupAddress,
              destinationAddress: booking.destinationAddress,
              fare: booking.estimatedFare,
            ),
            const SizedBox(height: 16),

            // Driver Information Card (if assigned)
            if (booking.driverName != null) ...[
              _buildDriverCard(booking),
              const SizedBox(height: 16),
            ] else if (booking.isSearching) ...[
              _buildSearchingBanner(),
              const SizedBox(height: 16),
            ],

            // Journey Location Details Card
            _buildTripDetailsCard(booking),
            const SizedBox(height: 24),

            // Dynamic Action Buttons
            _buildActionButtons(booking),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildHeaderCard(Booking booking) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                booking.bookingReference,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Pickup: ${booking.pickupDatetime}',
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 12),
              ),
            ],
          ),
          StatusBadge(status: booking.status),
        ],
      ),
    );
  }

  Widget _buildSearchingBanner() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.accent.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.accent.withValues(alpha: 0.3)),
      ),
      child: const Row(
        children: [
          SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(
                color: AppColors.accent, strokeWidth: 2.5),
          ),
          SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Contacting nearby auto drivers...',
                  style: TextStyle(
                      color: AppColors.accent,
                      fontWeight: FontWeight.bold,
                      fontSize: 14),
                ),
                SizedBox(height: 2),
                Text(
                  'Drivers in Kadiri are notified. Once accepted, auto details will appear here.',
                  style:
                      TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDriverCard(Booking booking) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
            color: AppColors.accent.withValues(alpha: 0.4), width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  gradient: AppColors.yellowGradient,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.two_wheeler_rounded,
                    color: AppColors.background, size: 28),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      booking.driverName ?? 'Assigned Driver',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      booking.autoModel ?? 'Bajaj Compact Auto',
                      style: const TextStyle(
                          color: AppColors.textSecondary, fontSize: 13),
                    ),
                  ],
                ),
              ),
              if (booking.driverMobile != null)
                IconButton.filled(
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.success,
                    foregroundColor: Colors.white,
                  ),
                  icon: const Icon(Icons.call_rounded),
                  tooltip: 'Call Driver',
                  onPressed: () => _callDriver(booking.driverMobile),
                ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(color: AppColors.border, height: 1),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.pin_outlined,
                      color: AppColors.accent, size: 16),
                  const SizedBox(width: 6),
                  Text(
                    'Vehicle Plate: ${booking.autoNumber ?? "AP 02 TJ 4920"}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
              if (booking.licenseNumber != null)
                Text(
                  'DL: ${booking.licenseNumber}',
                  style: const TextStyle(
                      color: AppColors.textSecondary, fontSize: 11),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTripDetailsCard(Booking booking) {
    final isPaid = booking.isPaid;

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
          const Text(
            'Trip Details',
            style: TextStyle(
                color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.radio_button_checked,
                  color: AppColors.accent, size: 18),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Pickup Location',
                        style: TextStyle(
                            color: AppColors.textSecondary, fontSize: 11)),
                    Text(
                      booking.pickupAddress,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Padding(
            padding: EdgeInsets.only(left: 8.0, top: 4, bottom: 4),
            child: SizedBox(
              height: 16,
              child: VerticalDivider(color: AppColors.border, thickness: 1.5),
            ),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.location_on, color: AppColors.error, size: 18),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Destination Location',
                        style: TextStyle(
                            color: AppColors.textSecondary, fontSize: 11)),
                    Text(
                      booking.destinationAddress,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(color: AppColors.border, height: 1),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Total Fare',
                      style: TextStyle(
                          color: AppColors.textSecondary, fontSize: 12)),
                  Text(
                    '₹${booking.estimatedFare.toStringAsFixed(0)}',
                    style: const TextStyle(
                        color: AppColors.accent,
                        fontSize: 20,
                        fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text('Payment Status',
                      style: TextStyle(
                          color: AppColors.textSecondary, fontSize: 12)),
                  const SizedBox(height: 4),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: (isPaid ? AppColors.success : AppColors.warning)
                          .withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: isPaid ? AppColors.success : AppColors.warning,
                        width: 1,
                      ),
                    ),
                    child: Text(
                      isPaid ? 'PAID' : 'PAYMENT PENDING',
                      style: TextStyle(
                        color: isPaid ? AppColors.success : AppColors.warning,
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons(Booking booking) {
    // If Ride is Completed but not paid
    if (booking.isCompleted && !booking.isPaid) {
      return Column(
        children: [
          CustomButton(
            text:
                'Pay ₹${booking.estimatedFare.toStringAsFixed(0)} with Cashfree',
            icon: Icons.payment_rounded,
            onPressed: _openCashfreePayment,
          ),
          const SizedBox(height: 10),
          CustomButton(
            text: 'Rate Driver',
            type: ButtonType.secondary,
            icon: Icons.star_outline_rounded,
            onPressed: () => _showRatingDialog(booking),
          ),
        ],
      );
    }

    // If Ride is Completed and paid
    if (booking.isCompleted && booking.isPaid) {
      return Column(
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
              border:
                  Border.all(color: AppColors.success.withValues(alpha: 0.3)),
            ),
            child: const Row(
              children: [
                Icon(Icons.check_circle_rounded,
                    color: AppColors.success, size: 24),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Ride completed and payment verified successfully. Thank you for riding with Clik2Go!',
                    style: TextStyle(color: Colors.white, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          CustomButton(
            text: 'Rate Driver',
            icon: Icons.star_rounded,
            onPressed: () => _showRatingDialog(booking),
          ),
        ],
      );
    }

    // If ride is active (Searching, Assigned, Arriving, Started)
    if (booking.isActive) {
      return Column(
        children: [
          CustomButton(
            text: 'Cancel Ride',
            type: ButtonType.danger,
            icon: Icons.cancel_outlined,
            onPressed: _cancelRide,
          ),
        ],
      );
    }

    // If Cancelled
    if (booking.isCancelled) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.error.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
        ),
        child: const Row(
          children: [
            Icon(Icons.cancel_rounded, color: AppColors.error, size: 24),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'This booking was cancelled. You can book a new ride anytime from Home.',
                style: TextStyle(color: Colors.white, fontSize: 13),
              ),
            ),
          ],
        ),
      );
    }

    return const SizedBox.shrink();
  }
}
