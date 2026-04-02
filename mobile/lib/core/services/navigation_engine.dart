import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'package:neardrop/core/config/app_config.dart';
import 'package:neardrop/core/services/azure_tts_service.dart';

class NavigationInstruction {
  final String instructionText;
  final int distanceM;
  final String maneuver;
  final int pointIndex;
  final double lat;
  final double lng;

  const NavigationInstruction({
    required this.instructionText,
    required this.distanceM,
    required this.maneuver,
    required this.pointIndex,
    required this.lat,
    required this.lng,
  });

  factory NavigationInstruction.fromJson(Map<String, dynamic> json) =>
      NavigationInstruction(
        instructionText: json['instruction_text'] as String? ?? '',
        distanceM: (json['distance_m'] as num?)?.toInt() ?? 0,
        maneuver: json['maneuver'] as String? ?? 'STRAIGHT',
        pointIndex: (json['point_index'] as num?)?.toInt() ?? 0,
        lat: (json['lat'] as num?)?.toDouble() ?? 0.0,
        lng: (json['lng'] as num?)?.toDouble() ?? 0.0,
      );
}

class NavigationState {
  final List<LatLng> polyline;
  final NavigationInstruction? currentInstruction;
  final NavigationInstruction? nextInstruction;
  final int remainingDistanceM;
  final int remainingTimeS;
  final bool isRecalculating;
  final bool hasArrived;
  final int? arrivalCountdownSeconds;
  final LatLng? driverPosition;
  final double? driverHeading;

  const NavigationState({
    this.polyline = const [],
    this.currentInstruction,
    this.nextInstruction,
    this.remainingDistanceM = 0,
    this.remainingTimeS = 0,
    this.isRecalculating = false,
    this.hasArrived = false,
    this.arrivalCountdownSeconds,
    this.driverPosition,
    this.driverHeading,
  });

  NavigationState copyWith({
    List<LatLng>? polyline,
    NavigationInstruction? currentInstruction,
    NavigationInstruction? nextInstruction,
    int? remainingDistanceM,
    int? remainingTimeS,
    bool? isRecalculating,
    bool? hasArrived,
    int? arrivalCountdownSeconds,
    LatLng? driverPosition,
    double? driverHeading,
  }) =>
      NavigationState(
        polyline: polyline ?? this.polyline,
        currentInstruction: currentInstruction ?? this.currentInstruction,
        nextInstruction: nextInstruction ?? this.nextInstruction,
        remainingDistanceM: remainingDistanceM ?? this.remainingDistanceM,
        remainingTimeS: remainingTimeS ?? this.remainingTimeS,
        isRecalculating: isRecalculating ?? this.isRecalculating,
        hasArrived: hasArrived ?? this.hasArrived,
        arrivalCountdownSeconds:
            arrivalCountdownSeconds ?? this.arrivalCountdownSeconds,
        driverPosition: driverPosition ?? this.driverPosition,
        driverHeading: driverHeading ?? this.driverHeading,
      );
}

class NavigationEngine {
  static final NavigationEngine _instance = NavigationEngine._internal();
  factory NavigationEngine() => _instance;
  NavigationEngine._internal();

  final StreamController<NavigationState> _stateController =
      StreamController<NavigationState>.broadcast();
  Stream<NavigationState> get stateStream => _stateController.stream;

  NavigationState _state = const NavigationState();
  NavigationState get currentState => _state;

  StreamSubscription<Position>? _gpsSub;
  Timer? _arrivalTimer;
  bool _isNavigating = false;

  List<NavigationInstruction> _instructions = [];
  int _currentInstrIndex = 0;
  LatLng? _destination;
  String? _destinationName;

  VoidCallback? onArrivalComplete;

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  void _emit(NavigationState state) {
    _state = state;
    _stateController.add(state);
  }

  Future<void> startNavigation({
    required double destLat,
    required double destLng,
    required String customerName,
    VoidCallback? onArrival,
  }) async {
    if (_isNavigating) await stopNavigation();
    _isNavigating = true;
    onArrivalComplete = onArrival;
    _destination = LatLng(destLat, destLng);
    _destinationName = customerName;
    _currentInstrIndex = 0;

    // Get current position
    Position? current;
    try {
      current = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      ).timeout(const Duration(seconds: 10));
    } catch (_) {
      current = null;
    }

    final originLat = current?.latitude ?? destLat;
    final originLng = current?.longitude ?? destLng;

    // Fetch route
    _emit(_state.copyWith(
      isRecalculating: true,
      driverPosition: LatLng(originLat, originLng),
    ));

    await _fetchAndApplyRoute(originLat, originLng, destLat, destLng);

    // Speak first instruction
    if (_instructions.isNotEmpty) {
      AzureTtsService().speakImmediate(_instructions[0].instructionText);
    }

