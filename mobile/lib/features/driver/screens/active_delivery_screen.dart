import 'dart:async';
import 'package:battery_plus/battery_plus.dart';
import 'package:confetti/confetti.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:neardrop/core/constants/strings.dart';
import 'package:neardrop/core/di/service_locator.dart';
import 'package:neardrop/core/network/websocket_service.dart';
import 'package:neardrop/core/services/azure_tts_service.dart';
import 'package:neardrop/core/services/navigation_engine.dart';
import 'package:neardrop/core/theme/app_theme.dart';
import 'package:neardrop/features/driver/bloc/delivery_bloc.dart';
import 'package:neardrop/features/driver/bloc/delivery_event.dart';
import 'package:neardrop/features/driver/bloc/delivery_state.dart';
import 'package:neardrop/features/driver/bloc/voice_bloc.dart';
import 'package:neardrop/features/driver/bloc/voice_event.dart';
import 'package:neardrop/features/driver/bloc/voice_state.dart';
import 'package:neardrop/features/driver/models/delivery_model.dart';
import 'package:neardrop/features/driver/screens/history_screen.dart';
import 'package:neardrop/features/driver/widgets/customer_call_sheet.dart';
import 'package:neardrop/features/driver/widgets/delivery_status_card.dart';
import 'package:neardrop/features/driver/widgets/hub_drop_sheet.dart';
import 'package:neardrop/features/driver/widgets/voice_mic_button.dart';
import 'package:neardrop/shared/widgets/offline_banner.dart';

// ── Maneuver icon map ─────────────────────────────────────────────────────────

const Map<String, IconData> _maneuverIcons = {
  'TURN_LEFT': Icons.turn_left,
  'TURN_RIGHT': Icons.turn_right,
  'KEEP_LEFT': Icons.arrow_back,
  'KEEP_RIGHT': Icons.arrow_forward,
  'STRAIGHT': Icons.straight,
  'ARRIVE': Icons.location_on,
  'DEPART': Icons.navigation,
  'ROUNDABOUT_LEFT': Icons.rotate_left,
  'ROUNDABOUT_RIGHT': Icons.rotate_right,
};

// ── Screen ────────────────────────────────────────────────────────────────────

class ActiveDeliveryScreen extends StatefulWidget {
  final int driverId;

  const ActiveDeliveryScreen({super.key, required this.driverId});

  @override
  State<ActiveDeliveryScreen> createState() => _ActiveDeliveryScreenState();
}

