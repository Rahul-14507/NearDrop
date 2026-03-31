import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:neardrop/features/hub/bloc/hub_event.dart';
import 'package:neardrop/features/hub/bloc/hub_state.dart';
import 'package:neardrop/features/hub/repository/hub_repository.dart';

class HubBloc extends Bloc<HubEvent, HubState> {
  final HubRepository _repository;

  HubBloc(this._repository) : super(const HubInitial()) {
    on<HubBroadcastsLoadRequested>(_onBroadcastsLoad);
    on<HubBroadcastAccepted>(_onAccept);
    on<HubStatsLoadRequested>(_onStatsLoad);
    on<HubNewBroadcastReceived>(_onNewBroadcast);
  }

  Future<void> _onBroadcastsLoad(
    HubBroadcastsLoadRequested event,
    Emitter<HubState> emit,
  ) async {
    // Preserve trust score if stats already loaded
    final existingTrustScore = state is HubStatsLoaded
        ? (state as HubStatsLoaded).stats.trustScore
        : state is HubBroadcastsLoaded
            ? (state as HubBroadcastsLoaded).trustScore
            : 0;
    emit(const HubLoading());
    final result = await _repository.getActiveBroadcasts(event.hubId);
    if (result.isSuccess) {
      emit(HubBroadcastsLoaded(result.data ?? [], trustScore: existingTrustScore));
    } else {
      emit(HubError(result.error ?? 'Failed to load broadcasts'));
    }
  }

  Future<void> _onAccept(
    HubBroadcastAccepted event,
    Emitter<HubState> emit,
  ) async {
    emit(const HubLoading());
    final result =
        await _repository.acceptBroadcast(event.broadcastId, event.hubId);
    if (result.isSuccess && result.data != null) {
      final data = result.data!;
      emit(HubBroadcastAcceptedState(
        pickupCode: data['pickup_code'] as String,
        hubName: data['hub_name'] as String,
        deliveryId: data['delivery_id'] as int,
      ));
    } else {
      emit(HubError(result.error ?? 'Failed to accept broadcast'));
    }
  }

  Future<void> _onStatsLoad(
    HubStatsLoadRequested event,
    Emitter<HubState> emit,
  ) async {
    final result = await _repository.getHubStats(event.hubId);
    if (result.isSuccess && result.data != null) {
      final stats = result.data!;
      // Merge trust score into broadcasts state so we don't blank the packages tab
      if (state is HubBroadcastsLoaded) {
        emit((state as HubBroadcastsLoaded).copyWith(trustScore: stats.trustScore, hubStats: stats));
      } else {
        emit(HubStatsLoaded(stats));
      }
    } else {
      emit(HubError(result.error ?? 'Failed to load stats'));
    }
  }

  Future<void> _onNewBroadcast(
    HubNewBroadcastReceived event,
    Emitter<HubState> emit,
  ) async {
    // Reload broadcasts when a new WS event arrives
    final result = await _repository.getActiveBroadcasts(event.hubId);
    if (result.isSuccess) {
      emit(HubBroadcastsLoaded(result.data ?? []));
    }
  }
}
