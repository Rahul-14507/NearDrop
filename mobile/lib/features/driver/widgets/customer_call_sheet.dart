import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:neardrop/core/config/app_config.dart';
import 'package:neardrop/core/theme/app_theme.dart';

// ── Call state enum ───────────────────────────────────────────────────────────

enum _CallState { initializing, calling, connected, ended, unanswered }

// ── Widget ────────────────────────────────────────────────────────────────────

class CustomerCallSheet extends StatefulWidget {
  final int deliveryId;
  final String customerName;
  final String customerPhone;
  final String address;
  final VoidCallback onDelivered;
  final VoidCallback onNotAvailable;

  const CustomerCallSheet({
    super.key,
    required this.deliveryId,
    required this.customerName,
    required this.customerPhone,
    required this.address,
    required this.onDelivered,
    required this.onNotAvailable,
  });

  @override
  State<CustomerCallSheet> createState() => _CustomerCallSheetState();
}

class _CustomerCallSheetState extends State<CustomerCallSheet>
    with TickerProviderStateMixin {
  _CallState _callState = _CallState.initializing;
  bool _isLoading = false;

  // Animated dots for "Calling..." animation
  late AnimationController _dot1Ctrl;
  late AnimationController _dot2Ctrl;
  late AnimationController _dot3Ctrl;

  // 30-second no-answer timer
  Timer? _noAnswerTimer;

  @override
  void initState() {
    super.initState();
    _initDotAnimations();
    _initCall();
  }

  void _initDotAnimations() {
    _dot1Ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..repeat(reverse: true);

    _dot2Ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    _dot3Ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    // Stagger start
    Future<void>.delayed(const Duration(milliseconds: 200), () {
      if (mounted) _dot2Ctrl.repeat(reverse: true);
    });
    Future<void>.delayed(const Duration(milliseconds: 400), () {
      if (mounted) _dot3Ctrl.repeat(reverse: true);
    });
  }

  Future<void> _initCall() async {
    // 1. Get ACS token
    try {
      final token =
          await const FlutterSecureStorage().read(key: 'auth_token');

      final tokenResp = await http.post(
        Uri.parse('${AppConfig.baseUrl}/call/token'),
        headers: {
          if (token != null) 'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (!mounted) return;

      if (tokenResp.statusCode != 200) {
        _showError('Could not get call token (${tokenResp.statusCode})');
        setState(() => _callState = _CallState.ended);
        return;
      }

      // 2. Initiate call
      final initiateResp = await http.post(
        Uri.parse('${AppConfig.baseUrl}/call/initiate'),
        headers: {
          if (token != null) 'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'delivery_id': widget.deliveryId}),
      );

      if (!mounted) return;

      if (initiateResp.statusCode != 200 &&
          initiateResp.statusCode != 201) {
        _showError('Could not initiate call (${initiateResp.statusCode})');
        setState(() => _callState = _CallState.ended);
        return;
      }

      // 3. Now calling — start 30-second no-answer timer
      if (mounted) {
        setState(() => _callState = _CallState.calling);
        _noAnswerTimer = Timer(const Duration(seconds: 30), () {
          if (mounted && _callState == _CallState.calling) {
            setState(() => _callState = _CallState.unanswered);
            _noAnswerTimer = null;
          }
        });
      }
    } catch (e) {
      if (mounted) {
        _showError('Error starting call: $e');
        setState(() => _callState = _CallState.ended);
      }
    }
  }

  Future<void> _endCall() async {
    _noAnswerTimer?.cancel();
    _noAnswerTimer = null;
    setState(() => _callState = _CallState.ended);
  }

  Future<void> _markDelivered() async {
    setState(() => _isLoading = true);
    try {
      final token =
          await const FlutterSecureStorage().read(key: 'auth_token');
      final resp = await http.post(
        Uri.parse(
            '${AppConfig.baseUrl}/delivery/${widget.deliveryId}/complete'),
        headers: {
          if (token != null) 'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );
      if (!mounted) return;
      if (resp.statusCode == 200 || resp.statusCode == 201) {
        Navigator.of(context).pop();
        widget.onDelivered();
      } else {
        _showError('Failed to mark delivered (${resp.statusCode})');
      }
    } catch (e) {
      if (mounted) _showError('Network error: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _markNotAvailable() {
    Navigator.of(context).pop();
    widget.onNotAvailable();
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.error,
      ),
    );
  }

  @override
  void dispose() {
    _dot1Ctrl.dispose();
    _dot2Ctrl.dispose();
    _dot3Ctrl.dispose();
    _noAnswerTimer?.cancel();
    super.dispose();
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 32,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle bar
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: AppColors.divider,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Title
          Text(
            'Call Customer',
            style: theme.textTheme.titleLarge?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),

          // Customer info
          Row(
            children: [
              const Icon(Icons.person_rounded,
                  color: AppColors.accent, size: 18),
              const SizedBox(width: 8),
              Text(
                widget.customerName,
                style: theme.textTheme.bodyLarge?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.location_on_outlined,
                  color: AppColors.textSecondary, size: 16),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  widget.address,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Call card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.divider),
            ),
            child: _callState == _CallState.initializing
                ? _InitializingView()
                : _callState == _CallState.calling
                    ? _CallingView(
                        name: widget.customerName,
                        phone: widget.customerPhone,
                        dot1: _dot1Ctrl,
                        dot2: _dot2Ctrl,
                        dot3: _dot3Ctrl,
                        onEndCall: _endCall,
                      )
                    : _callState == _CallState.connected
                        ? _ConnectedView(
                            name: widget.customerName,
                            phone: widget.customerPhone,
                            onEndCall: _endCall,
                          )
                        : _callState == _CallState.unanswered
                            ? _UnansweredView(
                                name: widget.customerName,
                              )
                            : _EndedView(name: widget.customerName),
          ),

          // Show outcome buttons after call ends or no answer
          if (_callState == _CallState.ended ||
              _callState == _CallState.unanswered) ...[
            const SizedBox(height: 20),
            Text(
              'After the call:',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 12),
            if (_isLoading)
              const Center(
                child: CircularProgressIndicator(color: AppColors.accent),
              )
            else
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.success,
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(50),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      icon: const Icon(Icons.check_rounded, size: 18),
                      label: const Text(
                        'Delivered',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      onPressed: _markDelivered,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.error,
                        side: const BorderSide(color: AppColors.error),
                        minimumSize: const Size.fromHeight(50),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      icon: const Icon(Icons.close_rounded, size: 18),
                      label: const Text(
                        'Not Available',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      onPressed: _markNotAvailable,
                    ),
                  ),
                ],
              ),
          ],
        ],
      ),
    );
  }
}

