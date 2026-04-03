import 'package:equatable/equatable.dart';

abstract class DeliveryEvent extends Equatable {
  const DeliveryEvent();

  @override
  List<Object?> get props => [];
}

class DeliveryLoadRequested extends DeliveryEvent {
  final int driverId;

  const DeliveryLoadRequested(this.driverId);

  @override
  List<Object?> get props => [driverId];
}

class DeliveryFailRequested extends DeliveryEvent {
  final int deliveryId;
  final double lat;
  final double lng;

  const DeliveryFailRequested({
    required this.deliveryId,
    required this.lat,
    required this.lng,
  });

  @override
  List<Object?> get props => [deliveryId, lat, lng];
}

class DeliveryCompleteRequested extends DeliveryEvent {
  final int deliveryId;

  const DeliveryCompleteRequested(this.deliveryId);

  @override
  List<Object?> get props => [deliveryId];
}

class DeliveryHubCompleteRequested extends DeliveryEvent {
  final int deliveryId;

  const DeliveryHubCompleteRequested(this.deliveryId);

  @override
  List<Object?> get props => [deliveryId];
}