    // Start GPS tracking
    _gpsSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 5,
      ),
    ).listen(_onGpsUpdate);
  }

  Future<void> _fetchAndApplyRoute(
      double originLat, double originLng, double destLat, double destLng) async {
    try {
      final token = await _storage.read(key: 'auth_token');
      final uri = Uri.parse(
        '${AppConfig.baseUrl}/navigation/route'
        '?origin_lat=$originLat&origin_lng=$originLng'
        '&dest_lat=$destLat&dest_lng=$destLng',
      );
      final resp = await http.get(
        uri,
        headers: {
          if (token != null) 'Authorization': 'Bearer $token',
        },
      ).timeout(const Duration(seconds: 15));

      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body) as Map<String, dynamic>;
        final rawPolyline = (data['polyline'] as List<dynamic>?) ?? [];
        final polyline = rawPolyline
            .map((p) => LatLng((p[0] as num).toDouble(), (p[1] as num).toDouble()))
            .toList();

        final rawInstrs = (data['instructions'] as List<dynamic>?) ?? [];
        _instructions = rawInstrs
            .map((i) => NavigationInstruction.fromJson(i as Map<String, dynamic>))
            .toList();
        _currentInstrIndex = 0;

        final totalDistM = (data['total_distance_m'] as num?)?.toInt() ?? 0;
        final totalTimeS = (data['total_time_s'] as num?)?.toInt() ?? 0;

        _emit(_state.copyWith(
          polyline: polyline,
          currentInstruction:
              _instructions.isNotEmpty ? _instructions[0] : null,
          nextInstruction:
              _instructions.length > 1 ? _instructions[1] : null,
          remainingDistanceM: totalDistM,
          remainingTimeS: totalTimeS,
          isRecalculating: false,
        ));
      } else {
        _emit(_state.copyWith(isRecalculating: false));
      }
    } catch (_) {
      _emit(_state.copyWith(isRecalculating: false));
    }
  }

  void _onGpsUpdate(Position pos) {
    if (!_isNavigating || _stateController.isClosed) return;

    final driverPos = LatLng(pos.latitude, pos.longitude);
    final heading = pos.heading;

    // Check if arrived at destination
    if (_destination != null) {
      final distToDest = _haversine(
          pos.latitude, pos.longitude, _destination!.latitude, _destination!.longitude);
      if (distToDest < 50) {
        _triggerArrival();
        return;
      }
    }

    // Check next instruction proximity
    if (_currentInstrIndex < _instructions.length) {
      final instr = _instructions[_currentInstrIndex];
      final distToInstr =
          _haversine(pos.latitude, pos.longitude, instr.lat, instr.lng);
      if (distToInstr < 80) {
        AzureTtsService().speak(instr.instructionText);
        _currentInstrIndex++;
      }
    }

    // Check deviation from polyline
    if (_state.polyline.isNotEmpty) {
      final distToPolyline = _distanceToPolyline(
          pos.latitude, pos.longitude, _state.polyline);
      if (distToPolyline > 150 && !_state.isRecalculating) {
        _emit(_state.copyWith(isRecalculating: true));
        AzureTtsService().speak('Route recalculated');
        if (_destination != null) {
          _fetchAndApplyRoute(
              pos.latitude, pos.longitude,
              _destination!.latitude, _destination!.longitude);
        }
      }
    }

    // Calculate remaining distance (approximate)
    int remainingDist = _state.remainingDistanceM;
    if (_destination != null) {
      remainingDist =
          _haversine(pos.latitude, pos.longitude, _destination!.latitude,
                  _destination!.longitude)
              .round();
    }

    // ETA based on current speed (m/s → km/h)
    final speedKmh = pos.speed * 3.6;
    final effectiveSpeed = speedKmh > 5 ? speedKmh : 20.0; // default 20km/h
    final remainingTimeS =
        ((remainingDist / 1000) / effectiveSpeed * 3600).round();

    final nextInstr = _currentInstrIndex < _instructions.length
        ? _instructions[_currentInstrIndex]
        : null;
    final afterNextInstr = _currentInstrIndex + 1 < _instructions.length
        ? _instructions[_currentInstrIndex + 1]
        : null;

    _emit(_state.copyWith(
      driverPosition: driverPos,
      driverHeading: heading,
      currentInstruction: nextInstr,
      nextInstruction: afterNextInstr,
      remainingDistanceM: remainingDist,
      remainingTimeS: remainingTimeS,
      isRecalculating: false,
    ));
  }

  void _triggerArrival() {
    _gpsSub?.cancel();
    _gpsSub = null;
    AzureTtsService()
        .speakImmediate("You have arrived at ${_destinationName ?? 'the'}'s address");

    _emit(_state.copyWith(
      hasArrived: true,
      arrivalCountdownSeconds: 30,
    ));

    int countdown = 30;
    _arrivalTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      countdown--;
      _emit(_state.copyWith(arrivalCountdownSeconds: countdown));
      if (countdown <= 0) {
        timer.cancel();
        onArrivalComplete?.call();
      }
    });
  }

  Future<void> stopNavigation() async {
    _isNavigating = false;
    _gpsSub?.cancel();
    _gpsSub = null;
    _arrivalTimer?.cancel();
    _arrivalTimer = null;
    _instructions = [];
    _currentInstrIndex = 0;
    _destination = null;
    _emit(const NavigationState());
  }

  // Haversine distance in meters
  double _haversine(double lat1, double lon1, double lat2, double lon2) {
    const R = 6371000.0;
    final dLat = _toRad(lat2 - lat1);
    final dLon = _toRad(lon2 - lon1);
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRad(lat1)) * cos(_toRad(lat2)) * sin(dLon / 2) * sin(dLon / 2);
    return R * 2 * atan2(sqrt(a), sqrt(1 - a));
  }

  double _toRad(double deg) => deg * pi / 180;

  // Minimum distance from point to polyline (meters)
  double _distanceToPolyline(double lat, double lon, List<LatLng> poly) {
    if (poly.isEmpty) return double.infinity;
    double minDist = double.infinity;
    for (final p in poly) {
      final d = _haversine(lat, lon, p.latitude, p.longitude);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }

  void dispose() {
    _isNavigating = false;
    _gpsSub?.cancel();
    _arrivalTimer?.cancel();
    _stateController.close();
  }
}

// Flutter callback type
typedef VoidCallback = void Function();
