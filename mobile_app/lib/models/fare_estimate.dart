class FareEstimate {
  final bool available;
  final String pickupAddress;
  final String destinationAddress;
  final double estimatedFare;
  final int passengers;
  final String? message;

  FareEstimate({
    required this.available,
    required this.pickupAddress,
    required this.destinationAddress,
    required this.estimatedFare,
    required this.passengers,
    this.message,
  });

  factory FareEstimate.fromJson(Map<String, dynamic> json) {
    return FareEstimate(
      available: json['available'] == true,
      pickupAddress: json['pickupAddress'] ?? json['pickup_address'] ?? '',
      destinationAddress:
          json['destinationAddress'] ?? json['destination_address'] ?? '',
      estimatedFare: json['estimatedFare'] != null
          ? double.tryParse(json['estimatedFare'].toString()) ?? 0.0
          : json['estimated_fare'] != null
              ? double.tryParse(json['estimated_fare'].toString()) ?? 0.0
              : 0.0,
      passengers: json['passengers'] is int
          ? json['passengers']
          : int.tryParse(json['passengers']?.toString() ?? '1') ?? 1,
      message: json['message'] ?? json['error'],
    );
  }
}
