import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../services/api_service.dart';
import '../models/fare_estimate.dart';
import '../widgets/custom_button.dart';
import '../widgets/custom_text_field.dart';
import '../widgets/map_preview_card.dart';

class BookingScreen extends StatefulWidget {
  final String? initialFrom;
  final String? initialTo;
  final String? prefilledPickup;
  final String? prefilledDestination;

  const BookingScreen({
    super.key,
    this.initialFrom,
    this.initialTo,
    this.prefilledPickup,
    this.prefilledDestination,
  });

  String get fromLocation => prefilledPickup ?? initialFrom ?? 'JNTUA';
  String get toLocation => prefilledDestination ?? initialTo ?? 'Cross';

  @override
  State<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends State<BookingScreen> {
  final ApiService _api = ApiService();

  late TextEditingController _fromController;
  late TextEditingController _toController;

  int _passengers = 1;
  FareEstimate? _fareEstimate;
  bool _isEstimatingFare = false;
  bool _isBooking = false;
  String? _errorMessage;

  List<String> _popularLocations = [
    'JNTUA',
    'Cross',
    'Bus Stand',
    'Railway Station',
    'Marava'
  ];

  @override
  void initState() {
    super.initState();
    _fromController = TextEditingController(text: widget.fromLocation);
    _toController = TextEditingController(text: widget.toLocation);

    _fetchLocations();
    _fetchFareEstimate();
  }

  @override
  void dispose() {
    _fromController.dispose();
    _toController.dispose();
    super.dispose();
  }

  Future<void> _fetchLocations() async {
    try {
      final locs = await _api.getLocations();
      if (locs.isNotEmpty && mounted) {
        setState(() => _popularLocations = locs);
      }
    } catch (_) {}
  }

  Future<void> _fetchFareEstimate() async {
    final from = _fromController.text.trim();
    final to = _toController.text.trim();

    if (from.isEmpty || to.isEmpty || from.toLowerCase() == to.toLowerCase()) {
      setState(() => _fareEstimate = null);
      return;
    }

    setState(() {
      _isEstimatingFare = true;
      _errorMessage = null;
    });

    try {
      final est = await _api.getFareEstimate(
        fromLocation: from,
        toLocation: to,
        passengers: _passengers,
      );

      if (mounted) {
        setState(() {
          _fareEstimate = est;
          _isEstimatingFare = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isEstimatingFare = false;
          _fareEstimate = null;
        });
      }
    }
  }

  Future<void> _handleCreateBooking() async {
    final from = _fromController.text.trim();
    final to = _toController.text.trim();

    if (from.isEmpty || to.isEmpty) {
      setState(() => _errorMessage =
          'Please enter both pickup and destination locations.');
      return;
    }

    if (_fareEstimate == null || !_fareEstimate!.available) {
      setState(() => _errorMessage =
          'Fare is not configured for this route. Please select another route.');
      return;
    }

    setState(() {
      _isBooking = true;
      _errorMessage = null;
    });

    try {
      final booking = await _api.createBooking(
        pickupAddress: from,
        destinationAddress: to,
        passengers: _passengers,
      );

      if (mounted) {
        setState(() => _isBooking = false);
        if (booking != null) {
          Navigator.pushReplacementNamed(
            context,
            '/tracking',
            arguments: {'bookingId': booking.id},
          );
        } else {
          setState(() =>
              _errorMessage = 'Failed to create booking. Please try again.');
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isBooking = false;
          _errorMessage = 'Booking creation error: $e';
        });
      }
    }
  }

