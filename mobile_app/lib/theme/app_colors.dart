import 'package:flutter/material.dart';

class AppColors {
  // Main Theme Palette: Black + Yellow Premium
  static const Color background = Color(0xFF080B10);
  static const Color card = Color(0xFF111722);
  static const Color cardSecondary = Color(0xFF161F2E);
  static const Color cardElevated = Color(0xFF182030);
  static const Color cardHover = Color(0xFF202A3D);

  // Accent Yellow (Auto Gold)
  static const Color accent = Color(0xFFFFD400);
  static const Color accentLight = Color(0xFFFFDE33);
  static const Color accentHover = Color(0xFFFFDE33);
  static const Color accentMuted = Color(0x33FFD400);
  static const Color accentDark = Color(0xFFE5BE00);

  // Typography
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFF8E9BAE);
  static const Color textMuted = Color(0xFF5A667A);

  // Borders & Dividers
  static const Color border = Color(0xFF1E2838);
  static const Color borderHighlight = Color(0x44FFD400);
  static const Color divider = Color(0xFF161F2E);

  // Status Colors
  static const Color success = Color(0xFF10B981);
  static const Color successBg = Color(0x2010B981);
  static const Color error = Color(0xFFEF4444);
  static const Color errorBg = Color(0x20EF4444);
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningBg = Color(0x20F59E0B);
  static const Color info = Color(0xFF3B82F6);
  static const Color infoBg = Color(0x203B82F6);

  // Gradients
  static const LinearGradient accentGradient = LinearGradient(
    colors: [Color(0xFFFFD400), Color(0xFFFFB800)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient yellowGradient = LinearGradient(
    colors: [Color(0xFFFFD400), Color(0xFFFFB800)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient darkCardGradient = LinearGradient(
    colors: [Color(0xFF111722), Color(0xFF0C111A)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}
