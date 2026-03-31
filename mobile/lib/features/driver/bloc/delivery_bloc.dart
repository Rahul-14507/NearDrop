import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:neardrop/features/driver/bloc/delivery_event.dart';
import 'package:neardrop/features/driver/bloc/delivery_state.dart';
import 'package:neardrop/features/driver/repository/driver_repository.dart';
import 'package:neardrop/features/driver/models/delivery_model.dart';

class DeliveryBloc extends Bloc<DeliveryEvent, DeliveryState> {
  final DriverRepository _repository;

  DeliveryBloc(this._repository) : super(const DeliveryInitial()) {
    on<DeliveryLoadRequested>(_onLoad);
    on<DeliveryFailRequested>(_onFail);
    on<DeliveryCompleteRequested>(_onComplete);
  }

  Future<void> _onLoad(
    DeliveryLoadRequested event,
    Emitter<DeliveryState> emit,
  ) async {
    emit(const DeliveryLoading());
    final result = await _repository.getActiveDelivery(event.driverId);
    if (result.isSuccess) {
      emit(DeliveryLoaded(result.data));
    } else {
      emit(DeliveryError(result.error ?? 'Failed to load delivery'));
    }
  }

  Future<void> _onFail(
    DeliveryFailRequested event,
    Emitter<DeliveryState> emit,
  ) async {
    DeliveryModel? currentDelivery;
    final current = state;
    if (current is DeliveryLoaded) currentDelivery = current.delivery;

    emit(const DeliveryLoading());
    final result = await _repository.failDelivery(
      event.deliveryId,
      event.lat,
      event.lng,
    );
    if (result.isSuccess && currentDelivery != null) {
      emit(DeliveryFailed(
        nearbyHubs: result.data ?? [],
        delivery: currentDelivery,
      ));
    } else {
      emit(DeliveryError(result.error ?? 'Broadcast failed'));
    }
  }

  Future<void> _onComplete(
    DeliveryCompleteRequested event,
    Emitter<DeliveryState> emit,
  ) async {
    emit(const DeliveryLoading());
    final result = await _repository.completeDelivery(event.deliveryId);
    if (result.isSuccess) {
      emit(DeliveryCompleted(event.deliveryId));
    } else {
      emit(DeliveryError(result.error ?? 'Failed to complete delivery'));
    }
  }
}
