import 'package:flutter/material.dart';
import 'package:neardrop/core/constants/strings.dart';
import 'package:neardrop/core/theme/app_theme.dart';
import 'package:neardrop/features/driver/models/delivery_model.dart';

class DeliveryStatusCard extends StatelessWidget {
  final DeliveryModel delivery;
  final void Function(String status)? onStatusChange;

  const DeliveryStatusCard({
    super.key,
    required this.delivery,
    this.onStatusChange,
  });

  Color _statusColor(String status) {
    switch (status) {
      case 'delivered':
        return AppColors.success;
      case 'failed':
        return AppColors.error;
      case 'arrived':
        return AppColors.warning;
      default:
        return AppColors.info;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'delivered':
        return AppStrings.statusDelivered;
      case 'failed':
        return AppStrings.statusFailed;
      case 'arrived':
        return AppStrings.statusArrived;
      default:
        return AppStrings.statusEnRoute;
    }
  }

  bool get _isFinal =>
      delivery.status == 'delivered' || delivery.status == 'hub_delivered';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${AppStrings.orderNumber} ${delivery.orderId}',
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: AppColors.accent,
                  ),
                ),
                _StatusChip(
                  label: _statusLabel(delivery.status),
                  color: _statusColor(delivery.status),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Address
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.location_on_rounded,
                  color: AppColors.accent,
                  size: 18,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    delivery.address,
                    style: theme.textTheme.bodyLarge,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Recipient
            if (delivery.recipientName != null) ...[
              _InfoRow(
                icon: Icons.person_outline_rounded,
                label: AppStrings.recipient,
                value: delivery.recipientName!,
              ),
              const SizedBox(height: 8),
            ],

            // Package details
            Row(
              children: [
                Expanded(
                  child: _InfoRow(
                    icon: Icons.inventory_2_outlined,
                    label: AppStrings.packageSize,
                    value: delivery.packageSize.toUpperCase(),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _InfoRow(
                    icon: Icons.monitor_weight_outlined,
                    label: AppStrings.weight,
                    value: '${delivery.weightKg} kg',
                  ),
                ),
              ],
            ),

            // Pickup code if present
            if (delivery.pickupCode != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.accent.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.accent.withOpacity(0.3),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.key_rounded,
                      color: AppColors.accent,
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          AppStrings.pickupCode,
                          style: theme.textTheme.bodySmall,
                        ),
                        Text(
                          delivery.pickupCode!,
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: AppColors.accent,
                            letterSpacing: 4,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],

            // Action buttons
            if (!_isFinal && onStatusChange != null) ...[
              const SizedBox(height: 20),
              const Divider(),
              const SizedBox(height: 12),
              Row(
                children: [
                  if (delivery.status == 'en_route')
                    Expanded(
                      child: _ActionButton(
                        label: AppStrings.markArrived,
                        icon: Icons.place_rounded,
                        color: AppColors.warning,
                        onTap: () => onStatusChange!('arrived'),
                      ),
                    ),
                  if (delivery.status == 'en_route')
                    const SizedBox(width: 8),
                  Expanded(
                    child: _ActionButton(
                      label: AppStrings.markDelivered,
                      icon: Icons.check_circle_outline_rounded,
                      color: AppColors.success,
                      onTap: () => onStatusChange!('delivered'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (delivery.status != 'failed')
                    Expanded(
                      child: _ActionButton(
                        label: AppStrings.markFailed,
                        icon: Icons.cancel_outlined,
                        color: AppColors.error,
                        onTap: () => onStatusChange!('failed'),
                      ),
                    ),
                  if (delivery.status == 'failed')
                    Expanded(
                      child: _ActionButton(
                        label: "Mark Hub Delivered",
                        icon: Icons.home_work_outlined,
                        color: AppColors.accent,
                        onTap: () => onStatusChange!('hub_delivered'),
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String label;
  final Color color;

  const _StatusChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: AppColors.textSecondary, size: 16),
        const SizedBox(width: 6),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 10,
              ),
            ),
            Text(
              value,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _ActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _ActionButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