  void _swapLocations() {
    final temp = _fromController.text;
    _fromController.text = _toController.text;
    _toController.text = temp;
    _fetchFareEstimate();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Book Auto Ride'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Visual Map Preview Card
              MapPreviewCard(
                pickupAddress: _fromController.text,
                destinationAddress: _toController.text,
                distanceKm: 2.8,
                durationText: '8 mins',
              ),
              const SizedBox(height: 20),

              // Route Input Card
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  children: [
                    CustomTextField(
                      controller: _fromController,
                      label: 'Pickup Location',
                      hintText: 'Enter pickup address (e.g. JNTUA)',
                      prefixIcon: Icons.my_location,
                      onChanged: (_) => _fetchFareEstimate(),
                    ),
                    const SizedBox(height: 10),
                    Center(
                      child: InkWell(
                        onTap: _swapLocations,
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: AppColors.cardElevated,
                            shape: BoxShape.circle,
                            border: Border.all(color: AppColors.border),
                          ),
                          child: const Icon(Icons.swap_vert,
                              size: 20, color: AppColors.accent),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    CustomTextField(
                      controller: _toController,
                      label: 'Destination Location',
                      hintText:
                          'Enter drop destination (e.g. Cross, Bus Stand)',
                      prefixIcon: Icons.location_on,
                      onChanged: (_) => _fetchFareEstimate(),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // Quick Location Chips
              SizedBox(
                height: 34,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _popularLocations.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, idx) {
                    final loc = _popularLocations[idx];
                    return ActionChip(
                      backgroundColor: AppColors.card,
                      side: const BorderSide(color: AppColors.border),
                      label: Text(
                        loc,
                        style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textSecondary),
                      ),
                      onPressed: () {
                        if (_fromController.text.isEmpty) {
                          _fromController.text = loc;
                        } else {
                          _toController.text = loc;
                        }
                        _fetchFareEstimate();
                      },
                    );
                  },
                ),
              ),
              const SizedBox(height: 20),

              // Passengers Count Selector
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Passengers',
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: Colors.white),
                        ),
                        Text(
                          'Standard auto capacity: 1-4',
                          style: TextStyle(
                              fontSize: 11, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                    Row(
                      children: [1, 2, 3, 4].map((count) {
                        final isSelected = _passengers == count;
                        return GestureDetector(
                          onTap: () {
                            setState(() => _passengers = count);
                            _fetchFareEstimate();
                          },
                          child: Container(
                            margin: const EdgeInsets.only(left: 6),
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? AppColors.accent
                                  : AppColors.cardElevated,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: isSelected
                                    ? AppColors.accent
                                    : AppColors.border,
                              ),
                            ),
                            child: Center(
                              child: Text(
                                '$count',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w900,
                                  color: isSelected
                                      ? const Color(0xFF080B10)
                                      : Colors.white,
                                ),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // FARE ESTIMATE DISPLAY CARD
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: _fareEstimate != null && _fareEstimate!.available
                        ? AppColors.borderHighlight
                        : AppColors.border,
                    width: 1.5,
                  ),
                ),
                child: _isEstimatingFare
                    ? const Center(
                        child: Padding(
                          padding: EdgeInsets.symmetric(vertical: 8),
                          child: CircularProgressIndicator(
                              color: AppColors.accent),
                        ),
                      )
                    : _fareEstimate != null && _fareEstimate!.available
                        ? Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: const [
                                      Icon(Icons.verified,
                                          size: 14, color: AppColors.accent),
                                      SizedBox(width: 5),
                                      Text(
                                        'ADMIN CONFIGURED FARE',
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w900,
                                          color: AppColors.accent,
                                          letterSpacing: 0.6,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'For $_passengers passenger${_passengers > 1 ? 's' : ''}',
                                    style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textSecondary),
                                  ),
                                ],
                              ),
                              Text(
                                '₹${_fareEstimate!.estimatedFare.toStringAsFixed(0)}',
                                style: const TextStyle(
                                  fontSize: 28,
                                  fontWeight: FontWeight.w900,
                                  color: AppColors.accent,
                                ),
                              ),
                            ],
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: const [
                              Text(
                                'Fare not configured for this route',
                                style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.warning),
                              ),
                              SizedBox(height: 2),
                              Text(
                                'Please choose authorized locations such as JNTUA, Cross, Bus Stand, or Railway Station.',
                                style: TextStyle(
                                    fontSize: 11, color: AppColors.textMuted),
                              ),
                            ],
                          ),
              ),
              const SizedBox(height: 20),

              if (_errorMessage != null) ...[
                Text(
                  _errorMessage!,
                  style: const TextStyle(
                      color: AppColors.error,
                      fontSize: 12,
                      fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
              ],

              // Book Button
              CustomButton(
                text: _fareEstimate != null && _fareEstimate!.available
                    ? 'Confirm Auto Booking (₹${_fareEstimate!.estimatedFare.toStringAsFixed(0)})'
                    : 'Select Route to Book',
                icon: Icons.electric_rickshaw,
                isLoading: _isBooking,
                onPressed: _fareEstimate != null && _fareEstimate!.available
                    ? _handleCreateBooking
                    : null,
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }
}
