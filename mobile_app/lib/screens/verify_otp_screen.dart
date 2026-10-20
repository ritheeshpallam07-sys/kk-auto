import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../services/auth_state.dart';
import '../widgets/custom_button.dart';
import '../widgets/custom_text_field.dart';

class VerifyOtpScreen extends StatefulWidget {
  final String? email;

  const VerifyOtpScreen({super.key, this.email});

  @override
  State<VerifyOtpScreen> createState() => _VerifyOtpScreenState();
}

class _VerifyOtpScreenState extends State<VerifyOtpScreen> {
  final _otpController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;

  String get _targetEmail {
    if (widget.email != null && widget.email!.isNotEmpty) return widget.email!;
    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is String) return args;
    if (args is Map && args['email'] != null) return args['email'].toString();
    return AuthState().currentUser?.email ?? '';
  }

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _handleVerifyOtp() async {
    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      setState(() =>
          _errorMessage = 'Please enter the 6-digit code sent to your email.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final auth = AuthState();
    final res = await auth.verifyEmailOtp(_targetEmail, otp);

    setState(() => _isLoading = false);

    if (!mounted) return;

    if (res['success'] == true) {
      final role = auth.currentUser?.role ?? 'customer';
      if (role == 'driver') {
        Navigator.pushReplacementNamed(context, '/driver');
      } else if (role == 'admin') {
        Navigator.pushReplacementNamed(context, '/admin');
      } else {
        Navigator.pushReplacementNamed(context, '/home');
      }
    } else {
      setState(() {
        _errorMessage =
            res['error'] ?? 'Invalid or expired OTP. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Email Verification'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.accentMuted,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.accent, width: 2),
                  ),
                  child: const Icon(Icons.mark_email_read_outlined,
                      size: 36, color: AppColors.accent),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Verify Your Email Address',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              RichText(
                text: TextSpan(
                  style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      height: 1.5),
                  children: [
                    const TextSpan(
                        text:
                            'We have sent a 6-digit verification security code to\n'),
                    TextSpan(
                      text: _targetEmail,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: AppColors.accent,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),
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
                const SizedBox(height: 20),
              ],
              CustomTextField(
                controller: _otpController,
                label: '6-Digit Verification Code',
                hintText: 'Enter 6 digits (e.g. 123456)',
                prefixIcon: Icons.security,
                keyboardType: TextInputType.number,
                onChanged: (v) {
                  if (v.trim().length == 6) {
                    _handleVerifyOtp();
                  }
                },
              ),
              const SizedBox(height: 28),
              CustomButton(
                text: 'Verify & Continue',
                icon: Icons.check_circle_outline,
                isLoading: _isLoading,
                onPressed: _handleVerifyOtp,
              ),
              const SizedBox(height: 24),
              Center(
                child: TextButton.icon(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                            'A fresh verification OTP has been dispatched to your email.'),
                        backgroundColor: AppColors.cardElevated,
                      ),
                    );
                  },
                  icon: const Icon(Icons.refresh,
                      size: 16, color: AppColors.accent),
                  label: const Text(
                    'Resend Verification Code',
                    style: TextStyle(
                      color: AppColors.accent,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
