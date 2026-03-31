import 'package:equatable/equatable.dart';

class BroadcastModel extends Equatable {
  final int id;
  final int deliveryId;
  final String orderId;
  final String address;
  final String packageSize;
  final double weightKg;
  final double distanceM;
  final double reward;
  final String? recipientName;

  const BroadcastModel({
    required this.id,
    required this.deliveryId,
    required this.orderId,
    required this.address,
    required this.packageSize,
    required this.weightKg,
    required this.distanceM,
    required this.reward,
    this.recipientName,
  });

  factory BroadcastModel.fromJson(Map<String, dynamic> json) {
    final delivery = json['delivery'] as Map<String, dynamic>;
    return BroadcastModel(
      id: json['id'] as int,
      deliveryId: delivery['id'] as int,
      orderId: delivery['order_id'] as String,
      address: delivery['address'] as String,
      packageSize: delivery['package_size'] as String,
      weightKg: (delivery['weight_kg'] as num).toDouble(),
      distanceM: (json['distance_m'] as num).toDouble(),
      reward: (json['reward'] as num).toDouble(),
      recipientName: delivery['recipient_name'] as String?,
    );
  }

  String get formattedDistance => distanceM < 1000
      ? '${distanceM.toStringAsFixed(0)} m'
      : '${(distanceM / 1000).toStringAsFixed(1)} km';

  @override
  List<Object?> get props => [id, deliveryId];
}

class HubStatsModel extends Equatable {
  final int hubId;
  final String name;
  final double todayEarnings;
  final int acceptedCount;
  final int trustScore;

  const HubStatsModel({
    required this.hubId,
    required this.name,
    required this.todayEarnings,
    required this.acceptedCount,
    required this.trustScore,
  });

  factory HubStatsModel.fromJson(Map<String, dynamic> json) => HubStatsModel(
        hubId: json['hub_id'] as int,
        name: json['name'] as String,
        todayEarnings: (json['today_earnings'] as num).toDouble(),
        acceptedCount: json['accepted_count'] as int,
        trustScore: json['trust_score'] as int,
      );

  @override
  List<Object?> get props => [hubId, todayEarnings, acceptedCount];
}

class StoredPackageModel extends Equatable {
  final int deliveryId;
  final String orderId;
  final String address;
  final String? recipientName;
  final bool hubOtpVerified;
  final DateTime? hubOtpSentAt;

  const StoredPackageModel({
    required this.deliveryId,
    required this.orderId,
    required this.address,
    this.recipientName,
    required this.hubOtpVerified,
    this.hubOtpSentAt,
  });

  factory StoredPackageModel.fromJson(Map<String, dynamic> json) =>
      StoredPackageModel(
        deliveryId: json['delivery_id'] as int,
        orderId: json['order_id'] as String,
        address: json['address'] as String,
        recipientName: json['recipient_name'] as String?,
        hubOtpVerified: json['hub_otp_verified'] as bool? ?? false,
        hubOtpSentAt: json['hub_otp_sent_at'] != null
            ? DateTime.parse(json['hub_otp_sent_at'] as String)
            : null,
      );

  @override
  List<Object?> get props => [deliveryId, hubOtpVerified];
}
