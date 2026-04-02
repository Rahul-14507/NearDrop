import 'dart:convert';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:neardrop/core/config/app_config.dart';
import 'package:neardrop/core/theme/app_theme.dart';

class BatchAssignmentSheet extends StatefulWidget {
  final String batchCode;
  final int totalDeliveries;
  final List<Map<String, dynamic>> deliveries;
  final VoidCallback onAccepted;
  final VoidCallback onRejected;

  const BatchAssignmentSheet({
    super.key,
    required this.batchCode,
    required this.totalDeliveries,
    required this.deliveries,
    required this.onAccepted,
    required this.onRejected,
  });

  @override
  State<BatchAssignmentSheet> createState() => _BatchAssignmentSheetState();
}

class _BatchAssignmentSheetState extends State<BatchAssignmentSheet> {
  bool _showRejectStep = false;
  bool _isLoading = false;
  final TextEditingController _reasonController = TextEditingController();

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  // ── Haversine distance in km ─────────────────────────────────────────────

  double _haversineKm(double lat1, double lon1, double lat2, double lon2) {
    const R = 6371.0;
    final dLat = (lat2 - lat1) * pi / 180;
    final dLon = (lon2 - lon1) * pi / 180;
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(lat1 * pi / 180) *
            cos(lat2 * pi / 180) *
            sin(dLon / 2) *
            sin(dLon / 2);
    return R * 2 * atan2(sqrt(a), sqrt(1 - a));
  }

  // ── Computed properties ───────────────────────────────────────────────────

  double get _totalDistanceKm {
    // Sort by queue_position, skip nulls
    final sorted = List<Map<String, dynamic>>.from(widget.deliveries)
      ..sort((a, b) {
        final qa = (a['queue_position'] as num?)?.toInt() ?? 0;
        final qb = (b['queue_position'] as num?)?.toInt() ?? 0;
        return qa.compareTo(qb);
      });

    final valid = sorted.where((d) {
      final lat = d['lat'];
      final lng = d['lng'];
      return lat != null && lng != null;
    }).toList();

    double total = 0.0;
    for (int i = 0; i < valid.length - 1; i++) {
      final lat1 = (valid[i]['lat'] as num).toDouble();
      final lon1 = (valid[i]['lng'] as num).toDouble();
      final lat2 = (valid[i + 1]['lat'] as num).toDouble();
      final lon2 = (valid[i + 1]['lng'] as num).toDouble();
      total += _haversineKm(lat1, lon1, lat2, lon2);
    }
    return total;
  }

  String get _estimatedTimeStr {
    final distKm = _totalDistanceKm;
    final totalMinutes =
        (distKm / 20 * 60).round() + widget.totalDeliveries * 5;
    final hours = totalMinutes ~/ 60;
    final mins = totalMinutes % 60;
    if (hours == 0) return '${mins}min';
    if (mins == 0) return '${hours}h';
    return '${hours}h ${mins}min';
  }

  List<Map<String, dynamic>> get _sortedDeliveries {
    final sorted = List<Map<String, dynamic>>.from(widget.deliveries)
      ..sort((a, b) {
        final qa = (a['queue_position'] as num?)?.toInt() ?? 0;
        final qb = (b['queue_position'] as num?)?.toInt() ?? 0;
        return qa.compareTo(qb);
      });
    return sorted;
  }

  // Truncate address to neighborhood-level (first part before last comma)
  String _truncateAddress(String address) {
    final parts = address.split(',');
    if (parts.length <= 2) return address;
    // Return first two parts as "neighborhood" approximation
    return '${parts[0].trim()}, ${parts[1].trim()}';
  }

  // ── API calls ─────────────────────────────────────────────────────────────

