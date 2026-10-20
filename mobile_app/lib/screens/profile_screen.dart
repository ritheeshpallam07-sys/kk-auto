import 'package:flutter/material.dart';
import '../models/user.dart';
import '../models/driver_profile.dart';
import '../services/api_service.dart';
import '../services/auth_state.dart';
import '../theme/app_colors.dart';
import '../widgets/custom_button.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final AuthState _auth = AuthState();
  final ApiService _api = ApiService();

  User? _user;
  DriverProfile? _driverProfile;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _user = _auth.currentUser;
    _refreshProfile();
  }

  Future<void> _refreshProfile() async {
    setState(() => _isLoading = true);
    try {
      final me = await _api.getMe();
      if (mounted && me != null) {
        setState(() => _user = me);
      }
      if ((me?.isDriver ?? false) || (_user?.isDriver ?? false)) {
        final dp = await _api.getDriverProfile();
        if (mounted) setState(() => _driverProfile = dp);
      }
    } catch (_) {}
    if (mounted) setState(() => _isLoading = false);
  }

  void _showServerSettingsDialog() {
    final controller = TextEditingController(text: _api.baseUrl);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.border),
        ),
        title: const Row(
          children: [
            Icon(Icons.dns_rounded, color: AppColors.accent),
            SizedBox(width: 10),
            Text('Server Endpoint',
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Set the backend API URL for this device:',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                filled: true,
                fillColor: AppColors.cardSecondary,
                hintText: 'http://10.0.2.2:5000/api',
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.accent),
                ),
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              '• Android Emulator: http://10.0.2.2:5000/api\n• Physical Phone: http://<YOUR_PC_IP>:5000/api\n• Web / iOS: http://localhost:5000/api',
              style: TextStyle(
                  color: AppColors.textSecondary, fontSize: 11, height: 1.4),
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
            onPressed: () {
              final newUrl = controller.text.trim();
              if (newUrl.isNotEmpty) {
                _api.setBaseUrl(newUrl);
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    backgroundColor: AppColors.success,
                    content: Text('API URL updated to: $newUrl'),
                  ),
                );
              }
            },
            child: const Text('Save URL',
                style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _handleLogout() async {
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
            Icon(Icons.logout_rounded, color: AppColors.error),
            SizedBox(width: 10),
            Text('Sign Out',
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold)),
          ],
        ),
        content: const Text(
          'Are you sure you want to sign out of your Clik2Go account?',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel',
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
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await _auth.logout();
      if (mounted) {
        Navigator.of(context)
            .pushNamedAndRemoveUntil('/login', (route) => false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = _user ?? _auth.currentUser;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          if (_isLoading)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                      color: AppColors.accent, strokeWidth: 2),
                ),
              ),
            )
          else
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              onPressed: _refreshProfile,
              tooltip: 'Refresh Profile',
            ),
        ],
      ),
      body: user == null
          ? _buildNotLoggedIn()
          : RefreshIndicator(
              color: AppColors.accent,
              backgroundColor: AppColors.card,
              onRefresh: _refreshProfile,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    // Profile Header Card
                    _buildProfileHeader(user),
                    const SizedBox(height: 16),

                    // Contact & Role Information Card
                    _buildDetailsCard(user),
                    const SizedBox(height: 16),

                    // Driver specific info
                    if (user.isDriver) ...[
                      _buildDriverInfoCard(user),
                      const SizedBox(height: 16),
                    ],

                    // Settings & Server Connection Card
                    _buildSettingsCard(),
                    const SizedBox(height: 24),

                    // Sign Out Button
                    CustomButton(
                      text: 'Sign Out',
                      type: ButtonType.danger,
                      icon: Icons.logout_rounded,
                      onPressed: _handleLogout,
                    ),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildNotLoggedIn() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.account_circle_outlined,
                color: AppColors.textSecondary, size: 70),
            const SizedBox(height: 16),
            const Text(
              'No active session found',
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Please log in to manage your profile and view your ride history.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
            ),
            const SizedBox(height: 24),
            CustomButton(
              text: 'Go to Login',
              icon: Icons.login_rounded,
              onPressed: () {
                Navigator.of(context)
                    .pushNamedAndRemoveUntil('/login', (route) => false);
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileHeader(User user) {
    final initials = user.name.isNotEmpty
        ? user.name
            .trim()
            .split(' ')
            .map((p) => p.isNotEmpty ? p[0] : '')
            .take(2)
            .join('')
            .toUpperCase()
        : 'U';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Container(
            width: 76,
            height: 76,
            decoration: BoxDecoration(
              gradient: AppColors.yellowGradient,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: AppColors.accent.withValues(alpha: 0.25),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Center(
              child: Text(
                initials,
                style: const TextStyle(
                  color: AppColors.background,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1,
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            user.name,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.accent.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(20),
              border:
                  Border.all(color: AppColors.accent.withValues(alpha: 0.4)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  user.isAdmin
                      ? Icons.admin_panel_settings_rounded
                      : user.isDriver
                          ? Icons.two_wheeler_rounded
                          : Icons.person_rounded,
                  color: AppColors.accent,
                  size: 14,
                ),
                const SizedBox(width: 6),
                Text(
                  user.role.toUpperCase(),
                  style: const TextStyle(
                    color: AppColors.accent,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.6,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailsCard(User user) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          _buildInfoTile(
            icon: Icons.email_outlined,
            title: 'Email Address',
            value: user.email,
          ),
          const Divider(color: AppColors.border, height: 1),
          _buildInfoTile(
            icon: Icons.phone_outlined,
            title: 'Mobile Number',
            value: user.mobile,
          ),
          const Divider(color: AppColors.border, height: 1),
          _buildInfoTile(
            icon: Icons.verified_user_outlined,
            title: 'Verification Status',
            value: user.isEmailVerified
                ? 'Verified Account'
                : 'Pending Verification',
            valueColor:
                user.isEmailVerified ? AppColors.success : AppColors.warning,
          ),
        ],
      ),
    );
  }

  Widget _buildDriverInfoCard(User user) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.accent.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.directions_car_rounded,
                  color: AppColors.accent, size: 20),
              SizedBox(width: 8),
              Text(
                'Auto Partner Details',
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(color: AppColors.border, height: 1),
          const SizedBox(height: 12),
          _buildDriverDetailRow('Auto Number',
              _driverProfile?.autoNumber ?? user.autoNumber ?? 'Not provided'),
          const SizedBox(height: 8),
          _buildDriverDetailRow('Auto Model',
              _driverProfile?.autoModel ?? user.autoModel ?? 'Not provided'),
          const SizedBox(height: 8),
          _buildDriverDetailRow(
              'Driving License',
              _driverProfile?.licenseNumber ??
                  user.licenseNumber ??
                  'Not provided'),
          const SizedBox(height: 8),
          _buildDriverDetailRow(
              'Partner Approval',
              _driverProfile?.approvalStatus ??
                  user.approvalStatus ??
                  'PENDING',
              isStatus: true),
        ],
      ),
    );
  }

  Widget _buildDriverDetailRow(String label, String value,
      {bool isStatus = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style:
                const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
        if (isStatus)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: AppColors.success, width: 0.8),
            ),
            child: Text(
              value,
              style: const TextStyle(
                  color: AppColors.success,
                  fontSize: 11,
                  fontWeight: FontWeight.bold),
            ),
          )
        else
          Text(
            value,
            style: const TextStyle(
                color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
          ),
      ],
    );
  }

  Widget _buildSettingsCard() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          ListTile(
            leading: const Icon(Icons.dns_rounded, color: AppColors.accent),
            title: const Text('Backend API URL',
                style: TextStyle(color: Colors.white, fontSize: 14)),
            subtitle: Text(
              _api.baseUrl,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style:
                  const TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
            trailing: const Icon(Icons.chevron_right_rounded,
                color: AppColors.textSecondary),
            onTap: _showServerSettingsDialog,
          ),
          const Divider(color: AppColors.border, height: 1),
          const ListTile(
            leading: Icon(Icons.payment_rounded, color: AppColors.accent),
            title: Text('Payment Gateway Mode',
                style: TextStyle(color: Colors.white, fontSize: 14)),
            subtitle: Text('Cashfree Sandbox Environment',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
            trailing: Icon(Icons.check_circle_rounded,
                color: AppColors.success, size: 20),
          ),
          const Divider(color: AppColors.border, height: 1),
          const ListTile(
            leading: Icon(Icons.info_outline_rounded, color: AppColors.accent),
            title: Text('Clik2Go Kadiri',
                style: TextStyle(color: Colors.white, fontSize: 14)),
            subtitle: Text('Version 1.0.0 (Flutter Mobile)',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoTile({
    required IconData icon,
    required String title,
    required String value,
    Color? valueColor,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Icon(icon, color: AppColors.accent, size: 20),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        color: AppColors.textSecondary, fontSize: 11)),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    color: valueColor ?? Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
