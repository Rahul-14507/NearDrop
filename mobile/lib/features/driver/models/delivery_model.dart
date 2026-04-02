import 'package:equatable/equatable.dart';

class DeliveryModel extends Equatable {
  final int id;
  final String orderId;
  final String address;
  final String status;
  final String? recipientName;
  final String packageSize;
  final double weightKg;
  final DateTime createdAt;
  final String? pickupCode;
  final double? lat;
  final double? lng;

  const DeliveryModel({
    required this.id,
    required this.orderId,
    required this.address,
    required this.status,
    this.recipientName,
    required this.packageSize,
    required this.weightKg,
    required this.createdAt,
    this.pickupCode,
    this.lat,
    this.lng,
  });

  factory DeliveryModel.fromJson(Map<String, dynamic> json) => DeliveryModel(
        id: json['id'] as int,
        orderId: json['order_id'] as String,
        address: json['address'] as String,
        status: json['status'] as String,
        recipientName: json['recipient_name'] as String?,
        packageSize: json['package_size'] as String,
        weightKg: (json['weight_kg'] as num).toDouble(),
        createdAt: DateTime.parse(json['created_at'] as String),
        pickupCode: json['pickup_code'] as String?,
        lat: (json['lat'] as num?)?.toDouble(),
        lng: (json['lng'] as num?)?.toDouble(),
      );

  @override
  List<Object?> get props => [id, orderId, status, pickupCode, lat, lng];
}

class NearbyHubModel extends Equatable {
  final int id;
  final String name;
  final double lat;
  final double lng;
  final String hubType;
  final int trustScore;
  final double distanceM;
  final int etaMinutes;

  const NearbyHubModel({
    required this.id,
    required this.name,
    required this.lat,
    required this.lng,
    required this.hubType,
    required this.trustScore,
    required this.distanceM,
    required this.etaMinutes,
  });

  factory NearbyHubModel.fromJson(Map<String, dynamic> json) => NearbyHubModel(
        id: json['id'] as int,
        name: json['name'] as String,
        lat: (json['lat'] as num).toDouble(),
        lng: (json['lng'] as num).toDouble(),
        hubType: json['hub_type'] as String,
        trustScore: json['trust_score'] as int,
        distanceM: (json['distance_m'] as num?)?.toDouble() ?? 0.0,
        etaMinutes: (json['eta_minutes'] as num?)?.toInt() ?? 1,
      );

  String get formattedDistance => distanceM < 1000
      ? '${distanceM.toStringAsFixed(0)} m'
      : '${(distanceM / 1000).toStringAsFixed(1)} km';

  @override
  List<Object?> get props => [id, name, distanceM];
}
