class FareRoute {
  final int id;
  final String fromLocation;
  final String toLocation;
  final double fare;
  final bool isActive;

  FareRoute({
    required this.id,
    required this.fromLocation,
    required this.toLocation,
    required this.fare,
    required this.isActive,
  });

  factory FareRoute.fromJson(Map<String, dynamic> json) {
    return FareRoute(
      id: json['id'] is int
          ? json['id']
          : int.tryParse(json['id'].toString()) ?? 0,
      fromLocation: json['from_location'] ?? '',
      toLocation: json['to_location'] ?? '',
      fare: double.tryParse(json['fare']?.toString() ?? '0') ?? 0.0,
      isActive: json['is_active'] == true,
    );
  }
}

class PlatformFinancials {
  final double totalGrossVolume;
  final double ownerCommissionEarned;
  final double driverPayoutsTotal;
  final double pendingSettlementsAmount;
  final double settledPayoutsAmount;
  final int totalCompletedPayments;
  final double commissionPerTrip;

  PlatformFinancials({
    required this.totalGrossVolume,
    required this.ownerCommissionEarned,
    required this.driverPayoutsTotal,
    required this.pendingSettlementsAmount,
    required this.settledPayoutsAmount,
    required this.totalCompletedPayments,
    required this.commissionPerTrip,
  });

  factory PlatformFinancials.fromJson(Map<String, dynamic> json) {
    return PlatformFinancials(
      totalGrossVolume:
          double.tryParse(json['totalGrossVolume']?.toString() ?? '0') ?? 0.0,
      ownerCommissionEarned:
          double.tryParse(json['ownerCommissionEarned']?.toString() ?? '0') ??
              0.0,
      driverPayoutsTotal:
          double.tryParse(json['driverPayoutsTotal']?.toString() ?? '0') ?? 0.0,
      pendingSettlementsAmount: double.tryParse(
              json['pendingSettlementsAmount']?.toString() ?? '0') ??
          0.0,
      settledPayoutsAmount:
          double.tryParse(json['settledPayoutsAmount']?.toString() ?? '0') ??
              0.0,
      totalCompletedPayments:
          int.tryParse(json['totalCompletedPayments']?.toString() ?? '0') ?? 0,
      commissionPerTrip:
          double.tryParse(json['commissionPerTrip']?.toString() ?? '5') ?? 5.0,
    );
  }
}

class AdminMetrics {
  final int totalCustomers;
  final int totalDrivers;
  final int pendingDrivers;
  final int totalBookings;
  final int activeBookings;
  final int completedRides;

  AdminMetrics({
    required this.totalCustomers,
    required this.totalDrivers,
    required this.pendingDrivers,
    required this.totalBookings,
    required this.activeBookings,
    required this.completedRides,
  });

  factory AdminMetrics.fromJson(Map<String, dynamic> json) {
    return AdminMetrics(
      totalCustomers:
          int.tryParse(json['totalCustomers']?.toString() ?? '0') ?? 0,
      totalDrivers: int.tryParse(json['totalDrivers']?.toString() ?? '0') ?? 0,
      pendingDrivers:
          int.tryParse(json['pendingDrivers']?.toString() ?? '0') ?? 0,
      totalBookings:
          int.tryParse(json['totalBookings']?.toString() ?? '0') ?? 0,
      activeBookings:
          int.tryParse(json['activeBookings']?.toString() ?? '0') ?? 0,
      completedRides:
          int.tryParse(json['completedRides']?.toString() ?? '0') ?? 0,
    );
  }
}

class AdminStats {
  final AdminMetrics metrics;
  final PlatformFinancials? financials;
  final List<FareRoute> fareRoutes;

  AdminStats({
    required this.metrics,
    this.financials,
    required this.fareRoutes,
  });

  factory AdminStats.fromJson(Map<String, dynamic> json) {
    return AdminStats(
      metrics: AdminMetrics.fromJson(json['metrics'] ?? {}),
      financials: json['financials'] != null
          ? PlatformFinancials.fromJson(json['financials'])
          : null,
      fareRoutes: (json['fareRoutes'] as List<dynamic>?)
              ?.map((e) => FareRoute.fromJson(e))
              .toList() ??
          [],
    );
  }
}
