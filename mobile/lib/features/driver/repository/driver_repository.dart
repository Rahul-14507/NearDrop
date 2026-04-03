import 'package:neardrop/core/network/api_client.dart';
import 'package:neardrop/features/driver/models/delivery_model.dart';
import 'package:neardrop/shared/models/api_response.dart';

class DriverRepository {
  final ApiClient _api;

  DriverRepository(this._api);

  Future<ApiResponse<Map<String, dynamic>>> getDriverScore(
      int driverId) async {
    try {
      final resp = await _api.get('/driver/$driverId/score');
      return ApiResponse.success(resp.data as Map<String, dynamic>);
    } catch (e) {
      return ApiResponse.failure(e.toString());
    }
  }

  Future<ApiResponse<DeliveryModel?>> getActiveDelivery(
      int driverId) async {
    try {
      final resp = await _api.get('/driver/$driverId/active_delivery');
      if (resp.data == null) return const ApiResponse.success(null);
      return ApiResponse.success(
          DeliveryModel.fromJson(resp.data as Map<String, dynamic>));
    } catch (e) {
      return ApiResponse.failure(e.toString());
    }
  }

  Future<ApiResponse<List<NearbyHubModel>>> failDelivery(
    int deliveryId,
    double lat,
    double lng,
  ) async {
    try {
      final resp = await _api.post('/delivery/fail', data: {
        'delivery_id': deliveryId,
        'driver_lat': lat,
        'driver_lng': lng,
      });
      final data = resp.data as Map<String, dynamic>;
      final hubs = (data['nearby_hubs'] as List)
          .map((h) =>
              NearbyHubModel.fromJson(h as Map<String, dynamic>))
          .toList();
      return ApiResponse.success(hubs);
    } catch (e) {
      return ApiResponse.failure(e.toString());
    }
  }

  Future<ApiResponse<bool>> completeDelivery(int deliveryId) async {
    try {
      await _api.post('/delivery/$deliveryId/complete');
      return const ApiResponse.success(true);
    } catch (e) {
      return ApiResponse.failure(e.toString());
    }
  }

  Future<ApiResponse<bool>> markHubDelivered(int deliveryId) async {
    try {
      await _api.post('/delivery/$deliveryId/hub-complete');
      return const ApiResponse.success(true);
    } catch (e) {
      return ApiResponse.failure(e.toString());
    }
  }

  Future<ApiResponse<List<Map<String, dynamic>>>> getDeliveryHistory(
      int driverId) async {
    try {
      final resp = await _api.get('/driver/$driverId/score');
      final data = resp.data as Map<String, dynamic>;
      final history =
          (data['recent_deliveries'] as List).cast<Map<String, dynamic>>();
      return ApiResponse.success(history);
    } catch (e) {
      return ApiResponse.failure(e.toString());
    }
  }

  Future<void> registerFcmToken(int driverId, String fcmToken) async {
    try {
      await _api.post('/driver/fcm-token', data: {
        'driver_id': driverId,
        'fcm_token': fcmToken,
      });
    } catch (_) {}
  }

  Future<ApiResponse<Map<String, dynamic>>> getAzureSpeechToken() async {
    try {
      final resp = await _api.post('/voice/azure-token');
      return ApiResponse.success(resp.data as Map<String, dynamic>);
    } catch (e) {
      return ApiResponse.failure(e.toString());
    }
  }
}
