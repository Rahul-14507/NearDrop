import 'package:neardrop/core/network/api_client.dart';
import 'package:neardrop/features/hub/models/hub_model.dart';
import 'package:neardrop/shared/models/api_response.dart';

class HubRepository {
  final ApiClient _api;

  HubRepository(this._api);

  Future<ApiResponse<List<BroadcastModel>>> getActiveBroadcasts(
      int hubId) async {
    try {
      final resp = await _api.get('/hubs/$hubId/active_broadcasts');
      final list = (resp.data as List)
          .map((e) => BroadcastModel.fromJson(e as Map<String, dynamic>))
          .toList();
      return ApiResponse.success(list);
    } catch (e) {
      return ApiResponse.failure(e.toString());
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> acceptBroadcast(
    int broadcastId,
    int hubId,
  ) async {
    try {
      final resp = await _api.post('/hub/accept', data: {
        'broadcast_id': broadcastId,
        'hub_id': hubId,
      });
      return ApiResponse.success(resp.data as Map<String, dynamic>);
    } catch (e) {
      return ApiResponse.failure(e.toString());
    }
  }

  Future<ApiResponse<HubStatsModel>> getHubStats(int hubId) async {
    try {
      final resp = await _api.get('/hubs/$hubId/stats');
      return ApiResponse.success(
          HubStatsModel.fromJson(resp.data as Map<String, dynamic>));
    } catch (e) {
      return ApiResponse.failure(e.toString());
    }
  }

  Future<ApiResponse<List<StoredPackageModel>>> getStoredPackages(
      int hubId) async {
    try {
      final resp = await _api.get('/hubs/$hubId/stored_packages');
      final list = (resp.data as List)
          .map((e) => StoredPackageModel.fromJson(e as Map<String, dynamic>))
          .toList();
      return ApiResponse.success(list);
    } catch (e) {
      return ApiResponse.failure(e.toString());
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> verifyOtp(
    int deliveryId,
    String otp,
  ) async {
    try {
      final resp = await _api.post(
        '/delivery/$deliveryId/verify-otp',
        data: {'otp': otp},
      );
      return ApiResponse.success(resp.data as Map<String, dynamic>);
    } catch (e) {
      return ApiResponse.failure(e.toString());
    }
  }

  Future<ApiResponse<void>> resendOtp(int deliveryId) async {
    try {
      await _api.post('/delivery/$deliveryId/resend-otp', data: {});
      return ApiResponse.success(null);
    } catch (e) {
      return ApiResponse.failure(e.toString());
    }
  }
}