class _ActiveDeliveryScreenState extends State<ActiveDeliveryScreen>
    with TickerProviderStateMixin {
  LatLng? _currentLocation;
  bool _isOffline = false;

  // WS subscription
  StreamSubscription<Map<String, dynamic>>? _wsSub;

  // next_delivery success animation
  bool _showNextDeliveryAnimation = false;
  late AnimationController _successAnimController;
  late Animation<double> _successScaleAnim;

  // batch_complete overlay
  bool _showBatchComplete = false;
  Map<String, dynamic>? _batchCompleteData;
  late ConfettiController _confettiController;

  // Navigation state
  bool _navigationStarted = false;
  NavigationState? _navState;
  StreamSubscription<NavigationState>? _navSub;

  // Wakelock and battery
  final Battery _battery = Battery();
  int _batteryLevel = 100;
  bool _showBatteryWarning = false;
  StreamSubscription<BatteryState>? _batteryStateSub;

  final MapController _mapController = MapController();

  static const LatLng _defaultLocation = LatLng(17.4239, 78.4738);

  @override
  void initState() {
    super.initState();
    _initLocation();
    _initAnimations();
    _subscribeToWebSocket();
    _initBattery();
  }

  void _initAnimations() {
    _successAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _successScaleAnim = CurvedAnimation(
      parent: _successAnimController,
      curve: Curves.elasticOut,
    );
    _confettiController = ConfettiController(
      duration: const Duration(seconds: 3),
    );
  }

  Future<void> _initBattery() async {
    try {
      _batteryLevel = await _battery.batteryLevel;
      _showBatteryWarning = _batteryLevel < 15;
      if (mounted) setState(() {});

      _batteryStateSub = _battery.onBatteryStateChanged.listen((_) async {
        final level = await _battery.batteryLevel;
        if (mounted) {
          setState(() {
            _batteryLevel = level;
            _showBatteryWarning = level < 15;
          });
        }
      });
    } catch (_) {
      // battery_plus unavailable on some platforms — silently ignore
    }
  }

  void _subscribeToWebSocket() {
    _wsSub = sl<WebSocketService>().events.listen((event) {
      if (!mounted) return;
      final type = event['type'] as String?;
      final driverId = event['driver_id'] as int?;

      if (driverId != null && driverId != widget.driverId) return;

      if (type == 'next_delivery') {
        _handleNextDelivery(event);
      } else if (type == 'batch_complete') {
        _handleBatchComplete(event);
      }
    });
  }

  void _handleNextDelivery(Map<String, dynamic> event) async {
    final deliveryData = event['delivery'] as Map<String, dynamic>?;
    final nextAddress = deliveryData?['address'] as String? ?? 'next stop';

    // Stop any active navigation session
    if (_navigationStarted) {
      await _stopNavigation();
    }

    setState(() => _showNextDeliveryAnimation = true);
    _successAnimController.forward(from: 0);

    AzureTtsService().speak('Delivery complete. Next stop: $nextAddress');

    await Future<void>.delayed(const Duration(milliseconds: 1500));
    if (!mounted) return;
    setState(() => _showNextDeliveryAnimation = false);
    _successAnimController.reset();

    context.read<DeliveryBloc>().add(DeliveryLoadRequested(widget.driverId));
  }

  void _handleBatchComplete(Map<String, dynamic> event) {
    if (_navigationStarted) _stopNavigation();
    setState(() {
      _showBatchComplete = true;
      _batchCompleteData = event;
    });
    _confettiController.play();

    Future<void>.delayed(const Duration(seconds: 3)).then((_) {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => HistoryScreen(driverId: widget.driverId),
        ),
      );
    });
  }

  Future<void> _initLocation() async {
    final status = await Permission.location.request();
    if (status.isGranted) {
      try {
        final pos = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
        );
        if (mounted) {
          setState(() {
            _currentLocation = LatLng(pos.latitude, pos.longitude);
          });
        }
      } catch (_) {
        if (mounted) setState(() => _currentLocation = _defaultLocation);
      }
    } else {
      if (mounted) setState(() => _currentLocation = _defaultLocation);
    }
  }

  void _handleVoiceCommand(
    BuildContext context,
    VoiceCommandRecognized state,
  ) {
    final deliveryState = context.read<DeliveryBloc>().state;
    if (deliveryState is! DeliveryLoaded || deliveryState.delivery == null) {
      return;
    }
    final delivery = deliveryState.delivery!;

    switch (state.intent) {
      case 'delivered':
        context
            .read<DeliveryBloc>()
            .add(DeliveryCompleteRequested(delivery.id));
        AzureTtsService().speak(AppStrings.deliveryComplete);
        break;
      case 'failed':
        final loc = _currentLocation ?? _defaultLocation;
        context.read<DeliveryBloc>().add(DeliveryFailRequested(
              deliveryId: delivery.id,
              lat: loc.latitude,
              lng: loc.longitude,
            ));
        AzureTtsService().speak(AppStrings.broadcastingHubs);
        break;
      case 'arrived':
        AzureTtsService().speak(AppStrings.arrivalConfirmed);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text(AppStrings.arrivalConfirmed)),
        );
        break;
      default:
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                '"${state.transcript}" — ${AppStrings.unrecognizedCommand}'),
          ),
        );
    }
    context.read<VoiceBloc>().add(const VoiceReset());
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  Future<void> _startNavigation(DeliveryModel delivery) async {
    setState(() => _navigationStarted = true);
    await WakelockPlus.enable();

    await NavigationEngine().startNavigation(
      destLat: delivery.lat ?? 17.4239,
      destLng: delivery.lng ?? 78.4738,
      customerName: delivery.recipientName ?? 'Customer',
      onArrival: () {
        if (!mounted) return;
        // Show CustomerCallSheet on arrival
        _showCustomerCallSheet(delivery);
      },
    );

    _navSub = NavigationEngine().stateStream.listen((navState) {
      if (!mounted) return;
      setState(() => _navState = navState);

      // Keep map camera centered on driver
      if (navState.driverPosition != null) {
        try {
          _mapController.move(
            navState.driverPosition!,
            16,
          );
          if (navState.driverHeading != null) {
            _mapController.rotate(-navState.driverHeading!);
          }
        } catch (_) {}
      }
    });
  }

  Future<void> _stopNavigation() async {
    _navSub?.cancel();
    _navSub = null;
    await NavigationEngine().stopNavigation();
    await WakelockPlus.disable();
    if (mounted) {
      setState(() {
        _navigationStarted = false;
        _navState = null;
      });
    }
  }

  void _showCustomerCallSheet(DeliveryModel delivery) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CustomerCallSheet(
        deliveryId: delivery.id,
        customerName: delivery.recipientName ?? 'Customer',
        customerPhone: '',
        address: delivery.address,
        onDelivered: () {
          context
              .read<DeliveryBloc>()
              .add(DeliveryCompleteRequested(delivery.id));
        },
        onNotAvailable: () {
          final loc = _currentLocation ?? _defaultLocation;
          context.read<DeliveryBloc>().add(DeliveryFailRequested(
                deliveryId: delivery.id,
                lat: loc.latitude,
                lng: loc.longitude,
              ));
        },
      ),
    );
  }

  // ── Back button during navigation ──────────────────────────────────────────

  Future<bool> _onWillPop() async {
    if (!_navigationStarted) return true;
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text(
          'Stop navigation?',
          style: TextStyle(color: Colors.white),
        ),
        content: const Text(
          'Stop navigation and exit?',
          style: TextStyle(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Stay'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text(
              'Stop',
              style: TextStyle(color: AppColors.error),
            ),
          ),
        ],
      ),
    );
    if (result == true) {
      await _stopNavigation();
    }
    return false; // Never pop — we handle navigation ourselves
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    _navSub?.cancel();
    _batteryStateSub?.cancel();
    NavigationEngine().stopNavigation();
    WakelockPlus.disable();
    AzureTtsService().stop();
    _successAnimController.dispose();
    _confettiController.dispose();
    super.dispose();
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    if (_showBatchComplete) {
      return _BatchCompleteView(
        confettiController: _confettiController,
        data: _batchCompleteData ?? {},
      );
    }

    return WillPopScope(
      onWillPop: _onWillPop,
      child: Stack(
        children: [
          BlocListener<VoiceBloc, VoiceState>(
            listener: (context, voiceState) {
              if (voiceState is VoiceCommandRecognized) {
                _handleVoiceCommand(context, voiceState);
              } else if (voiceState is VoiceError) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(voiceState.message),
                    backgroundColor: AppColors.error,
                  ),
                );
              }
            },
            child: BlocBuilder<DeliveryBloc, DeliveryState>(
              builder: (context, state) {
                return Column(
                  children: [
                    if (_showBatteryWarning) _BatteryWarningBanner(level: _batteryLevel),
                    if (_isOffline) const OfflineBanner(),
                    Expanded(child: _buildBody(context, state)),
                  ],
                );
              },
            ),
          ),

          // Next-delivery success flash overlay
          if (_showNextDeliveryAnimation)
            Positioned.fill(
              child: IgnorePointer(
                child: Container(
                  color: Colors.black45,
                  child: Center(
                    child: ScaleTransition(
                      scale: _successScaleAnim,
                      child: Container(
                        width: 100,
                        height: 100,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.success.withOpacity(0.15),
                        ),
                        child: const Icon(
                          Icons.check_circle_rounded,
                          color: AppColors.success,
                          size: 64,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildBody(BuildContext context, DeliveryState state) {
    if (state is DeliveryLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.accent),
      );
    }

    if (state is DeliveryCompleted) {
      return _SuccessView(onRefresh: () {
        context
            .read<DeliveryBloc>()
            .add(DeliveryLoadRequested(widget.driverId));
      });
    }

    if (state is DeliveryError) {
      return _ErrorView(
        message: state.message,
        onRetry: () => context
            .read<DeliveryBloc>()
            .add(DeliveryLoadRequested(widget.driverId)),
      );
    }

    if (state is DeliveryLoaded && state.delivery == null) {
      return _NoDeliveryView(
        onRefresh: () => context
            .read<DeliveryBloc>()
            .add(DeliveryLoadRequested(widget.driverId)),
      );
    }

    if (state is DeliveryFailed) {
      return DraggableScrollableSheet(
        initialChildSize: 0.5,
        minChildSize: 0.3,
        maxChildSize: 0.9,
        builder: (_, controller) => HubDropSheet(hubs: state.nearbyHubs),
      );
    }

    final delivery = state is DeliveryLoaded ? state.delivery : null;
    if (delivery == null) {
      return const Center(
          child: CircularProgressIndicator(color: AppColors.accent));
    }

    if (_navigationStarted && _navState != null) {
      return _NavigationView(
        delivery: delivery,
        navState: _navState!,
        mapController: _mapController,
        currentLocation: _currentLocation ?? _defaultLocation,
        onCallTap: () => _showCustomerCallSheet(delivery),
        onFailTap: () {
          final loc = _currentLocation ?? _defaultLocation;
          context.read<DeliveryBloc>().add(DeliveryFailRequested(
                deliveryId: delivery.id,
                lat: loc.latitude,
                lng: loc.longitude,
              ));
        },
      );
    }

    return _PreNavigationView(
      delivery: delivery,
      currentLocation: _currentLocation ?? _defaultLocation,
      mapController: _mapController,
      onStartNavigation: () => _startNavigation(delivery),
      onStatusChange: (status) {
        if (status == 'delivered') {
          context
              .read<DeliveryBloc>()
              .add(DeliveryCompleteRequested(delivery.id));
        } else if (status == 'failed') {
          final loc = _currentLocation ?? _defaultLocation;
          context.read<DeliveryBloc>().add(DeliveryFailRequested(
                deliveryId: delivery.id,
                lat: loc.latitude,
                lng: loc.longitude,
              ));
        }
      },
    );
  }
}

// ── Pre-navigation view ───────────────────────────────────────────────────────

class _PreNavigationView extends StatelessWidget {
  final DeliveryModel delivery;
  final LatLng currentLocation;
  final MapController mapController;
  final VoidCallback onStartNavigation;
  final void Function(String) onStatusChange;

  const _PreNavigationView({
    required this.delivery,
    required this.currentLocation,
    required this.mapController,
    required this.onStartNavigation,
    required this.onStatusChange,
  });

  @override
  Widget build(BuildContext context) {
    // Use lat/lng directly from the delivery model.
    final destLatLng = (delivery.lat != null && delivery.lng != null)
        ? LatLng(delivery.lat!, delivery.lng!)
        : null;

    return Stack(
      children: [
        FlutterMap(
          mapController: mapController,
          options: MapOptions(
            initialCenter: currentLocation,
            initialZoom: 13,
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.neardrop.app',
            ),
            MarkerLayer(
              markers: [
                Marker(
                  point: currentLocation,
                  width: 40,
                  height: 40,
                  child: const Icon(
                    Icons.two_wheeler_rounded,
                    color: AppColors.accent,
                    size: 32,
                  ),
                ),
                if (destLatLng != null)
                  Marker(
                    point: destLatLng,
                    width: 40,
                    height: 40,
                    child: const Icon(
                      Icons.location_on_rounded,
                      color: AppColors.error,
                      size: 36,
                    ),
                  ),
              ],
            ),
          ],
        ),
        DraggableScrollableSheet(
          initialChildSize: 0.52,
          minChildSize: 0.2,
          maxChildSize: 0.85,
          builder: (_, controller) => Container(
            decoration: const BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: ListView(
              controller: controller,
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: AppColors.divider,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                DeliveryStatusCard(
                  delivery: delivery,
                  onStatusChange: onStatusChange,
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.accent,
                      foregroundColor: AppColors.background,
                      minimumSize: const Size.fromHeight(52),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    icon: const Icon(Icons.rocket_launch_rounded, size: 20),
                    label: const Text(
                      'Start Navigation',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    onPressed: onStartNavigation,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ── Active navigation view ────────────────────────────────────────────────────

class _NavigationView extends StatelessWidget {
  final DeliveryModel delivery;
  final NavigationState navState;
  final MapController mapController;
  final LatLng currentLocation;
  final VoidCallback onCallTap;
  final VoidCallback onFailTap;

  const _NavigationView({
    required this.delivery,
    required this.navState,
    required this.mapController,
    required this.currentLocation,
    required this.onCallTap,
    required this.onFailTap,
  });

  String _formatDistance(int metres) {
    if (metres >= 1000) {
      return '${(metres / 1000).toStringAsFixed(1)} km';
    }
    return '${metres} m';
  }

  String _formatTime(int seconds) {
    final minutes = (seconds / 60).round();
    if (minutes < 60) return '$minutes min';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    return m == 0 ? '${h}h' : '${h}h ${m}min';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final currentInstr = navState.currentInstruction;
    final nextInstr = navState.nextInstruction;
    final driverPos = navState.driverPosition ?? currentLocation;

    return Column(
      children: [
        // Top instruction banner
        Container(
          color: navState.isRecalculating
              ? AppColors.warning.withOpacity(0.9)
              : AppColors.background,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: navState.isRecalculating
              ? Row(
                  children: [
                    const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        color: AppColors.background,
                        strokeWidth: 2,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      'Recalculating route...',
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: AppColors.background,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                )
              : navState.hasArrived
                  ? _ArrivalBanner(
                      countdown: navState.arrivalCountdownSeconds ?? 0)
                  : currentInstr != null
                      ? Row(
                          children: [
                            Icon(
                              _maneuverIcons[currentInstr.maneuver] ??
                                  Icons.straight,
                              color: Colors.white,
                              size: 28,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                currentInstr.instructionText,
                                style: theme.textTheme.titleMedium?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              _formatDistance(currentInstr.distanceM),
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: AppColors.accent,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        )
                      : Row(
                          children: [
                            const Icon(Icons.navigation,
                                color: AppColors.accent),
                            const SizedBox(width: 12),
                            Text(
                              'Navigating...',
                              style: theme.textTheme.titleMedium?.copyWith(
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
        ),

        // Map — 60% of remaining space
        Expanded(
          flex: 6,
          child: FlutterMap(
            mapController: mapController,
            options: MapOptions(
              initialCenter: driverPos,
              initialZoom: 16,
            ),
            children: [
              TileLayer(
                urlTemplate:
                    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.neardrop.app',
              ),
              if (navState.polyline.isNotEmpty)
                PolylineLayer(
                  polylines: [
                    Polyline(
                      points: navState.polyline,
                      strokeWidth: 4,
                      color: AppColors.accent,
                    ),
                  ],
                ),
              MarkerLayer(
                markers: [
                  Marker(
                    point: driverPos,
                    width: 40,
                    height: 40,
                    child: Transform.rotate(
                      angle: (navState.driverHeading ?? 0) * 3.14159 / 180,
                      child: const Icon(
                        Icons.navigation_rounded,
                        color: AppColors.accent,
                        size: 32,
                      ),
                    ),
                  ),
                  if (navState.polyline.isNotEmpty)
                    Marker(
                      point: navState.polyline.last,
                      width: 40,
                      height: 40,
                      child: const Icon(
                        Icons.location_on_rounded,
                        color: AppColors.error,
                        size: 36,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),

        // Next instruction + ETA row
        Container(
          color: AppColors.surface,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (nextInstr != null)
                Row(
                  children: [
                    Icon(
                      _maneuverIcons[nextInstr.maneuver] ?? Icons.straight,
                      color: AppColors.textSecondary,
                      size: 16,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Then: ${nextInstr.instructionText}',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      _formatDistance(nextInstr.distanceM),
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              const SizedBox(height: 4),
              Text(
                'ETA: ${_formatTime(navState.remainingTimeS)} · '
                '${_formatDistance(navState.remainingDistanceM)} remaining',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),

        // Bottom action row — Mic, Call, Fail
        Container(
          color: AppColors.background,
          padding:
              const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          child: BlocBuilder<VoiceBloc, VoiceState>(
            builder: (context, voiceState) {
              return Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  // Mic button (compact)
                  GestureDetector(
                    onTap: () {
                      if (voiceState is VoiceListening) {
                        context
                            .read<VoiceBloc>()
                            .add(const VoiceStopListening());
                      } else if (voiceState is VoiceIdle ||
                          voiceState is VoiceCommandRecognized) {
                        context
                            .read<VoiceBloc>()
                            .add(const VoiceStartListening());
                      }
                    },
                    child: _CompactActionButton(
                      icon: voiceState is VoiceListening
                          ? Icons.mic_rounded
                          : voiceState is VoiceProcessing
                              ? Icons.hourglass_empty_rounded
                              : Icons.mic_none_rounded,
                      label: 'Mic',
                      color: voiceState is VoiceListening
                          ? AppColors.error
                          : AppColors.accent,
                    ),
                  ),

                  // Call button
                  GestureDetector(
                    onTap: onCallTap,
                    child: const _CompactActionButton(
                      icon: Icons.phone_rounded,
                      label: 'Call',
                      color: AppColors.success,
                    ),
                  ),

                  // Fail button
                  GestureDetector(
                    onTap: onFailTap,
                    child: const _CompactActionButton(
                      icon: Icons.close_rounded,
                      label: 'Fail',
                      color: AppColors.error,
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

// ── Arrival banner ────────────────────────────────────────────────────────────

class _ArrivalBanner extends StatelessWidget {
  final int countdown;

  const _ArrivalBanner({required this.countdown});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(Icons.location_on_rounded, color: AppColors.success, size: 28),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            'You have arrived!',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: AppColors.success,
                  fontWeight: FontWeight.bold,
                ),
          ),
        ),
        if (countdown > 0)
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.success, width: 2),
            ),
            child: Center(
              child: Text(
                '$countdown',
                style: const TextStyle(
                  color: AppColors.success,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

// ── Compact action button ─────────────────────────────────────────────────────

class _CompactActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _CompactActionButton({
    required this.icon,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color.withOpacity(0.15),
            border: Border.all(color: color.withOpacity(0.4)),
          ),
          child: Icon(icon, color: color, size: 26),
        ),
        const SizedBox(height: 6),
        Text(
          label,
          style: TextStyle(
            color: AppColors.textSecondary,
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

// ── Battery warning banner ────────────────────────────────────────────────────

class _BatteryWarningBanner extends StatelessWidget {
  final int level;

  const _BatteryWarningBanner({required this.level});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.warning.withOpacity(0.15),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          const Icon(Icons.battery_alert_rounded,
              color: AppColors.warning, size: 18),
          const SizedBox(width: 8),
          Text(
            'Low battery: $level% — plug in to continue navigation',
            style: const TextStyle(
              color: AppColors.warning,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Batch Complete full-screen overlay ────────────────────────────────────────

class _BatchCompleteView extends StatelessWidget {
  final ConfettiController confettiController;
  final Map<String, dynamic> data;

  const _BatchCompleteView({
    required this.confettiController,
    required this.data,
  });

  @override
  Widget build(BuildContext context) {
    final batchCode = data['batch_code'] as String? ?? '';
    final total = data['total'] as int? ?? 0;
    final delivered = data['delivered'] as int? ?? 0;
    final hubDrops = data['hub_drops'] as int? ?? 0;

    return Stack(
      alignment: Alignment.topCenter,
      children: [
        Container(
          color: AppColors.background,
          width: double.infinity,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.emoji_events_rounded,
                color: AppColors.accent,
                size: 72,
              ),
              const SizedBox(height: 20),
              Text(
                'All deliveries done!',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                batchCode,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.accent,
                      fontFamily: 'monospace',
                    ),
              ),
              const SizedBox(height: 32),
              _SummaryRow(
                icon: Icons.check_circle_rounded,
                label: 'Delivered',
                value: '$delivered',
                color: AppColors.success,
              ),
              if (hubDrops > 0)
                _SummaryRow(
                  icon: Icons.store_rounded,
                  label: 'Hub drops',
                  value: '$hubDrops',
                  color: AppColors.accent,
                ),
              _SummaryRow(
                icon: Icons.local_shipping_rounded,
                label: 'Total',
                value: '$total',
                color: AppColors.textSecondary,
              ),
              const SizedBox(height: 40),
              Text(
                'Redirecting to history…',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
              ),
            ],
          ),
        ),
        ConfettiWidget(
          confettiController: confettiController,
          blastDirectionality: BlastDirectionality.explosive,
          shouldLoop: false,
          numberOfParticles: 30,
          colors: const [
            AppColors.accent,
            Colors.white,
            Colors.amber,
          ],
        ),
      ],
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _SummaryRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 6),
      child: Row(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 12),
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
          const Spacer(),
          Text(
            value,
            style: Theme.of(context)
                .textTheme
                .bodyLarge
                ?.copyWith(fontWeight: FontWeight.bold, color: color),
          ),
        ],
      ),
    );
  }
}

// ── Utility views ─────────────────────────────────────────────────────────────

class _SuccessView extends StatelessWidget {
  final VoidCallback onRefresh;
  const _SuccessView({required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 96,
            height: 96,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.success.withOpacity(0.15),
            ),
            child: const Icon(
              Icons.check_circle_rounded,
              color: AppColors.success,
              size: 56,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            AppStrings.deliveryComplete,
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(color: AppColors.success),
          ),
          const SizedBox(height: 32),
          TextButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh_rounded),
            label: Text(AppStrings.refreshDelivery),
          ),
        ],
      ),
    );
  }
}

class _NoDeliveryView extends StatelessWidget {
  final VoidCallback onRefresh;
  const _NoDeliveryView({required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.inbox_rounded,
            color: AppColors.textSecondary,
            size: 64,
          ),
          const SizedBox(height: 16),
          Text(
            AppStrings.noActiveDelivery,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh_rounded, size: 18),
            label: Text(AppStrings.refreshDelivery),
            style: ElevatedButton.styleFrom(
              minimumSize: const Size(160, 44),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded,
                color: AppColors.error, size: 48),
            const SizedBox(height: 16),
            Text(message,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: onRetry,
              child: Text(AppStrings.retry),
            ),
          ],
        ),
      ),
    );
  }
}
