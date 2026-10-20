import 'package:flutter/material.dart';
import '../models/admin_stats.dart';
import '../models/booking.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../widgets/custom_button.dart';
import '../widgets/metric_card.dart';
import '../widgets/status_badge.dart';
import 'profile_screen.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen>
    with SingleTickerProviderStateMixin {
  final ApiService _api = ApiService();
  late TabController _tabController;

  bool _isLoading = true;
  String? _errorMessage;

  AdminStats? _stats;
  PlatformFinancials? _financials;
  List<dynamic> _drivers = [];
  Map<String, dynamic> _settlementData = {};
  List<FareRoute> _fareRoutes = [];
  List<Booking> _allBookings = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    _loadAllAdminData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadAllAdminData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final futures = await Future.wait([
        _api.getAdminDashboard(),
        _api.getAdminFinancials(),
        _api.getAdminDrivers(),
        _api.getSettlements(),
        _api.getFareRoutes(),
        _api.getAllBookings(),
      ]);

      if (mounted) {
        setState(() {
          _stats = futures[0] as AdminStats?;
          _financials = futures[1] as PlatformFinancials?;
          _drivers = futures[2] as List<dynamic>;
          _settlementData = futures[3] as Map<String, dynamic>;
          _fareRoutes = futures[4] as List<FareRoute>;
          _allBookings = futures[5] as List<Booking>;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Failed to load admin data: $e';
        });
      }
    }
  }

  Future<void> _handleDriverApproval(int driverId, String status) async {
    setState(() => _isLoading = true);
    final ok = await _api.updateDriverApproval(driverId, status);
    if (ok) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor:
                status == 'APPROVED' ? AppColors.success : AppColors.error,
            content: Text('Driver status updated to $status.'),
          ),
        );
      }
      await _loadAllAdminData();
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              backgroundColor: AppColors.error,
              content: Text('Action failed.')),
        );
      }
      setState(() => _isLoading = false);
    }
  }

  Future<void> _handleSettleDriver(int driverId, String driverName) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.border),
        ),
        title: const Text('Confirm Settlement',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: Text(
          'Mark all pending earnings for $driverName as settled in Cashfree / records?',
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel',
                style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.accent,
              foregroundColor: AppColors.background,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Settle Now',
                style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      setState(() => _isLoading = true);
      final ok = await _api.settleDriverPayout(driverId);
      if (ok) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              backgroundColor: AppColors.success,
              content: Text('Payout settlement completed successfully.'),
            ),
          );
        }
        await _loadAllAdminData();
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                backgroundColor: AppColors.error,
                content: Text('Settlement failed.')),
          );
        }
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _handleToggleRoute(int routeId) async {
    final ok = await _api.toggleRoute(routeId);
    if (ok) {
      final routes = await _api.getFareRoutes();
      if (mounted) setState(() => _fareRoutes = routes);
    }
  }

  void _showEditFareDialog(FareRoute route) {
    final controller =
        TextEditingController(text: route.fare.toStringAsFixed(0));
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.border),
        ),
        title: const Text('Update Route Fare',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${route.fromLocation} ⇄ ${route.toLocation}',
              style: const TextStyle(
                  color: AppColors.accent,
                  fontSize: 13,
                  fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              keyboardType: TextInputType.number,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                labelText: 'Fare Amount (₹)',
                labelStyle: const TextStyle(color: AppColors.textSecondary),
                filled: true,
                fillColor: AppColors.cardSecondary,
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.accent),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel',
                style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.accent,
              foregroundColor: AppColors.background,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () async {
              final newFare = double.tryParse(controller.text.trim());
              if (newFare != null && newFare > 0) {
                Navigator.pop(ctx);
                final ok = await _api.updateFareRoute(route.id, newFare);
                if (ok) {
                  final routes = await _api.getFareRoutes();
                  if (mounted) setState(() => _fareRoutes = routes);
                }
              }
            },
            child: const Text('Save Fare',
                style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _showAddRouteDialog() {
    final fromController = TextEditingController();
    final toController = TextEditingController();
    final fareController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.border),
        ),
        title: const Text('Add Configured Route',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: fromController,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  labelText: 'From Location / Area',
                  labelStyle: const TextStyle(color: AppColors.textSecondary),
                  hintText: 'e.g. Kadiri Bus Stand',
                  hintStyle: const TextStyle(
                      color: AppColors.textSecondary, fontSize: 12),
                  filled: true,
                  fillColor: AppColors.cardSecondary,
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: toController,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  labelText: 'To Location / Area',
                  labelStyle: const TextStyle(color: AppColors.textSecondary),
                  hintText: 'e.g. JNTUA College',
                  hintStyle: const TextStyle(
                      color: AppColors.textSecondary, fontSize: 12),
                  filled: true,
                  fillColor: AppColors.cardSecondary,
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: fareController,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  labelText: 'Configured Fare (₹)',
                  labelStyle: const TextStyle(color: AppColors.textSecondary),
                  hintText: 'e.g. 50',
                  hintStyle: const TextStyle(
                      color: AppColors.textSecondary, fontSize: 12),
                  filled: true,
                  fillColor: AppColors.cardSecondary,
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel',
                style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.accent,
              foregroundColor: AppColors.background,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () async {
              final from = fromController.text.trim();
              final to = toController.text.trim();
              final fare = double.tryParse(fareController.text.trim());
              if (from.isNotEmpty &&
                  to.isNotEmpty &&
                  fare != null &&
                  fare > 0) {
                Navigator.pop(ctx);
                final ok = await _api.addRoute(from, to, fare);
                if (ok) {
                  final routes = await _api.getFareRoutes();
                  if (mounted) setState(() => _fareRoutes = routes);
                }
              }
            },
            child: const Text('Add Route',
                style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Admin Console'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_outline_rounded),
            tooltip: 'Profile',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const ProfileScreen()),
              ).then((_) => _loadAllAdminData());
            },
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: _loadAllAdminData,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          indicatorColor: AppColors.accent,
          indicatorWeight: 3,
          labelColor: AppColors.accent,
          unselectedLabelColor: AppColors.textSecondary,
          labelStyle:
              const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
          tabAlignment: TabAlignment.start,
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Drivers'),
            Tab(text: 'Settlements'),
            Tab(text: 'Routes & Fares'),
            Tab(text: 'Bookings'),
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
                  children: [
                    _buildOverviewTab(),
                    _buildDriversTab(),
                    _buildSettlementsTab(),
                    _buildRoutesTab(),
                    _buildBookingsTab(),
                  ],
                ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded,
                color: AppColors.error, size: 50),
            const SizedBox(height: 14),
            Text(_errorMessage ?? 'Failed to load admin data',
                style: const TextStyle(color: Colors.white, fontSize: 15)),
            const SizedBox(height: 18),
            CustomButton(text: 'Retry', onPressed: _loadAllAdminData),
          ],
        ),
      ),
    );
  }

  // ---------------- TAB 1: OVERVIEW ----------------
  Widget _buildOverviewTab() {
    final metrics = _stats?.metrics;
    final fin = _financials ?? _stats?.financials;

    return RefreshIndicator(
      color: AppColors.accent,
      backgroundColor: AppColors.card,
      onRefresh: _loadAllAdminData,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Operational Metrics',
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: MetricCard(
                    title: 'Total Bookings',
                    value: '${metrics?.totalBookings ?? _allBookings.length}',
                    icon: Icons.local_taxi_rounded,
                    iconColor: AppColors.accent,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: MetricCard(
                    title: 'Active Rides',
                    value: '${metrics?.activeBookings ?? 0}',
                    icon: Icons.navigation_rounded,
                    iconColor: AppColors.accentLight,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: MetricCard(
                    title: 'Active Drivers',
                    value: '${metrics?.totalDrivers ?? _drivers.length}',
                    icon: Icons.two_wheeler_rounded,
                    iconColor: AppColors.success,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: MetricCard(
                    title: 'Pending Approval',
                    value: '${metrics?.pendingDrivers ?? 0}',
                    icon: Icons.hourglass_empty_rounded,
                    iconColor: AppColors.warning,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Financial Breakdown Card
            const Text(
              'Platform Financials (Cashfree)',
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  _buildFinancialRow(
                    'Gross Customer Volume',
                    '₹${fin?.totalGrossVolume.toStringAsFixed(0) ?? "0"}',
                    isHighlight: true,
                  ),
                  const Divider(color: AppColors.border, height: 20),
                  _buildFinancialRow(
                    'Platform Commission (Owner)',
                    '₹${fin?.ownerCommissionEarned.toStringAsFixed(0) ?? "0"}',
                    color: AppColors.accent,
                  ),
                  const Divider(color: AppColors.border, height: 20),
                  _buildFinancialRow(
                    'Settled to Drivers',
                    '₹${fin?.settledPayoutsAmount.toStringAsFixed(0) ?? "0"}',
                    color: AppColors.success,
                  ),
                  const Divider(color: AppColors.border, height: 20),
                  _buildFinancialRow(
                    'Pending Driver Settlements',
                    '₹${fin?.pendingSettlementsAmount.toStringAsFixed(0) ?? "0"}',
                    color: AppColors.warning,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildFinancialRow(String title, String amount,
      {bool isHighlight = false, Color? color}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title,
            style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: isHighlight ? 14 : 13)),
        Text(
          amount,
          style: TextStyle(
            color: color ?? Colors.white,
            fontSize: isHighlight ? 18 : 15,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  // ---------------- TAB 2: DRIVERS ----------------
  Widget _buildDriversTab() {
    if (_drivers.isEmpty) {
      return const Center(
          child: Text('No registered drivers found.',
              style: TextStyle(color: AppColors.textSecondary)));
    }

    return RefreshIndicator(
      color: AppColors.accent,
      backgroundColor: AppColors.card,
      onRefresh: _loadAllAdminData,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _drivers.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final d = _drivers[index];
          final id =
              d['id'] is int ? d['id'] : int.tryParse(d['id'].toString()) ?? 0;
          final name = d['name'] ?? 'Driver #$id';
          final mobile = d['mobile'] ?? '';
          final autoNumber = d['auto_number'] ?? 'N/A';
          final autoModel = d['auto_model'] ?? 'Auto';
          final status =
              (d['approval_status'] ?? 'PENDING').toString().toUpperCase();
          final isPending = status == 'PENDING';
          final isApproved = status == 'APPROVED' || status == 'ACTIVE';

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
                    Text(name,
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold)),
                    StatusBadge(status: status),
                  ],
                ),
                const SizedBox(height: 6),
                Text('$autoNumber • $autoModel',
                    style: const TextStyle(
                        color: AppColors.textSecondary, fontSize: 12)),
                if (mobile.isNotEmpty)
                  Text('Phone: $mobile',
                      style: const TextStyle(
                          color: AppColors.textSecondary, fontSize: 12)),
                const SizedBox(height: 14),

                // Approval Actions
                if (isPending) ...[
                  Row(
                    children: [
                      Expanded(
                        child: CustomButton(
                          text: 'Approve',
                          icon: Icons.check_circle_outline_rounded,
                          onPressed: () =>
                              _handleDriverApproval(id, 'APPROVED'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: CustomButton(
                          text: 'Reject',
                          type: ButtonType.danger,
                          icon: Icons.cancel_outlined,
                          onPressed: () =>
                              _handleDriverApproval(id, 'REJECTED'),
                        ),
                      ),
                    ],
                  ),
                ] else if (isApproved) ...[
                  Row(
                    children: [
                      Expanded(
                        child: CustomButton(
                          text: 'Suspend Partner',
                          type: ButtonType.danger,
                          icon: Icons.block_flipped,
                          onPressed: () =>
                              _handleDriverApproval(id, 'SUSPENDED'),
                        ),
                      ),
                    ],
                  ),
                ] else ...[
                  Row(
                    children: [
                      Expanded(
                        child: CustomButton(
                          text: 'Re-activate Partner',
                          icon: Icons.restore_rounded,
                          onPressed: () =>
                              _handleDriverApproval(id, 'APPROVED'),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  // ---------------- TAB 3: SETTLEMENTS ----------------
  Widget _buildSettlementsTab() {
    final pendingDrivers = (_settlementData['pendingDrivers'] as List?) ?? [];

    return RefreshIndicator(
      color: AppColors.accent,
      backgroundColor: AppColors.card,
      onRefresh: _loadAllAdminData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppColors.card,
                  AppColors.accent.withValues(alpha: 0.1),
                ],
              ),
              borderRadius: BorderRadius.circular(18),
              border:
                  Border.all(color: AppColors.accent.withValues(alpha: 0.4)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Total Pending Settlements',
                        style: TextStyle(
                            color: AppColors.textSecondary, fontSize: 12)),
                    const SizedBox(height: 4),
                    Text(
                      '₹${_settlementData['totalPendingAmount']?.toString() ?? "0"}',
                      style: const TextStyle(
                          color: AppColors.accent,
                          fontSize: 24,
                          fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const Icon(Icons.account_balance_wallet_rounded,
                    color: AppColors.accent, size: 36),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Driver Balances Pending Payout',
            style: TextStyle(
                color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          if (pendingDrivers.isEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border),
              ),
              child: const Center(
                child: Text(
                  'All driver earnings are fully settled.',
                  style:
                      TextStyle(color: AppColors.textSecondary, fontSize: 14),
                ),
              ),
            )
          else
            ...pendingDrivers.map((driver) {
              final id = driver['driver_id'] ?? driver['id'] ?? 0;
              final name =
                  driver['driver_name'] ?? driver['name'] ?? 'Driver #$id';
              final amount = double.tryParse(
                      driver['pending_amount']?.toString() ?? '0') ??
                  0.0;
              final upi = driver['payout_upi'] ?? 'UPI not configured';

              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name,
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15)),
                          const SizedBox(height: 2),
                          Text('UPI: $upi',
                              style: const TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 11)),
                          const SizedBox(height: 6),
                          Text(
                            'Pending: ₹${amount.toStringAsFixed(0)}',
                            style: const TextStyle(
                                color: AppColors.accent,
                                fontWeight: FontWeight.bold,
                                fontSize: 14),
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.accent,
                        foregroundColor: AppColors.background,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: () => _handleSettleDriver(id, name),
                      child: const Text('Settle',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  // ---------------- TAB 4: ROUTES & FARES ----------------
  Widget _buildRoutesTab() {
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.accent,
        foregroundColor: AppColors.background,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add Route',
            style: TextStyle(fontWeight: FontWeight.bold)),
        onPressed: _showAddRouteDialog,
      ),
      body: RefreshIndicator(
        color: AppColors.accent,
        backgroundColor: AppColors.card,
        onRefresh: _loadAllAdminData,
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: _fareRoutes.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final route = _fareRoutes[index];

            return Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${route.fromLocation} ⇄ ${route.toLocation}',
                          style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 14),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Configured Fare: ₹${route.fare.toStringAsFixed(0)}',
                          style: const TextStyle(
                              color: AppColors.accent,
                              fontSize: 13,
                              fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.edit_outlined,
                        color: AppColors.accent),
                    tooltip: 'Edit Fare',
                    onPressed: () => _showEditFareDialog(route),
                  ),
                  Switch(
                    value: route.isActive,
                    activeThumbColor: AppColors.accent,
                    onChanged: (_) => _handleToggleRoute(route.id),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  // ---------------- TAB 5: BOOKINGS ----------------
  Widget _buildBookingsTab() {
    if (_allBookings.isEmpty) {
      return const Center(
          child: Text('No bookings recorded.',
              style: TextStyle(color: AppColors.textSecondary)));
    }

    return RefreshIndicator(
      color: AppColors.accent,
      backgroundColor: AppColors.card,
      onRefresh: _loadAllAdminData,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _allBookings.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final b = _allBookings[index];

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
                      b.bookingReference,
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 14),
                    ),
                    StatusBadge(status: b.status),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  'Customer: ${b.customerName ?? "User"} (${b.customerMobile ?? ""})',
                  style: const TextStyle(
                      color: AppColors.textSecondary, fontSize: 12),
                ),
                if (b.driverName != null)
                  Text(
                    'Driver: ${b.driverName} (${b.autoNumber ?? ""})',
                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                const SizedBox(height: 8),
                Text(
                  '${b.pickupAddress} ➔ ${b.destinationAddress}',
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      b.pickupDatetime,
                      style: const TextStyle(
                          color: AppColors.textSecondary, fontSize: 11),
                    ),
                    Text(
                      '₹${b.estimatedFare.toStringAsFixed(0)}',
                      style: const TextStyle(
                          color: AppColors.accent,
                          fontSize: 16,
                          fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
