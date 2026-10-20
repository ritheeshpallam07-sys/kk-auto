import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../services/auth_state.dart';
import '../widgets/custom_button.dart';
import '../widgets/custom_text_field.dart';

class RegisterScreen extends StatefulWidget {
  final String initialRole;

  const RegisterScreen({super.key, this.initialRole = 'customer'});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  late String _selectedRole;

  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _mobileController = TextEditingController();
  final _passwordController = TextEditingController();

  // Driver fields
  final _autoNumberController = TextEditingController();
  final _autoModelController = TextEditingController();
  final _licenseController = TextEditingController();

  bool _isLoading = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _selectedRole = widget.initialRole;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _mobileController.dispose();
    _passwordController.dispose();
    _autoNumberController.dispose();
    _autoModelController.dispose();
    _licenseController.dispose();
    super.dispose();
  }

  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final auth = AuthState();
    final res = await auth.register(
      name: _nameController.text.trim(),
      email: _emailController.text.trim(),
      mobile: _mobileController.text.trim(),
      password: _passwordController.text,
      role: _selectedRole,
      autoNumber: _selectedRole == 'driver'
          ? _autoNumberController.text.trim().toUpperCase()
          : null,
      autoModel:
          _selectedRole == 'driver' ? _autoModelController.text.trim() : null,
      licenseNumber: _selectedRole == 'driver'
          ? _licenseController.text.trim().toUpperCase()
          : null,
    );

    setState(() => _isLoading = false);

    if (!mounted) return;

    if (res['success'] == true) {
      // Check if email OTP verification required
      if (res['requiresVerification'] == true ||
          res['data']?['requiresVerification'] == true) {
        Navigator.pushReplacementNamed(
          context,
          '/verify-otp',
          arguments: {'email': _emailController.text.trim()},
        );
      } else {
        if (_selectedRole == 'driver') {
          Navigator.pushReplacementNamed(context, '/driver');
        } else {
          Navigator.pushReplacementNamed(context, '/home');
        }
      }
    } else {
      setState(() {
        _errorMessage =
            res['error'] ?? 'Registration failed. Please check your details.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_selectedRole == 'driver'
            ? 'Driver Partner Registration'
            : 'Create Account'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Role Switcher Tab
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      _buildRoleOption(
                          'customer', 'Customer Account', Icons.person),
                      _buildRoleOption(
                          'driver', 'Driver Partner', Icons.electric_rickshaw),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                if (_errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.errorBg,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: AppColors.error.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline,
                            size: 18, color: AppColors.error),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _errorMessage!,
                            style: const TextStyle(
                                color: AppColors.error, fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                CustomTextField(
                  controller: _nameController,
                  label: 'Full Name',
                  hintText: 'e.g. Ramesh Kumar',
                  prefixIcon: Icons.badge_outlined,
                  textCapitalization: TextCapitalization.words,
                  validator: (v) => v == null || v.trim().isEmpty
                      ? 'Please enter your full name'
                      : null,
                ),
                const SizedBox(height: 16),

                CustomTextField(
                  controller: _emailController,
                  label: 'Email Address (OTP Verification)',
                  hintText: 'e.g. ramesh@example.com',
                  prefixIcon: Icons.email_outlined,
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) => v == null || !v.contains('@')
                      ? 'Enter a valid email address'
                      : null,
                ),
                const SizedBox(height: 16),

                CustomTextField(
                  controller: _mobileController,
                  label: '10-Digit Mobile Number',
                  hintText: 'e.g. 9876543210',
                  prefixIcon: Icons.phone_android,
                  keyboardType: TextInputType.phone,
                  validator: (v) => v == null || v.trim().length < 10
                      ? 'Enter a valid 10-digit mobile number'
                      : null,
                ),
                const SizedBox(height: 16),

                CustomTextField(
                  controller: _passwordController,
                  label: 'Password',
                  hintText: 'At least 6 characters',
                  prefixIcon: Icons.lock_outline,
                  obscureText: _obscurePassword,
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                      color: AppColors.textMuted,
                      size: 20,
                    ),
                    onPressed: () =>
                        setState(() => _obscurePassword = !_obscurePassword),
                  ),
                  validator: (v) => v == null || v.length < 6
                      ? 'Password must be at least 6 characters'
                      : null,
                ),
                const SizedBox(height: 20),

                // Driver specific fields
                if (_selectedRole == 'driver') ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.borderHighlight),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: const [
                            Icon(Icons.verified_user,
                                color: AppColors.accent, size: 18),
                            SizedBox(width: 8),
                            Text(
                              'Driver Partner Credentials',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: AppColors.accent,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        CustomTextField(
                          controller: _autoNumberController,
                          label: 'Auto Registration Number',
                          hintText: 'e.g. AP04TT1234',
                          prefixIcon: Icons.numbers,
                          textCapitalization: TextCapitalization.characters,
                          validator: (v) => _selectedRole == 'driver' &&
                                  (v == null || v.trim().isEmpty)
                              ? 'Enter auto registration plate number'
                              : null,
                        ),
                        const SizedBox(height: 14),
                        CustomTextField(
                          controller: _autoModelController,
                          label: 'Auto Model / Make',
                          hintText: 'e.g. Bajaj RE Compact 4S',
                          prefixIcon: Icons.electric_rickshaw,
                          validator: (v) => _selectedRole == 'driver' &&
                                  (v == null || v.trim().isEmpty)
                              ? 'Enter auto model'
                              : null,
                        ),
                        const SizedBox(height: 14),
                        CustomTextField(
                          controller: _licenseController,
                          label: 'Driving License Number',
                          hintText: 'e.g. DL-0420110012345',
                          prefixIcon: Icons.drive_file_rename_outline,
                          textCapitalization: TextCapitalization.characters,
                          validator: (v) => _selectedRole == 'driver' &&
                                  (v == null || v.trim().isEmpty)
                              ? 'Enter driving license number'
                              : null,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],

                CustomButton(
                  text: _selectedRole == 'driver'
                      ? 'Register as Driver Partner'
                      : 'Create My Account',
                  icon: Icons.person_add_alt_1,
                  isLoading: _isLoading,
                  onPressed: _handleRegister,
                ),
                const SizedBox(height: 24),

                Center(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text('Already have an account? ',
                          style: TextStyle(
                              color: AppColors.textSecondary, fontSize: 13)),
                      InkWell(
                        onTap: () => Navigator.pop(context),
                        child: const Text('Sign In',
                            style: TextStyle(
                                color: AppColors.accent,
                                fontWeight: FontWeight.w800,
                                fontSize: 13)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRoleOption(String role, String label, IconData icon) {
    final isSelected = _selectedRole == role;

    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedRole = role),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.accent : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon,
                  size: 16,
                  color: isSelected
                      ? const Color(0xFF080B10)
                      : AppColors.textSecondary),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: isSelected
                      ? const Color(0xFF080B10)
                      : AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
