import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:neardrop/core/constants/strings.dart';
import 'package:neardrop/core/di/service_locator.dart';
import 'package:neardrop/core/network/websocket_service.dart';
import 'package:neardrop/core/storage/secure_storage.dart';
import 'package:neardrop/core/theme/app_theme.dart';
import 'package:neardrop/features/auth/bloc/auth_bloc.dart';
import 'package:neardrop/features/auth/bloc/auth_event.dart';
import 'package:neardrop/features/auth/bloc/auth_state.dart';
import 'package:neardrop/features/auth/models/user_model.dart';
import 'package:neardrop/features/driver/bloc/delivery_bloc.dart';
import 'package:neardrop/features/driver/bloc/delivery_event.dart';
import 'package:neardrop/features/driver/bloc/driver_bloc.dart';
import 'package:neardrop/features/driver/bloc/driver_event.dart';
import 'package:neardrop/features/driver/bloc/driver_state.dart';
import 'package:neardrop/features/driver/bloc/voice_bloc.dart';
import 'package:neardrop/features/driver/repository/driver_repository.dart';
import 'package:neardrop/features/driver/screens/active_delivery_screen.dart';
import 'package:neardrop/features/driver/screens/history_screen.dart';
import 'package:neardrop/features/driver/widgets/trust_score_badge.dart';

class DriverHomeScreen extends StatefulWidget {
  const DriverHomeScreen({super.key});

  @override
  State<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends State<DriverHomeScreen> {
  int _currentIndex = 0;
  late final DriverBloc _driverBloc;
  late final DeliveryBloc _deliveryBloc;
  late final VoiceBloc _voiceBloc;
  UserModel? _user;

  @override
  void initState() {
    super.initState();
    _driverBloc = DriverBloc(sl<DriverRepository>());
    _deliveryBloc = DeliveryBloc(sl<DriverRepository>());
    _voiceBloc = VoiceBloc();
    _loadUser();
  }

  Future<void> _loadUser() async {
    final info = await sl<SecureStorageService>().getUserInfo();
    final userId = int.tryParse(info['userId'] ?? '');
    if (userId != null && mounted) {
      setState(() {
        _user = UserModel(
          userId: userId,
          role: info['role'] ?? 'driver',
          name: info['name'] ?? '',
        );
      });
      _driverBloc.add(DriverProfileLoadRequested(userId));
      _deliveryBloc.add(DeliveryLoadRequested(userId));
      _connectWebSocket();
    }
  }

  void _connectWebSocket() async {
    final token = await sl<SecureStorageService>().getToken();
    if (token != null) {
      sl<WebSocketService>().connect(token);
      sl<WebSocketService>().events.listen((event) {
        if (!mounted) return;
        final type = event['type'] as String?;
        if (type == 'hub_accepted') {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(AppStrings.hubAccepted),
              backgroundColor: AppColors.success,
            ),
          );
          if (_user != null) {
            _deliveryBloc.add(DeliveryLoadRequested(_user!.userId));
          }
        }
      });
    }
  }

  @override
  void dispose() {
    _driverBloc.close();
    _deliveryBloc.close();
    _voiceBloc.close();
    sl<WebSocketService>().disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider.value(value: _driverBloc),
        BlocProvider.value(value: _deliveryBloc),
        BlocProvider.value(value: _voiceBloc),
      ],
      child: BlocListener<AuthBloc, AuthState>(
        listener: (context, state) {
          if (state is AuthUnauthenticated) {
            Navigator.of(context).pushReplacementNamed('/login');
          }
        },
        child: Scaffold(
          appBar: AppBar(
            title: const Text(AppStrings.appName),
            actions: [
              BlocBuilder<DriverBloc, DriverState>(
                bloc: _driverBloc,
                builder: (context, state) {
                  final score =
                      state is DriverProfileLoaded ? state.trustScore : 0;
                  return Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: TrustScoreBadge(score: score),
                  );
                },
              ),
            ],
          ),
          body: _buildBody(),
          bottomNavigationBar: BottomNavigationBar(
            currentIndex: _currentIndex,
            onTap: (i) => setState(() => _currentIndex = i),
            items: const [
              BottomNavigationBarItem(
                icon: Icon(Icons.local_shipping_rounded),
                label: 'Delivery',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.history_rounded),
                label: 'History',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.person_outline_rounded),
                label: 'Profile',
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody() {
    final userId = _user?.userId ?? 1;
    switch (_currentIndex) {
      case 0:
        return ActiveDeliveryScreen(driverId: userId);
      case 1:
        return HistoryScreen(driverId: userId);
      case 2:
        return _ProfileTab(user: _user);
      default:
        return ActiveDeliveryScreen(driverId: userId);
    }
  }
}

class _ProfileTab extends StatelessWidget {
  final UserModel? user;

  const _ProfileTab({this.user});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const SizedBox(height: 12),
        Center(
          child: Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.accent.withOpacity(0.15),
              border: Border.all(color: AppColors.accent.withOpacity(0.3)),
            ),
            child: const Icon(
              Icons.person_rounded,
              color: AppColors.accent,
              size: 40,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Center(
          child: Text(
            user?.name ?? '—',
            style: theme.textTheme.titleLarge,
          ),
        ),
        Center(
          child: Text(
            AppStrings.roleDriver,
            style: theme.textTheme.bodyMedium,
          ),
        ),
        const SizedBox(height: 32),
        _ProfileRow(
          icon: Icons.badge_outlined,
          label: AppStrings.role,
          value: AppStrings.roleDriver,
        ),
        const Divider(),
        _ProfileRow(
          icon: Icons.numbers_rounded,
          label: 'User ID',
          value: user?.userId.toString() ?? '—',
        ),
        const SizedBox(height: 32),
        OutlinedButton.icon(
          onPressed: () {
            showDialog<void>(
              context: context,
              builder: (ctx) => AlertDialog(
                backgroundColor: AppColors.surface,
                title: Text(AppStrings.logout,
                    style: theme.textTheme.titleMedium),
                content: Text(AppStrings.logoutConfirm,
                    style: theme.textTheme.bodyMedium),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.of(ctx).pop(),
                    child: Text(AppStrings.cancel),
                  ),
                  TextButton(
                    onPressed: () {
                      Navigator.of(ctx).pop();
                      context
                          .read<AuthBloc>()
                          .add(const LogoutRequested());
                    },
                    child: Text(AppStrings.logout,
                        style: const TextStyle(color: AppColors.error)),
                  ),
                ],
              ),
            );
          },
          icon: const Icon(Icons.logout_rounded),
          label: Text(AppStrings.logout),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(double.infinity, 48),
          ),
        ),
      ],
    );
  }
}

class _ProfileRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _ProfileRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Icon(icon, color: AppColors.textSecondary, size: 20),
          const SizedBox(width: 16),
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
          const Spacer(),
          Text(value,
              style: Theme.of(context)
                  .textTheme
                  .bodyLarge
                  ?.copyWith(fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
