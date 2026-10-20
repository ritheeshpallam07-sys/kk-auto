import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../services/auth_state.dart';
import '../services/api_service.dart';
import '../widgets/status_badge.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ApiService _api = ApiService();
  int _navIndex = 0;

  @override
  void initState() {
    super.initState();
    _refreshData();
  }

  Future<void> _refreshData() async {
    await AuthState().loadActiveBooking();
  }

  void _showOutstationModal() {
    final nameCtrl =
        TextEditingController(text: AuthState().currentUser?.name ?? '');
    final phoneCtrl =
        TextEditingController(text: AuthState().currentUser?.mobile ?? '');
    final placeCtrl = TextEditingController();
    final membersCtrl = TextEditingController(text: '4');
    final daysCtrl = TextEditingController(text: '1');
    final dateCtrl = TextEditingController(
        text: DateTime.now()
            .add(const Duration(days: 1))
            .toString()
            .split(' ')[0]);
    final timeCtrl = TextEditingController(text: '06:00 AM');
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(context).viewInsets.bottom + 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      '🚗 Outstation Car / Trip Booking',
                      style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: AppColors.accent),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: AppColors.textMuted),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'Book round-trip & outstation cabs with personal drivers. Platform owner reviews and provides fixed quote.',
                  style:
                      TextStyle(fontSize: 11, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: placeCtrl,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: const InputDecoration(
                      labelText: 'Trip Destination (e.g. Tirupati, Bangalore)'),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: membersCtrl,
                        keyboardType: TextInputType.number,
                        style:
                            const TextStyle(color: Colors.white, fontSize: 13),
                        decoration: const InputDecoration(
                            labelText: 'Passengers (1-7)'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: daysCtrl,
                        keyboardType: TextInputType.number,
                        style:
                            const TextStyle(color: Colors.white, fontSize: 13),
                        decoration:
                            const InputDecoration(labelText: 'Days Duration'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: dateCtrl,
                        style:
                            const TextStyle(color: Colors.white, fontSize: 13),
                        decoration: const InputDecoration(
                            labelText: 'Trip Date (YYYY-MM-DD)'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: timeCtrl,
                        style:
                            const TextStyle(color: Colors.white, fontSize: 13),
                        decoration:
                            const InputDecoration(labelText: 'Pickup Time'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: isSubmitting
                        ? null
                        : () async {
                            if (placeCtrl.text.trim().isEmpty) return;
                            setModalState(() => isSubmitting = true);
                            final res = await _api.createTripBooking(
                              customerName: nameCtrl.text.trim(),
                              phoneNumber: phoneCtrl.text.trim(),
                              members: int.tryParse(membersCtrl.text) ?? 4,
                              tripPlace: placeCtrl.text.trim(),
                              days: int.tryParse(daysCtrl.text) ?? 1,
                              tripDate: dateCtrl.text.trim(),
                              pickupTime: timeCtrl.text.trim(),
                            );
                            setModalState(() => isSubmitting = false);
                            if (res != null && mounted) {
                              Navigator.pop(ctx);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  backgroundColor: AppColors.success,
                                  content: Text(
                                      'Trip booking #${res.bookingReference} requested! We will call you with a quote.'),
                                ),
                              );
                            }
                          },
                    child: isSubmitting
                        ? const CircularProgressIndicator(color: Colors.black)
                        : const Text('Submit Trip Request',
                            style: TextStyle(fontWeight: FontWeight.w900)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = AuthState();
    final user = auth.currentUser;
    final activeRide = auth.activeBooking;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                gradient: AppColors.accentGradient,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Center(
                  child: Text('🛺', style: TextStyle(fontSize: 18))),
            ),
            const SizedBox(width: 10),
            const Text(
              'Clik2Go',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            onPressed: _refreshData,
          ),
          IconButton(
            icon: const Icon(Icons.person_outline, color: AppColors.accent),
            onPressed: () => Navigator.pushNamed(context, '/profile'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refreshData,
        color: AppColors.accent,
        backgroundColor: AppColors.card,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // User Greeting Banner
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: AppColors.darkCardGradient,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: AppColors.border, width: 1),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'HELLO, ${user?.name.split(' ').first.toUpperCase() ?? 'COMMUTER'} 👋',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: AppColors.accent,
                            letterSpacing: 1.0,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.accentMuted,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            'PRO ACCOUNT',
                            style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w900,
                                color: AppColors.accent),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Where do you want to ride today?',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: AppColors.textPrimary,
                        letterSpacing: -0.3,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // ACTIVE ONGOING RIDE BANNER (if active)
              if (activeRide != null) ...[
                GestureDetector(
                  onTap: () {
                    Navigator.pushNamed(
                      context,
                      '/tracking',
                      arguments: {'bookingId': activeRide.id},
                    );
                  },
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.accent, width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.accent.withValues(alpha: 0.15),
                          blurRadius: 16,
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
                            Row(
                              children: [
                                Container(
                                  width: 8,
                                  height: 8,
                                  decoration: const BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: AppColors.accent,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                const Text(
                                  'ONGOING ACTIVE RIDE',
                                  style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w900,
                                      color: AppColors.accent),
                                ),
                              ],
                            ),
                            StatusBadge(status: activeRide.status),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          '${activeRide.pickupAddress} → ${activeRide.destinationAddress}',
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Colors.white),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Fare: ₹${activeRide.estimatedFare.toStringAsFixed(0)}',
                              style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w900,
                                  color: AppColors.accent),
                            ),
                            Row(
                              children: const [
                                Text('Live Tracking',
                                    style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800,
                                        color: AppColors.accent)),
                                SizedBox(width: 4),
                                Icon(Icons.arrow_forward,
                                    size: 14, color: AppColors.accent),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),
              ],

              // Quick Booking Services
              const Text(
                'Services',
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary),
              ),
              const SizedBox(height: 12),

              Row(
                children: [
                  // Book City Auto
                  Expanded(
                    child: GestureDetector(
                      onTap: () => Navigator.pushNamed(context, '/book'),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.card,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                              color: AppColors.borderHighlight, width: 1.5),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: AppColors.accentMuted,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Center(
                                  child: Text('🛺',
                                      style: TextStyle(fontSize: 22))),
                            ),
                            const SizedBox(height: 14),
                            const Text(
                              'City Auto Ride',
                              style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              'Fixed configured fares',
                              style: TextStyle(
                                  fontSize: 11, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),

                  // Outstation Cab
                  Expanded(
                    child: GestureDetector(
                      onTap: _showOutstationModal,
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.card,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: AppColors.border, width: 1),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: const Color(0xFF1E293B),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Center(
                                  child: Text('🚗',
                                      style: TextStyle(fontSize: 22))),
                            ),
                            const SizedBox(height: 14),
                            const Text(
                              'Outstation Trip',
                              style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              'Day & multi-day trips',
                              style: TextStyle(
                                  fontSize: 11, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Popular Fixed Routes (Admin Configured Fares)
              const Text(
                'Popular Fixed Routes in Anantapur',
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary),
              ),
              const SizedBox(height: 10),

              _buildRouteChip('JNTUA ↔ Cross', '₹20 fixed', () {
                Navigator.pushNamed(context, '/book', arguments: {
                  'from': 'JNTUA',
                  'to': 'Cross',
                });
              }),
              const SizedBox(height: 8),
              _buildRouteChip('JNTUA ↔ Bus Stand', '₹25 fixed', () {
                Navigator.pushNamed(context, '/book', arguments: {
                  'from': 'JNTUA',
                  'to': 'Bus Stand',
                });
              }),
              const SizedBox(height: 8),
              _buildRouteChip('Bus Stand ↔ Railway Station', 'Configured Fare',
                  () {
                Navigator.pushNamed(context, '/book', arguments: {
                  'from': 'Bus Stand',
                  'to': 'Railway Station',
                });
              }),
            ],
          ),
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _navIndex,
        onTap: (index) {
          setState(() => _navIndex = index);
          if (index == 1) Navigator.pushNamed(context, '/book');
          if (index == 2) Navigator.pushNamed(context, '/my-rides');
          if (index == 3) Navigator.pushNamed(context, '/profile');
        },
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_filled), label: 'Home'),
          BottomNavigationBarItem(
              icon: Icon(Icons.electric_rickshaw), label: 'Book Auto'),
          BottomNavigationBarItem(icon: Icon(Icons.history), label: 'My Rides'),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }

  Widget _buildRouteChip(String route, String fareBadge, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                const Icon(Icons.pin_drop, size: 16, color: AppColors.accent),
                const SizedBox(width: 10),
                Text(
                  route,
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Colors.white),
                ),
              ],
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.accentMuted,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                fareBadge,
                style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: AppColors.accent),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
