class User {
  final int id;
  final String name;
  final String email;
  final String mobile;
  final String role; // 'customer' | 'driver' | 'admin'
  final bool? emailVerified;
  final String? autoNumber;
  final String? autoModel;
  final String? licenseNumber;
  final String? approvalStatus;

  User({
    required this.id,
    required this.name,
    required this.email,
    required this.mobile,
    required this.role,
    this.emailVerified,
    this.autoNumber,
    this.autoModel,
    this.licenseNumber,
    this.approvalStatus,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] is int
          ? json['id']
          : int.tryParse(json['id'].toString()) ?? 0,
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      mobile: json['mobile'] ?? '',
      role: json['role'] ?? 'customer',
      emailVerified: json['is_email_verified'] ??
          json['isEmailVerified'] ??
          json['email_verified'],
      autoNumber: json['auto_number'] ?? json['autoNumber'],
      autoModel: json['auto_model'] ?? json['autoModel'],
      licenseNumber: json['license_number'] ?? json['licenseNumber'],
      approvalStatus: json['approval_status'] ?? json['approvalStatus'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'mobile': mobile,
      'role': role,
      if (emailVerified != null) 'email_verified': emailVerified,
      if (autoNumber != null) 'auto_number': autoNumber,
      if (autoModel != null) 'auto_model': autoModel,
      if (licenseNumber != null) 'license_number': licenseNumber,
      if (approvalStatus != null) 'approval_status': approvalStatus,
    };
  }

  bool get isEmailVerified => emailVerified ?? (id > 0 && email.isNotEmpty);
  bool get isCustomer => role == 'customer';
  bool get isDriver => role == 'driver';
  bool get isAdmin => role == 'admin';
}
