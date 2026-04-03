import 'package:flutter/material.dart';
import 'package:neardrop/core/constants/strings.dart';
import 'package:neardrop/core/services/navigation_engine.dart';
import 'package:neardrop/core/theme/app_theme.dart';
import 'package:neardrop/features/driver/models/delivery_model.dart';

/// Bottom sheet shown when a delivery fails.
/// Lists nearby hubs and lets the driver navigate to one in-app.
///
/// If [autoAssignedHub] is provided, it is displayed prominently at the top
/// as "Auto-Assigned" — the driver can still choose another hub below.
class HubDropSheet extends StatelessWidget {
  final List<NearbyHubModel> hubs;
  final bool isLoading;
  final NearbyHubModel? autoAssignedHub;
  final Widget? header;

  const HubDropSheet({
    super.key,
    required this.hubs,
    this.isLoading = false,
    this.autoAssignedHub,
    this.header,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.divider,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),

          if (header != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 20),
              child: header!,
            ),

          if (isLoading || (hubs.isEmpty && autoAssignedHub == null)) ...[
            const SizedBox(height: 16),
            const CircularProgressIndicator(color: AppColors.accent),
            const SizedBox(height: 16),
            Text(
              AppStrings.broadcastingHubs,
              style: theme.textTheme.titleMedium?.copyWith(
                color: AppColors.accent,
              ),
            ),
            const _AnimatedDots(),
            const SizedBox(height: 32),
          ] else ...[
            Row(
              children: [
                const Icon(Icons.hub_rounded, color: AppColors.accent, size: 20),
                const SizedBox(width: 8),
                Text(
                  autoAssignedHub != null ? 'Hub Assigned' : AppStrings.hubFound,
                  style: theme.textTheme.titleMedium,
                ),
                const Spacer(),
                Text(
                  '${(autoAssignedHub != null ? 1 : 0) + hubs.length} nearby',
                  style: theme.textTheme.bodyMedium,
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Auto-assigned hub — highlighted
            if (autoAssignedHub != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.accent.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.accent.withOpacity(0.25)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.auto_awesome_rounded,
                        color: AppColors.accent, size: 14),
                    const SizedBox(width: 6),
                    Text(
                      'Auto-assigned — navigating automatically',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.accent,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              _HubCard(hub: autoAssignedHub!, isHighlighted: true),
            ],

            ...hubs
                .where((h) => h.id != autoAssignedHub?.id)
                .map((hub) => _HubCard(hub: hub)),
          ],
        ],
      ),
    );
  }
}

// ── Hub Card ──────────────────────────────────────────────────────────────────

class _HubCard extends StatelessWidget {
  final NearbyHubModel hub;
  final bool isHighlighted;

  const _HubCard({required this.hub, this.isHighlighted = false});

  IconData get _hubIcon {
    switch (hub.hubType) {
      case 'pharmacy':
        return Icons.local_pharmacy_rounded;
      case 'apartment':
        return Icons.apartment_rounded;
      default:
        return Icons.storefront_rounded;
    }
  }

  Future<void> _navigateToHub(BuildContext context) async {
    // Pop the sheet first
    Navigator.of(context).pop();

    // Start in-app navigation to hub
    try {
      await NavigationEngine().startNavigation(
        destLat: hub.lat,
        destLng: hub.lng,
        customerName: hub.name,
        onArrival: () {
          // Will be handled by the active_delivery_screen WS listener
        },
      );

      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.navigation_rounded,
                    color: Colors.white, size: 18),
                const SizedBox(width: 8),
                Text('Navigating to ${hub.name}'),
              ],
            ),
            backgroundColor: AppColors.accent,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not start navigation — try again'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isHighlighted
              ? AppColors.accent.withOpacity(0.06)
              : AppColors.primary,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isHighlighted
                ? AppColors.accent.withOpacity(0.3)
                : AppColors.divider,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.accent.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(_hubIcon, color: AppColors.accent, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        hub.name,
                        style: theme.textTheme.titleSmall
                            ?.copyWith(color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${hub.formattedDistance} · ${hub.etaMinutes} min away',
                        style: theme.textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                _TrustBadge(score: hub.trustScore),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _navigateToHub(context),
                icon: const Icon(Icons.navigation_rounded, size: 18),
                label: Text(
                  isHighlighted ? 'Navigate Now' : AppStrings.navigateToHub,
                ),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  minimumSize: Size.zero,
                  backgroundColor:
                      isHighlighted ? AppColors.accent : null,
                  foregroundColor:
                      isHighlighted ? Colors.white : null,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Trust Badge ───────────────────────────────────────────────────────────────

class _TrustBadge extends StatelessWidget {
  final int score;
  const _TrustBadge({required this.score});

  @override
  Widget build(BuildContext context) {
    final color = score >= 80
        ? AppColors.success
        : score >= 50
            ? AppColors.warning
            : AppColors.error;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        '$score',
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

// ── Animated dots ─────────────────────────────────────────────────────────────

class _AnimatedDots extends StatefulWidget {
  const _AnimatedDots();

  @override
  State<_AnimatedDots> createState() => _AnimatedDotsState();
}

class _AnimatedDotsState extends State<_AnimatedDots>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  int _dots = 0;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    )..addStatusListener((status) {
        if (status == AnimationStatus.completed) {
          setState(() => _dots = (_dots + 1) % 4);
          _ctrl.forward(from: 0);
        }
      });
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Text(
      '.' * _dots,
      style: const TextStyle(color: AppColors.accent, fontSize: 20),
    );
  }
}
