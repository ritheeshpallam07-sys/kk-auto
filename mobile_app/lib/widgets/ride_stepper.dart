import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class RideStepper extends StatelessWidget {
  final String currentStatus;

  const RideStepper({
    super.key,
    required this.currentStatus,
  });

  static const List<Map<String, String>> steps = [
    {'title': 'Search', 'desc': 'Looking for auto'},
    {'title': 'Assigned', 'desc': 'Driver confirmed'},
    {'title': 'Arriving', 'desc': 'Auto on the way'},
    {'title': 'Onboard', 'desc': 'Ride started'},
    {'title': 'Completed', 'desc': 'Reached drop'},
  ];

  int _getStepIndex() {
    switch (currentStatus) {
      case 'Searching for Auto':
        return 0;
      case 'Driver Assigned':
        return 1;
      case 'Driver Arriving':
        return 2;
      case 'Ride Started':
        return 3;
      case 'Ride Completed':
        return 4;
      default:
        return 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeIndex = _getStepIndex();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        children: [
          Row(
            children: List.generate(steps.length * 2 - 1, (index) {
              // Connecting line
              if (index.isOdd) {
                final lineIndex = index ~/ 2;
                final isPassed = lineIndex < activeIndex;
                return Expanded(
                  child: Container(
                    height: 3,
                    color: isPassed ? AppColors.accent : AppColors.border,
                  ),
                );
              }

              // Circle Indicator
              final stepIndex = index ~/ 2;
              final isPassed = stepIndex <= activeIndex;
              final isCurrent = stepIndex == activeIndex;

              return Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isPassed ? AppColors.accent : AppColors.cardElevated,
                  border: Border.all(
                    color: isCurrent
                        ? Colors.white
                        : (isPassed ? AppColors.accent : AppColors.border),
                    width: isCurrent ? 2.5 : 1.5,
                  ),
                  boxShadow: isCurrent
                      ? [
                          BoxShadow(
                            color: AppColors.accent.withValues(alpha: 0.5),
                            blurRadius: 8,
                            spreadRadius: 1,
                          ),
                        ]
                      : null,
                ),
                child: Center(
                  child: isPassed && !isCurrent
                      ? const Icon(Icons.check,
                          size: 14, color: Color(0xFF080B10))
                      : Text(
                          '${stepIndex + 1}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            color: isPassed
                                ? const Color(0xFF080B10)
                                : AppColors.textMuted,
                          ),
                        ),
                ),
              );
            }),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(steps.length, (index) {
              final isCurrent = index == activeIndex;
              final isPassed = index <= activeIndex;

              return SizedBox(
                width: 58,
                child: Column(
                  children: [
                    Text(
                      steps[index]['title']!,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight:
                            isCurrent ? FontWeight.w900 : FontWeight.w700,
                        color: isCurrent
                            ? AppColors.accent
                            : (isPassed
                                ? AppColors.textPrimary
                                : AppColors.textMuted),
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}