  Future<void> _acceptBatch() async {
    setState(() => _isLoading = true);
    try {
      final token =
          await const FlutterSecureStorage().read(key: 'auth_token');
      final resp = await http.post(
        Uri.parse('${AppConfig.baseUrl}/batch/${widget.batchCode}/accept'),
        headers: {
          if (token != null) 'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );
      if (!mounted) return;
      if (resp.statusCode == 200 || resp.statusCode == 201) {
        Navigator.of(context).pop();
        widget.onAccepted();
      } else {
        _showError('Failed to accept batch (${resp.statusCode})');
      }
    } catch (e) {
      if (mounted) _showError('Network error: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _rejectBatch() async {
    final reason = _reasonController.text.trim();
    setState(() => _isLoading = true);
    try {
      final token =
          await const FlutterSecureStorage().read(key: 'auth_token');
      final resp = await http.post(
        Uri.parse('${AppConfig.baseUrl}/batch/${widget.batchCode}/reject'),
        headers: {
          if (token != null) 'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'reason': reason}),
      );
      if (!mounted) return;
      if (resp.statusCode == 200 || resp.statusCode == 201) {
        Navigator.of(context).pop();
        widget.onRejected();
      } else {
        _showError('Failed to reject batch (${resp.statusCode})');
      }
    } catch (e) {
      if (mounted) _showError('Network error: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.error,
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
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
      child: SingleChildScrollView(
        child: _isLoading
            ? const _LoadingBody()
            : _showRejectStep
                ? _RejectBody(
                    controller: _reasonController,
                    onBack: () => setState(() => _showRejectStep = false),
                    onConfirm: _rejectBatch,
                  )
                : _MainBody(
                    batchCode: widget.batchCode,
                    totalDeliveries: widget.totalDeliveries,
                    totalDistanceKm: _totalDistanceKm,
                    estimatedTimeStr: _estimatedTimeStr,
                    sortedDeliveries: _sortedDeliveries,
                    truncateAddress: _truncateAddress,
                    onReject: () => setState(() => _showRejectStep = true),
                    onAccept: _acceptBatch,
                  ),
      ),
    );
  }
}

// ── Loading body ─────────────────────────────────────────────────────────────

class _LoadingBody extends StatelessWidget {
  const _LoadingBody();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 160,
      child: Center(
        child: CircularProgressIndicator(color: AppColors.accent),
      ),
    );
  }
}

// ── Main body ─────────────────────────────────────────────────────────────────

class _MainBody extends StatelessWidget {
  final String batchCode;
  final int totalDeliveries;
  final double totalDistanceKm;
  final String estimatedTimeStr;
  final List<Map<String, dynamic>> sortedDeliveries;
  final String Function(String) truncateAddress;
  final VoidCallback onReject;
  final VoidCallback onAccept;

  const _MainBody({
    required this.batchCode,
    required this.totalDeliveries,
    required this.totalDistanceKm,
    required this.estimatedTimeStr,
    required this.sortedDeliveries,
    required this.truncateAddress,
    required this.onReject,
    required this.onAccept,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final preview = sortedDeliveries.take(3).toList();
    final remaining = sortedDeliveries.length - 3;

    return Column(
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

        // Header
        Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.accent.withOpacity(0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.inventory_2_rounded,
                color: AppColors.accent,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'New Batch Assigned',
                    style: theme.textTheme.titleLarge?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    batchCode,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.accent,
                      fontFamily: 'monospace',
                      letterSpacing: 1.0,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),

        // Stats row
        Row(
          children: [
            _StatChip(
              icon: Icons.local_shipping_outlined,
              label: '$totalDeliveries deliveries',
            ),
            const SizedBox(width: 12),
            _StatChip(
              icon: Icons.route_outlined,
              label: '${totalDistanceKm.toStringAsFixed(1)} km',
            ),
            const SizedBox(width: 12),
            _StatChip(
              icon: Icons.schedule_outlined,
              label: estimatedTimeStr,
            ),
          ],
        ),
        const SizedBox(height: 24),

        // Delivery preview
        Row(
          children: [
            const Expanded(child: Divider(color: AppColors.divider)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text(
                'Delivery Preview',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const Expanded(child: Divider(color: AppColors.divider)),
          ],
        ),
        const SizedBox(height: 12),

        ...preview.map((d) {
          final qp = (d['queue_position'] as num?)?.toInt() ?? 0;
          final name = d['recipient_name'] as String? ?? 'Unknown';
          final address = d['address'] as String? ?? '';
          final neighborhood = truncateAddress(address);
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.accent.withOpacity(0.15),
                  ),
                  child: Center(
                    child: Text(
                      '$qp',
                      style: TextStyle(
                        color: AppColors.accent,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '$name — $neighborhood',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: Colors.white,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          );
        }),

        if (remaining > 0)
          Padding(
            padding: const EdgeInsets.only(left: 34, bottom: 8),
            child: Text(
              '... and $remaining more',
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
                fontStyle: FontStyle.italic,
              ),
            ),
          ),

        const SizedBox(height: 24),

        // Action buttons
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.error,
                  side: const BorderSide(color: AppColors.error),
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                onPressed: onReject,
                child: const Text(
                  'Reject',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.accent,
                  foregroundColor: AppColors.background,
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                onPressed: onAccept,
                child: const Text(
                  'Accept Batch',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

// ── Reject body ───────────────────────────────────────────────────────────────

class _RejectBody extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onBack;
  final VoidCallback onConfirm;

  const _RejectBody({
    required this.controller,
    required this.onBack,
    required this.onConfirm,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
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

        // Back button + title
        Row(
          children: [
            IconButton(
              icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
              onPressed: onBack,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
            const SizedBox(width: 12),
            Text(
              'Reject Batch',
              style: theme.textTheme.titleLarge?.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),

        Text(
          'Please provide a reason for rejection:',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 12),

        TextField(
          controller: controller,
          autofocus: true,
          maxLines: 3,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            hintText: 'e.g. Vehicle issue, too many stops...',
            hintStyle: TextStyle(color: AppColors.textSecondary),
            filled: true,
            fillColor: AppColors.background,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.divider),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.divider),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.accent),
            ),
          ),
        ),
        const SizedBox(height: 24),

        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              minimumSize: const Size.fromHeight(52),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            onPressed: onConfirm,
            child: const Text(
              'Confirm Reject',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

class _StatChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _StatChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.divider),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: AppColors.accent, size: 14),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
