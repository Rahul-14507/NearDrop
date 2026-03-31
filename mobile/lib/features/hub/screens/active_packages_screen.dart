import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:neardrop/core/constants/strings.dart';
import 'package:neardrop/core/theme/app_theme.dart';
import 'package:neardrop/features/hub/bloc/hub_bloc.dart';
import 'package:neardrop/features/hub/bloc/hub_event.dart';
import 'package:neardrop/features/hub/bloc/hub_state.dart';
import 'package:neardrop/features/hub/models/hub_model.dart';
import 'package:neardrop/features/hub/widgets/incoming_broadcast_card.dart';
import 'package:neardrop/features/hub/widgets/pickup_code_dialog.dart';

class ActivePackagesScreen extends StatelessWidget {
  final int hubId;

  const ActivePackagesScreen({super.key, required this.hubId});

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<HubBloc, HubState>(
      listener: (context, state) {
        if (state is HubBroadcastAcceptedState) {
          PickupCodeDialog.show(
            context,
            pickupCode: state.pickupCode,
            hubName: state.hubName,
          ).then((_) {
            // Reload both incoming broadcasts and stored packages
            context.read<HubBloc>().add(HubBroadcastsLoadRequested(hubId));
          });
        } else if (state is HubOtpVerifiedState) {
          // Close the OTP dialog if still open
          Navigator.of(context, rootNavigator: true).popUntil(
            (route) => route.isFirst || route.settings.name == null,
          );
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'OTP verified — package handed over to ${state.customerName}',
              ),
              backgroundColor: AppColors.success,
              duration: const Duration(seconds: 3),
            ),
          );
          // Reload stored packages
          context.read<HubBloc>().add(HubStoredPackagesLoadRequested(hubId));
        } else if (state is HubOtpResentState) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('A new OTP has been sent to the customer.'),
              backgroundColor: AppColors.accent,
            ),
          );
        } else if (state is HubError) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.message),
              backgroundColor: AppColors.error,
            ),
          );
        }
      },
      builder: (context, state) {
        if (state is HubLoading) {
          return const Center(
            child: CircularProgressIndicator(color: AppColors.accent),
          );
        }

        if (state is HubBroadcastsLoaded) {
          final broadcasts = state.broadcasts;
          final stored = state.storedPackages;

          if (broadcasts.isEmpty && stored.isEmpty) {
            return _emptyView(context);
          }

          return RefreshIndicator(
            color: AppColors.accent,
            backgroundColor: AppColors.surface,
            onRefresh: () async {
              context.read<HubBloc>().add(HubBroadcastsLoadRequested(hubId));
            },
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // ── Incoming broadcasts ───────────────────────────────────
                if (broadcasts.isNotEmpty) ...[
                  _SectionHeader(
                    title: 'Incoming Packages',
                    count: broadcasts.length,
                  ),
                  const SizedBox(height: 8),
                  ...broadcasts.map(
                    (broadcast) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: IncomingBroadcastCard(
                        broadcast: broadcast,
                        onAccept: () => context.read<HubBloc>().add(
                              HubBroadcastAccepted(
                                broadcastId: broadcast.id,
                                hubId: hubId,
                              ),
                            ),
                        onDecline: () {
                          context
                              .read<HubBloc>()
                              .add(HubBroadcastsLoadRequested(hubId));
                        },
                      ),
                    ),
                  ),
                ],

                // ── Stored packages waiting for pickup ────────────────────
                if (stored.isNotEmpty) ...[
                  if (broadcasts.isNotEmpty) const SizedBox(height: 8),
                  _SectionHeader(
                    title: 'Stored — Awaiting Customer',
                    count: stored.length,
                  ),
                  const SizedBox(height: 8),
                  ...stored.map(
                    (pkg) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _StoredPackageCard(
                        package: pkg,
                        onVerifyOtp: () => _showOtpDialog(context, pkg),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          );
        }

        if (state is HubError) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline_rounded,
                    color: AppColors.error, size: 48),
                const SizedBox(height: 16),
                Text(state.message,
                    style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => context
                      .read<HubBloc>()
                      .add(HubBroadcastsLoadRequested(hubId)),
                  child: Text(AppStrings.retry),
                ),
              ],
            ),
          );
        }

        return const SizedBox.shrink();
      },
    );
  }

  Widget _emptyView(BuildContext context) {
    return RefreshIndicator(
      color: AppColors.accent,
      backgroundColor: AppColors.surface,
      onRefresh: () async {
        context.read<HubBloc>().add(HubBroadcastsLoadRequested(hubId));
      },
      child: ListView(
        children: [
          SizedBox(
            height: MediaQuery.of(context).size.height * 0.6,
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
                  AppStrings.noPendingPackages,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  'Pull down to refresh',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showOtpDialog(BuildContext context, StoredPackageModel pkg) {
    showDialog<void>(
      context: context,
      builder: (ctx) => _OtpVerifyDialog(
        package: pkg,
        onVerify: (otp) {
          Navigator.of(ctx).pop();
          context.read<HubBloc>().add(HubVerifyOtpRequested(
                deliveryId: pkg.deliveryId,
                otp: otp,
              ));
        },
        onResend: () {
          Navigator.of(ctx).pop();
          context
              .read<HubBloc>()
              .add(HubResendOtpRequested(pkg.deliveryId));
        },
      ),
    ).then((_) {
      // If otp verification returned invalid, the dialog may have already been
      // replaced by a new one via BlocListener above, so check state.
      final state = context.read<HubBloc>().state;
      if (state is HubOtpInvalidState && state.deliveryId == pkg.deliveryId) {
        // Re-open dialog with error
        _showOtpDialogWithError(context, pkg, state.message);
      }
    });
  }

  void _showOtpDialogWithError(
    BuildContext context,
    StoredPackageModel pkg,
    String error,
  ) {
    showDialog<void>(
      context: context,
      builder: (ctx) => _OtpVerifyDialog(
        package: pkg,
        errorMessage: error,
        onVerify: (otp) {
          Navigator.of(ctx).pop();
          context.read<HubBloc>().add(HubVerifyOtpRequested(
                deliveryId: pkg.deliveryId,
                otp: otp,
              ));
        },
        onResend: () {
          Navigator.of(ctx).pop();
          context
              .read<HubBloc>()
              .add(HubResendOtpRequested(pkg.deliveryId));
        },
      ),
    );
  }
}

// ─── Section header ───────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;
  final int count;

  const _SectionHeader({required this.title, required this.count});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: AppColors.textSecondary,
                letterSpacing: 0.5,
              ),
        ),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: AppColors.accent.withOpacity(0.15),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            '$count',
            style: const TextStyle(
              color: AppColors.accent,
              fontSize: 11,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Stored package card ──────────────────────────────────────────────────────

class _StoredPackageCard extends StatelessWidget {
  final StoredPackageModel package;
  final VoidCallback onVerifyOtp;

  const _StoredPackageCard({
    required this.package,
    required this.onVerifyOtp,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.accent.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.store_rounded, color: AppColors.accent, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  package.orderId,
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: AppColors.accent,
                    fontFamily: 'monospace',
                  ),
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.accent.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'At Hub',
                  style: TextStyle(
                    color: AppColors.accent,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (package.recipientName != null) ...[
            Text(
              package.recipientName!,
              style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
            ),
            const SizedBox(height: 4),
          ],
          Text(
            package.address,
            style: theme.textTheme.bodySmall?.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          if (package.hubOtpSentAt != null) ...[
            const SizedBox(height: 4),
            Text(
              'OTP sent to customer',
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.success,
                fontSize: 11,
              ),
            ),
          ],
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: onVerifyOtp,
              icon: const Icon(Icons.lock_open_rounded, size: 16),
              label: const Text('Verify Customer OTP'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.accent,
                foregroundColor: AppColors.background,
                minimumSize: const Size.fromHeight(42),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── OTP verification dialog ──────────────────────────────────────────────────

class _OtpVerifyDialog extends StatefulWidget {
  final StoredPackageModel package;
  final String? errorMessage;
  final void Function(String otp) onVerify;
  final VoidCallback onResend;

  const _OtpVerifyDialog({
    required this.package,
    this.errorMessage,
    required this.onVerify,
    required this.onResend,
  });

  @override
  State<_OtpVerifyDialog> createState() => _OtpVerifyDialogState();
}

class _OtpVerifyDialogState extends State<_OtpVerifyDialog>
    with SingleTickerProviderStateMixin {
  final List<TextEditingController> _controllers =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());

  late AnimationController _shakeController;
  late Animation<double> _shakeAnimation;
  bool _hasError = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _errorMessage = widget.errorMessage;
    _hasError = _errorMessage != null;

    _shakeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _shakeAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0, end: -8), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -8, end: 8), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 8, end: -8), weight: 2),
      TweenSequenceItem(tween: Tween(begin: -8, end: 8), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 8, end: 0), weight: 1),
    ]).animate(CurvedAnimation(
      parent: _shakeController,
      curve: Curves.easeInOut,
    ));

    // Trigger shake if opened with an error
    if (_hasError) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _shake());
    }
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    _shakeController.dispose();
    super.dispose();
  }

  void _shake() {
    _shakeController.forward(from: 0);
  }

  void _onDigitEntered(int index, String value) {
    if (value.isEmpty) {
      if (index > 0) {
        _focusNodes[index - 1].requestFocus();
      }
      return;
    }
    if (index < 5) {
      _focusNodes[index + 1].requestFocus();
    } else {
      // Last digit — auto-submit
      _focusNodes[index].unfocus();
      _submit();
    }
  }

  void _submit() {
    final otp = _controllers.map((c) => c.text).join();
    if (otp.length == 6) {
      widget.onVerify(otp);
    }
  }

  void _clear() {
    for (final c in _controllers) {
      c.clear();
    }
    _focusNodes.first.requestFocus();
    setState(() {
      _hasError = false;
      _errorMessage = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Dialog(
      backgroundColor: AppColors.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.lock_open_rounded, color: AppColors.accent, size: 32),
            const SizedBox(height: 12),
            Text(
              'Verify Customer OTP',
              style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              widget.package.recipientName != null
                  ? 'Ask ${widget.package.recipientName} for their OTP'
                  : 'Enter the 6-digit OTP shown on customer\'s phone',
              style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                    textBaseline: TextBaseline.alphabetic,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),

            // Six OTP boxes with shake animation
            AnimatedBuilder(
              animation: _shakeAnimation,
              builder: (context, child) => Transform.translate(
                offset: Offset(_hasError ? _shakeAnimation.value : 0, 0),
                child: child,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: List.generate(6, (i) {
                  return SizedBox(
                    width: 40,
                    height: 52,
                    child: TextFormField(
                      controller: _controllers[i],
                      focusNode: _focusNodes[i],
                      keyboardType: TextInputType.number,
                      textAlign: TextAlign.center,
                      maxLength: 1,
                      autofocus: i == 0,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: _hasError ? AppColors.error : Colors.white,
                      ),
                      decoration: InputDecoration(
                        counterText: '',
                        contentPadding: EdgeInsets.zero,
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: BorderSide(
                            color: _hasError
                                ? AppColors.error
                                : AppColors.accent.withOpacity(0.4),
                            width: 1.5,
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: BorderSide(
                            color: _hasError ? AppColors.error : AppColors.accent,
                            width: 2,
                          ),
                        ),
                        filled: true,
                        fillColor: AppColors.background,
                      ),
                      onChanged: (v) => _onDigitEntered(i, v),
                    ),
                  );
                }),
              ),
            ),

            if (_errorMessage != null) ...[
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.error,
                    ),
                textAlign: TextAlign.center,
              ),
            ],

            const SizedBox(height: 20),

            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(44),
                      side: const BorderSide(color: AppColors.divider),
                    ),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.accent,
                      foregroundColor: AppColors.background,
                      minimumSize: const Size.fromHeight(44),
                    ),
                    child: const Text('Verify'),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 8),
            TextButton(
              onPressed: widget.onResend,
              child: Text(
                'Resend OTP to customer',
                style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
