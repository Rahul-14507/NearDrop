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
    on<HubStoredPackagesLoadRequested>(_onStoredPackagesLoad);
    on<HubVerifyOtpRequested>(_onVerifyOtp);
    on<HubResendOtpRequested>(_onResendOtp);
  }

  Future<void> _onBroadcastsLoad(
    HubBroadcastsLoadRequested event,
    Emitter<HubState> emit,
  ) async {
    final existingTrustScore = state is HubStatsLoaded
        ? (state as HubStatsLoaded).stats.trustScore
        : state is HubBroadcastsLoaded
            ? (state as HubBroadcastsLoaded).trustScore
            : 0;

    final existingPackages = state is HubBroadcastsLoaded
        ? (state as HubBroadcastsLoaded).storedPackages
        : const [];

    emit(const HubLoading());

    final result = await _repository.getActiveBroadcasts(event.hubId);
    if (result.isSuccess) {
      // Also load stored packages in parallel
      final packagesResult = await _repository.getStoredPackages(event.hubId);
      emit(HubBroadcastsLoaded(
        result.data ?? [],
        trustScore: existingTrustScore,
        storedPackages: packagesResult.data ?? [],
      ));
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
      if (state is HubBroadcastsLoaded) {
        emit((state as HubBroadcastsLoaded)
            .copyWith(trustScore: stats.trustScore, hubStats: stats));
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
    final result = await _repository.getActiveBroadcasts(event.hubId);
    if (result.isSuccess) {
      final packagesResult = await _repository.getStoredPackages(event.hubId);
      emit(HubBroadcastsLoaded(
        result.data ?? [],
        storedPackages: packagesResult.data ?? [],
      ));
    }
  }

  Future<void> _onStoredPackagesLoad(
    HubStoredPackagesLoadRequested event,
    Emitter<HubState> emit,
  ) async {
    final result = await _repository.getStoredPackages(event.hubId);
    if (result.isSuccess) {
      if (state is HubBroadcastsLoaded) {
        emit((state as HubBroadcastsLoaded)
            .copyWith(storedPackages: result.data ?? []));
      }
    }
  }

  Future<void> _onVerifyOtp(
    HubVerifyOtpRequested event,
    Emitter<HubState> emit,
  ) async {
    final result =
        await _repository.verifyOtp(event.deliveryId, event.otp);
    if (result.isSuccess && result.data != null) {
      final data = result.data!;
      final verified = data['verified'] as bool? ?? false;
      if (verified) {
        emit(HubOtpVerifiedState(
          customerName: data['customer_name'] as String? ?? 'Customer',
          packageId: data['package_id'] as String? ?? '',
          deliveryId: event.deliveryId,
        ));
      } else {
        emit(HubOtpInvalidState(
          message: data['message'] as String? ?? 'Invalid OTP',
          deliveryId: event.deliveryId,
        ));
      }
    } else {
      emit(HubOtpInvalidState(
        message: result.error ?? 'Verification failed',
        deliveryId: event.deliveryId,
      ));
    }
  }

  Future<void> _onResendOtp(
    HubResendOtpRequested event,
    Emitter<HubState> emit,
  ) async {
    final result = await _repository.resendOtp(event.deliveryId);
    if (result.isSuccess) {
      emit(HubOtpResentState(event.deliveryId));
    } else {
      emit(HubError(result.error ?? 'Failed to resend OTP'));
    }
  }
}
