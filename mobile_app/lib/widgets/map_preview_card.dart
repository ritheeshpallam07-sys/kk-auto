import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class MapPreviewCard extends StatelessWidget {
  final String pickupAddress;
  final String destinationAddress;
  final double? distanceKm;
  final String? durationText;
  final VoidCallback? onOpenMaps;
  final double? fare;

  const MapPreviewCard({
    super.key,
    String? pickupAddress,
    String? destinationAddress,
    String? fromLocation,
    String? toLocation,
    this.distanceKm,
    this.durationText,
    this.onOpenMaps,
    this.fare,
  })  : pickupAddress = pickupAddress ?? fromLocation ?? '',
        destinationAddress = destinationAddress ?? toLocation ?? '';

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          // Simulated Dark Vector Map Canvas
          Container(
            height: 180,
            width: double.infinity,
            decoration: const BoxDecoration(
              color: Color(0xFF0D131D),
            ),
            child: Stack(
              children: [
                // Grid lines simulating map streets
                CustomPaint(
                  size: const Size(double.infinity, 180),
                  painter: _MapGridPainter(),
                ),

                // Simulated Route Line
                CustomPaint(
                  size: const Size(double.infinity, 180),
                  painter: _RouteLinePainter(),
                ),

                // Pickup Marker (Green)
                Positioned(
                  left: 36,
                  top: 40,
                  child: _buildPin(
                    color: AppColors.success,
                    icon: Icons.my_location,
                    label: 'Pickup',
                  ),
                ),

                // Destination Marker (Red)
                Positioned(
                  right: 36,
                  bottom: 36,
                  child: _buildPin(
                    color: AppColors.error,
                    icon: Icons.location_on,
                    label: 'Destination',
                  ),
                ),

                // Route Distance / ETA Pill
                Positioned(
                  top: 12,
                  right: 12,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: AppColors.card.withValues(alpha: 0.9),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: AppColors.borderHighlight, width: 1),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.route,
                            size: 13, color: AppColors.accent),
                        const SizedBox(width: 4),
                        Text(
                          distanceKm != null
                              ? '${distanceKm!.toStringAsFixed(1)} km'
                              : 'Direct Route',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: AppColors.accent,
                          ),
                        ),
                        if (durationText != null) ...[
                          const SizedBox(width: 4),
                          Text(
                            '• $durationText',
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Route Addresses Summary
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.circle,
                        size: 10, color: AppColors.success),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        pickupAddress.isEmpty
                            ? 'Select pickup location'
                            : pickupAddress,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                Padding(
                  padding: const EdgeInsets.only(left: 4, top: 4, bottom: 4),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Container(
                      width: 2,
                      height: 16,
                      color: AppColors.border,
                    ),
                  ),
                ),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.location_on,
                        size: 12, color: AppColors.error),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Text(
                        destinationAddress.isEmpty
                            ? 'Select drop destination'
                            : destinationAddress,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPin(
      {required Color color, required IconData icon, required String label}) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w900,
              color: Color(0xFF080B10),
            ),
          ),
        ),
        const SizedBox(height: 2),
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.2),
            shape: BoxShape.circle,
            border: Border.all(color: color, width: 2),
          ),
          child: Icon(icon, size: 14, color: color),
        ),
      ],
    );
  }
}

class _MapGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF162130)
      ..strokeWidth = 1.0;

    // Grid pattern
    for (double x = 0; x < size.width; x += 40) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += 40) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _RouteLinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final routePaint = Paint()
      ..color = AppColors.accent
      ..strokeWidth = 3.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final glowPaint = Paint()
      ..color = AppColors.accent.withValues(alpha: 0.3)
      ..strokeWidth = 8.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final path = Path()
      ..moveTo(50, 70)
      ..cubicTo(
          size.width * 0.35, 30, size.width * 0.6, 150, size.width - 50, 115);

    canvas.drawPath(path, glowPaint);
    canvas.drawPath(path, routePaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
