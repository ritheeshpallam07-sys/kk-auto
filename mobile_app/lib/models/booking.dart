class Booking {
  final int id;
  final String bookingReference;
  final int customerId;
  final int? driverId;
  final String? customerName;
  final String? customerMobile;
  final String? customerEmail;
  final String? driverName;
  final String? driverMobile;
  final String? autoNumber;
  final String? autoModel;
  final String? licenseNumber;
  final String pickupAddress;
  final String destinationAddress;
  final double? pickupLatitude;
  final double? pickupLongitude;
  final double? destinationLatitude;
  final double? destinationLongitude;
  final String? pickupAreaName;
  final String? destinationAreaName;
  final String pickupDatetime;
  final int passengers;
  final double estimatedFare;
  final String status;
  final String? paymentStatus;
  final String? paymentMethod;
  final String? transactionReference;
  final double? driverAmount;
  final double? ownerAmount;
  final String? createdAt;

  Booking({
    required this.id,
    required this.bookingReference,
    required this.customerId,
    this.driverId,
    this.customerName,
    this.customerMobile,
    this.customerEmail,
    this.driverName,
    this.driverMobile,
    this.autoNumber,
    this.autoModel,
    this.licenseNumber,
    required this.pickupAddress,
    required this.destinationAddress,
    this.pickupLatitude,
    this.pickupLongitude,
    this.destinationLatitude,
    this.destinationLongitude,
    this.pickupAreaName,
    this.destinationAreaName,
    required this.pickupDatetime,
    required this.passengers,
    required this.estimatedFare,
    required this.status,
    this.paymentStatus,
    this.paymentMethod,
    this.transactionReference,
    this.driverAmount,
    this.ownerAmount,
    this.createdAt,
  });

  factory Booking.fromJson(Map<String, dynamic> json) {
    return Booking(
      id: json['id'] is int
          ? json['id']
          : int.tryParse(json['id'].toString()) ?? 0,
      bookingReference: json['booking_reference'] ?? '',
      customerId: json['customer_id'] is int
          ? json['customer_id']
          : int.tryParse(json['customer_id'].toString()) ?? 0,
      driverId: json['driver_id'] != null
          ? int.tryParse(json['driver_id'].toString())
          : null,
      customerName: json['customer_name'],
      customerMobile: json['customer_mobile'],
      customerEmail: json['customer_email'],
      driverName: json['driver_name'],
      driverMobile: json['driver_mobile'],
      autoNumber: json['auto_number'],
      autoModel: json['auto_model'],
      licenseNumber: json['license_number'],
      pickupAddress: json['pickup_address'] ?? '',
      destinationAddress: json['destination_address'] ?? '',
      pickupLatitude: json['pickup_latitude'] != null
          ? double.tryParse(json['pickup_latitude'].toString())
          : null,
      pickupLongitude: json['pickup_longitude'] != null
          ? double.tryParse(json['pickup_longitude'].toString())
          : null,
      destinationLatitude: json['destination_latitude'] != null
          ? double.tryParse(json['destination_latitude'].toString())
          : null,
      destinationLongitude: json['destination_longitude'] != null
          ? double.tryParse(json['destination_longitude'].toString())
          : null,
      pickupAreaName: json['pickup_area_name'],
      destinationAreaName: json['destination_area_name'],
      pickupDatetime: json['pickup_datetime'] ?? '',
      passengers: json['passengers'] is int
          ? json['passengers']
          : int.tryParse(json['passengers'].toString()) ?? 1,
      estimatedFare: json['estimated_fare'] != null
          ? double.tryParse(json['estimated_fare'].toString()) ?? 0.0
          : 0.0,
      status: json['status'] ?? 'Searching for Auto',
      paymentStatus: json['payment_status'],
      paymentMethod: json['payment_method'],
      transactionReference: json['transaction_reference'],
      driverAmount: json['driver_amount'] != null
          ? double.tryParse(json['driver_amount'].toString())
          : null,
      ownerAmount: json['owner_amount'] != null
          ? double.tryParse(json['owner_amount'].toString())
          : null,
      createdAt: json['created_at'],
    );
  }

  bool get isSearching => status == 'Searching for Auto';
  bool get isAssigned => status == 'Driver Assigned';
  bool get isArriving => status == 'Driver Arriving';
  bool get isStarted => status == 'Ride Started';
  bool get isCompleted => status == 'Ride Completed';
  bool get isCancelled => status == 'Cancelled';
  bool get isActive => isSearching || isAssigned || isArriving || isStarted;
  bool get isPaid => paymentStatus == 'COMPLETED';
}