// ── Sub-views ─────────────────────────────────────────────────────────────────

class _InitializingView extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return const Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircularProgressIndicator(color: AppColors.accent),
        SizedBox(height: 12),
        Text(
          'Connecting...',
          style: TextStyle(color: AppColors.textSecondary),
        ),
      ],
    );
  }
}

class _CallingView extends StatelessWidget {
  final String name;
  final String phone;
  final AnimationController dot1;
  final AnimationController dot2;
  final AnimationController dot3;
  final VoidCallback onEndCall;

  const _CallingView({
    required this.name,
    required this.phone,
    required this.dot1,
    required this.dot2,
    required this.dot3,
    required this.onEndCall,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Calling indicator row
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 10,
              height: 10,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.error,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'Calling',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: AppColors.error,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 2),
            _AnimatedDot(controller: dot1),
            _AnimatedDot(controller: dot2),
            _AnimatedDot(controller: dot3),
          ],
        ),
        const SizedBox(height: 16),
        Text(
          name,
          style: theme.textTheme.titleMedium?.copyWith(
            color: Colors.white,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          phone,
          style: theme.textTheme.bodySmall?.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 20),
        ElevatedButton.icon(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.error,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          icon: const Icon(Icons.call_end_rounded, size: 18),
          label: const Text('End Call'),
          onPressed: onEndCall,
        ),
      ],
    );
  }
}

class _ConnectedView extends StatelessWidget {
  final String name;
  final String phone;
  final VoidCallback onEndCall;

  const _ConnectedView({
    required this.name,
    required this.phone,
    required this.onEndCall,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 10,
              height: 10,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.success,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'Connected',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: AppColors.success,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Text(
          name,
          style: theme.textTheme.titleMedium?.copyWith(
            color: Colors.white,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          phone,
          style: theme.textTheme.bodySmall?.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 20),
        ElevatedButton.icon(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.error,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          icon: const Icon(Icons.call_end_rounded, size: 18),
          label: const Text('End Call'),
          onPressed: onEndCall,
        ),
      ],
    );
  }
}

class _EndedView extends StatelessWidget {
  final String name;
  const _EndedView({required this.name});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(
          Icons.call_end_rounded,
          color: AppColors.textSecondary,
          size: 32,
        ),
        const SizedBox(height: 10),
        Text(
          'Call ended',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }
}

class _UnansweredView extends StatelessWidget {
  final String name;
  const _UnansweredView({required this.name});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(
          Icons.phone_missed_rounded,
          color: AppColors.warning,
          size: 32,
        ),
        const SizedBox(height: 10),
        Text(
          'Customer didn\'t answer',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: AppColors.warning,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          name,
          style: theme.textTheme.bodySmall?.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }
}

// ── Animated dot ──────────────────────────────────────────────────────────────

class _AnimatedDot extends StatelessWidget {
  final AnimationController controller;

  const _AnimatedDot({required this.controller});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, child) {
        return Opacity(
          opacity: controller.value.clamp(0.2, 1.0),
          child: const Text(
            '.',
            style: TextStyle(
              color: AppColors.error,
              fontSize: 20,
              fontWeight: FontWeight.bold,
              height: 1.0,
            ),
          ),
        );
      },
    );
  }
}
