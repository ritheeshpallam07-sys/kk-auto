class DriverEarningsSummary {
  final double todayEarnings;
  final double totalEarnings;
  final double pendingSettlement;
  final double settledAmount;
  final int completedRidesCount;
  final String? payoutUpi;

  DriverEarningsSummary({
    required this.todayEarnings,
    required this.totalEarnings,
    required this.pendingSettlement,
    required this.settledAmount,
    required this.completedRidesCount,
    this.payoutUpi,
  });

  factory DriverEarningsSummary.fromJson(Map<String, dynamic> json) {
    return DriverEarningsSummary(
      todayEarnings:
          double.tryParse(json['todayEarnings']?.toString() ?? '0') ?? 0.0,
      totalEarnings:
          double.tryParse(json['totalEarnings']?.toString() ?? '0') ?? 0.0,
      pendingSettlement:
          double.tryParse(json['pendingSettlement']?.toString() ?? '0') ?? 0.0,
      settledAmount:
          double.tryParse(json['settledAmount']?.toString() ?? '0') ?? 0.0,
      completedRidesCount:
          int.tryParse(json['completedRidesCount']?.toString() ?? '0') ?? 0,
      payoutUpi: json['payoutUpi'],
    );
  }
}

class DriverProfile {
  final int id;
  final int userId;
  final String name;
  final String email;
  final String mobile;
  final String autoNumber;
  final String autoModel;
  final String licenseNumber;
  final String availabilityStatus; // 'available' | 'offline' | 'on_ride'
  final String
      approvalStatus; // 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'SUSPENDED'
  final String? payoutUpi;
  final String? payoutBankAccount;
  final String? payoutIfsc;
  final DriverEarningsSummary? earnings;

  DriverProfile({
    required this.id,
    required this.userId,
    required this.name,
    required this.email,
    required this.mobile,
    required this.autoNumber,
    required this.autoModel,
    required this.licenseNumber,
    required this.availabilityStatus,
    required this.approvalStatus,
    this.payoutUpi,
    this.payoutBankAccount,
    this.payoutIfsc,
    this.earnings,
  });

  factory DriverProfile.fromJson(Map<String, dynamic> json) {
    return DriverProfile(
      id: json['id'] is int
          ? json['id']
          : int.tryParse(json['id'].toString()) ?? 0,
      userId: json['user_id'] is int
          ? json['user_id']
          : int.tryParse(json['user_id'].toString()) ?? 0,
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      mobile: json['mobile'] ?? '',
      autoNumber: json['auto_number'] ?? '',
      autoModel: json['auto_model'] ?? '',
      licenseNumber: json['license_number'] ?? '',
      availabilityStatus: json['availability_status'] ?? 'offline',
      approvalStatus: json['approval_status'] ?? 'PENDING',
      payoutUpi: json['payout_upi'],
      payoutBankAccount: json['payout_bank_account'],
      payoutIfsc: json['payout_ifsc'],
      earnings: json['earnings'] != null
          ? DriverEarningsSummary.fromJson(json['earnings'])
          : null,
    );
  }

  bool get isAvailable => availabilityStatus == 'available';
  bool get isApproved =>
      approvalStatus.toUpperCase() == 'APPROVED' ||
      approvalStatus.toUpperCase() == 'ACTIVE';
}
