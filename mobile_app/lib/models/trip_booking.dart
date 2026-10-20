class TripBooking {
  final int id;
  final String bookingReference;
  final int customerId;
  final String customerName;
  final String phoneNumber;
  final int members;
  final String? email;
  final String tripPlace;
  final int days;
  final String tripDate;
  final String pickupTime;
  final String
      status; // 'NEW' | 'CONTACTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'
  final double? quotedPrice;
  final bool customerConfirmed;
  final String paymentStatus; // 'PENDING' | 'PAID' | 'FAILED'

  TripBooking({
    required this.id,
    required this.bookingReference,
    required this.customerId,
    required this.customerName,
    required this.phoneNumber,
    required this.members,
    this.email,
    required this.tripPlace,
    required this.days,
    required this.tripDate,
    required this.pickupTime,
    required this.status,
    this.quotedPrice,
    required this.customerConfirmed,
    required this.paymentStatus,
  });

  factory TripBooking.fromJson(Map<String, dynamic> json) {
    return TripBooking(
      id: json['id'] is int
          ? json['id']
          : int.tryParse(json['id'].toString()) ?? 0,
      bookingReference: json['booking_reference'] ?? '',
      customerId: json['customer_id'] is int
          ? json['customer_id']
          : int.tryParse(json['customer_id'].toString()) ?? 0,
      customerName: json['customer_name'] ?? '',
      phoneNumber: json['phone_number'] ?? '',
      members: int.tryParse(json['members']?.toString() ?? '1') ?? 1,
      email: json['email'],
      tripPlace: json['trip_place'] ?? '',
      days: int.tryParse(json['days']?.toString() ?? '1') ?? 1,
      tripDate: json['trip_date'] ?? '',
      pickupTime: json['pickup_time'] ?? '',
      status: json['status'] ?? 'NEW',
      quotedPrice: json['quoted_price'] != null
          ? double.tryParse(json['quoted_price'].toString())
          : null,
      customerConfirmed: json['customer_confirmed'] == true,
      paymentStatus: json['payment_status'] ?? 'PENDING',
    );
  }
}
