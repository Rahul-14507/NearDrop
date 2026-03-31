import 'package:equatable/equatable.dart';
import 'package:neardrop/features/hub/models/hub_model.dart';

abstract class HubState extends Equatable {
  const HubState();

  @override
  List<Object?> get props => [];
}

class HubInitial extends HubState {
  const HubInitial();
}

class HubLoading extends HubState {
  const HubLoading();
}

class HubBroadcastsLoaded extends HubState {
  final List<BroadcastModel> broadcasts;
  final int trustScore;
  final HubStatsModel? hubStats;
  final List<StoredPackageModel> storedPackages;

  const HubBroadcastsLoaded(
    this.broadcasts, {
    this.trustScore = 0,
    this.hubStats,
    this.storedPackages = const [],
  });

  HubBroadcastsLoaded copyWith({
    List<BroadcastModel>? broadcasts,
    int? trustScore,
    HubStatsModel? hubStats,
    List<StoredPackageModel>? storedPackages,
  }) {
    return HubBroadcastsLoaded(
      broadcasts ?? this.broadcasts,
      trustScore: trustScore ?? this.trustScore,
      hubStats: hubStats ?? this.hubStats,
      storedPackages: storedPackages ?? this.storedPackages,
    );
  }

  @override
  List<Object?> get props => [broadcasts, trustScore, hubStats, storedPackages];
}

class HubBroadcastAcceptedState extends HubState {
  final String pickupCode;
  final String hubName;
  final int deliveryId;

  const HubBroadcastAcceptedState({
    required this.pickupCode,
    required this.hubName,
    required this.deliveryId,
  });

  @override
  List<Object?> get props => [pickupCode, deliveryId];
}

class HubStatsLoaded extends HubState {
  final HubStatsModel stats;

  const HubStatsLoaded(this.stats);

  @override
  List<Object?> get props => [stats];
}

class HubOtpVerifiedState extends HubState {
  final String customerName;
  final String packageId;
  final int deliveryId;

  const HubOtpVerifiedState({
    required this.customerName,
    required this.packageId,
    required this.deliveryId,
  });

  @override
  List<Object?> get props => [deliveryId];
}

class HubOtpInvalidState extends HubState {
  final String message;
  final int deliveryId;

  const HubOtpInvalidState({
    required this.message,
    required this.deliveryId,
  });

  @override
  List<Object?> get props => [message, deliveryId];
}

class HubOtpResentState extends HubState {
  final int deliveryId;

  const HubOtpResentState(this.deliveryId);

  @override
  List<Object?> get props => [deliveryId];
}

class HubError extends HubState {
  final String message;

  const HubError(this.message);

  @override
  List<Object?> get props => [message];
}
