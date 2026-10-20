import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class StatusBadge extends StatelessWidget {
  final String status;
  final bool isLarge;

  const StatusBadge({
    super.key,
    required this.status,
    this.isLarge = false,
  });

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    IconData icon;

    switch (status) {
      case 'Searching for Auto':
        bg = AppColors.accentMuted;
        fg = AppColors.accent;
        icon = Icons.radar;
        break;
      case 'Driver Assigned':
        bg = AppColors.infoBg;
        fg = AppColors.info;
        icon = Icons.check_circle_outline;
        break;
      case 'Driver Arriving':
        bg = AppColors.infoBg;
        fg = const Color(0xFF06B6D4);
        icon = Icons.navigation_outlined;
        break;
      case 'Ride Started':
        bg = const Color(0x336366F1);
        fg = const Color(0xFF818CF8);
        icon = Icons.electric_rickshaw;
        break;
      case 'Ride Completed':
      case 'APPROVED':
      case 'ACTIVE':
      case 'PAID':
      case 'CONFIRMED':
        bg = AppColors.successBg;
        fg = AppColors.success;
        icon = Icons.check_circle;
        break;
      case 'Cancelled':
      case 'REJECTED':
      case 'FAILED':
        bg = AppColors.errorBg;
        fg = AppColors.error;
        icon = Icons.cancel_outlined;
        break;
      case 'PENDING':
      case 'NEW':
      default:
        bg = AppColors.warningBg;
        fg = AppColors.warning;
        icon = Icons.access_time;
        break;
    }

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: isLarge ? 12 : 8,
        vertical: isLarge ? 6 : 4,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: fg.withValues(alpha: 0.3), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: isLarge ? 14 : 11, color: fg),
          const SizedBox(width: 5),
          Text(
            status,
            style: TextStyle(
              color: fg,
              fontSize: isLarge ? 12 : 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}
