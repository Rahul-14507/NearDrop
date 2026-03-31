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

  const HubBroadcastsLoaded(this.broadcasts, {this.trustScore = 0, this.hubStats});

  HubBroadcastsLoaded copyWith({List<BroadcastModel>? broadcasts, int? trustScore, HubStatsModel? hubStats}) {
    return HubBroadcastsLoaded(
      broadcasts ?? this.broadcasts,
      trustScore: trustScore ?? this.trustScore,
      hubStats: hubStats ?? this.hubStats,
    );
  }

  @override
  List<Object?> get props => [broadcasts, trustScore, hubStats];
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

class HubError extends HubState {
  final String message;

  const HubError(this.message);

  @override
  List<Object?> get props => [message];
}
