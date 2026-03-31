import 'dart:async';
import 'package:confetti/confetti.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:latlong2/latlong.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:neardrop/core/constants/strings.dart';
import 'package:neardrop/core/di/service_locator.dart';
import 'package:neardrop/core/network/websocket_service.dart';
import 'package:neardrop/core/theme/app_theme.dart';
import 'package:neardrop/features/driver/bloc/delivery_bloc.dart';
import 'package:neardrop/features/driver/bloc/delivery_event.dart';
import 'package:neardrop/features/driver/bloc/delivery_state.dart';
import 'package:neardrop/features/driver/bloc/voice_bloc.dart';
import 'package:neardrop/features/driver/bloc/voice_event.dart';
import 'package:neardrop/features/driver/bloc/voice_state.dart';
import 'package:neardrop/features/driver/screens/history_screen.dart';
import 'package:neardrop/features/driver/widgets/delivery_status_card.dart';
import 'package:neardrop/features/driver/widgets/hub_drop_sheet.dart';
import 'package:neardrop/features/driver/widgets/voice_mic_button.dart';
import 'package:neardrop/shared/widgets/offline_banner.dart';

class ActiveDeliveryScreen extends StatefulWidget {
  final int driverId;

  const ActiveDeliveryScreen({super.key, required this.driverId});

  @override
  State<ActiveDeliveryScreen> createState() => _ActiveDeliveryScreenState();
}

class _ActiveDeliveryScreenState extends State<ActiveDeliveryScreen>
    with TickerProviderStateMixin {
  final FlutterTts _tts = FlutterTts();
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

  static const LatLng _defaultLocation = LatLng(17.4239, 78.4738);

  @override
  void initState() {
    super.initState();
    _initLocation();
    _initTts();
    _initAnimations();
    _subscribeToWebSocket();
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

  void _subscribeToWebSocket() {
    _wsSub = sl<WebSocketService>().events.listen((event) {
      if (!mounted) return;
      final type = event['type'] as String?;
      final driverId = event['driver_id'] as int?;

      // Only handle events for this driver
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

    // Show success animation
    setState(() => _showNextDeliveryAnimation = true);
    _successAnimController.forward(from: 0);

    // Speak
    await _speak('Delivery complete. Next stop: $nextAddress');

    // After 1.5 seconds: hide animation and refresh delivery data
    await Future<void>.delayed(const Duration(milliseconds: 1500));
    if (!mounted) return;
    setState(() => _showNextDeliveryAnimation = false);
    _successAnimController.reset();

    context.read<DeliveryBloc>().add(DeliveryLoadRequested(widget.driverId));
  }

  void _handleBatchComplete(Map<String, dynamic> event) {
    setState(() {
      _showBatchComplete = true;
      _batchCompleteData = event;
    });
    _confettiController.play();

    // Navigate to history after 3 seconds
    Future<void>.delayed(const Duration(seconds: 3)).then((_) {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => HistoryScreen(driverId: widget.driverId),
        ),
      );
    });
  }

  Future<void> _initTts() async {
    await _tts.setLanguage('en-IN');
    await _tts.setSpeechRate(0.5);
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

  Future<void> _speak(String text) async {
    await _tts.speak(text);
  }

  void _handleVoiceCommand(
    BuildContext context,
    VoiceCommandRecognized state,
  ) {
    final deliveryState = context.read<DeliveryBloc>().state;
    if (deliveryState is! DeliveryLoaded || deliveryState.delivery == null) return;
    final delivery = deliveryState.delivery!;

    switch (state.intent) {
      case 'delivered':
        context
            .read<DeliveryBloc>()
            .add(DeliveryCompleteRequested(delivery.id));
        _speak(AppStrings.deliveryComplete);
        break;
      case 'failed':
        final loc = _currentLocation ?? _defaultLocation;
        context.read<DeliveryBloc>().add(DeliveryFailRequested(
              deliveryId: delivery.id,
              lat: loc.latitude,
              lng: loc.longitude,
            ));
        _speak(AppStrings.broadcastingHubs);
        break;
      case 'arrived':
        _speak(AppStrings.arrivalConfirmed);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text(AppStrings.arrivalConfirmed)),
        );
        break;
      default:
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('"${state.transcript}" — ${AppStrings.unrecognizedCommand}'),
          ),
        );
    }
    context.read<VoiceBloc>().add(const VoiceReset());
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    _tts.stop();
    _successAnimController.dispose();
    _confettiController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Batch complete overlay takes priority
    if (_showBatchComplete) {
      return _BatchCompleteView(
        confettiController: _confettiController,
        data: _batchCompleteData ?? {},
      );
    }

    return Stack(
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

    final driverLoc = _currentLocation ?? _defaultLocation;

    return Stack(
      children: [
        FlutterMap(
          options: MapOptions(
            initialCenter: driverLoc,
            initialZoom: 14,
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.neardrop.app',
            ),
            MarkerLayer(
              markers: [
                Marker(
                  point: driverLoc,
                  width: 40,
                  height: 40,
                  child: const Icon(
                    Icons.two_wheeler_rounded,
                    color: AppColors.accent,
                    size: 32,
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
                  onStatusChange: (status) {
                    if (status == 'delivered') {
                      context.read<DeliveryBloc>().add(
                            DeliveryCompleteRequested(delivery.id),
                          );
                    } else if (status == 'failed') {
                      final loc = _currentLocation ?? _defaultLocation;
                      context.read<DeliveryBloc>().add(DeliveryFailRequested(
                            deliveryId: delivery.id,
                            lat: loc.latitude,
                            lng: loc.longitude,
                          ));
                    }
                  },
                ),
                const SizedBox(height: 24),
                BlocBuilder<VoiceBloc, VoiceState>(
                  builder: (context, voiceState) {
                    return Center(
                      child: VoiceMicButton(
                        state: voiceState,
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
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Batch Complete full-screen overlay ───────────────────────────────────────

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

// ─── Utility views (unchanged from original) ─────────────────────────────────

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
