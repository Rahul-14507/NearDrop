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
import 'package:neardrop/features/driver/widgets/trust_score_badge.dart';
import 'package:neardrop/features/hub/bloc/hub_bloc.dart';
import 'package:neardrop/features/hub/bloc/hub_event.dart';
import 'package:neardrop/features/hub/bloc/hub_state.dart';
import 'package:neardrop/features/hub/repository/hub_repository.dart';
import 'package:neardrop/features/hub/screens/active_packages_screen.dart';
import 'package:neardrop/features/hub/screens/earnings_screen.dart';

class HubHomeScreen extends StatefulWidget {
  const HubHomeScreen({super.key});

  @override
  State<HubHomeScreen> createState() => _HubHomeScreenState();
}

class _HubHomeScreenState extends State<HubHomeScreen> {
  int _currentIndex = 0;
  late final HubBloc _hubBloc;
  UserModel? _user;
  int _hubId = 1; // loaded from storage

  @override
  void initState() {
    super.initState();
    _hubBloc = HubBloc(sl<HubRepository>());
    _loadUser();
  }

  Future<void> _loadUser() async {
    final info = await sl<SecureStorageService>().getUserInfo();
    final userId = int.tryParse(info['userId'] ?? '');
    if (userId != null && mounted) {
      setState(() {
        _user = UserModel(
          userId: userId,
          role: info['role'] ?? 'hub_owner',
          name: info['name'] ?? '',
        );
        // Hub ID matches user ID offset (seeded: user 4→hub 1, user 5→hub 2, etc.)
        _hubId = (userId - 3).clamp(1, 8);
      });
      _hubBloc
        ..add(HubBroadcastsLoadRequested(_hubId))
        ..add(HubStatsLoadRequested(_hubId));
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
        if (type == 'delivery_failed') {
          _hubBloc.add(HubNewBroadcastReceived(_hubId));
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Row(
                children: [
                  Icon(Icons.notifications_rounded,
                      color: Colors.white, size: 18),
                  SizedBox(width: 8),
                  Text(AppStrings.newPackageIncoming),
                ],
              ),
              backgroundColor: AppColors.accent,
              duration: Duration(seconds: 4),
            ),
          );
        }
      });
    }
  }

  @override
  void dispose() {
    _hubBloc.close();
    sl<WebSocketService>().disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _hubBloc,
      child: BlocListener<AuthBloc, AuthState>(
        listener: (context, state) {
          if (state is AuthUnauthenticated) {
            Navigator.of(context).pushReplacementNamed('/login');
          }
        },
        child: Scaffold(
          appBar: AppBar(
            title: const Text('NearDrop Hub'),
            actions: [
              BlocBuilder<HubBloc, HubState>(
                builder: (context, state) {
                  final score = state is HubStatsLoaded
                      ? state.stats.trustScore
                      : state is HubBroadcastsLoaded
                          ? state.trustScore
                          : 0;
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
                icon: Icon(Icons.inventory_2_rounded),
                label: 'Packages',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.payments_outlined),
                label: 'Earnings',
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
    switch (_currentIndex) {
      case 0:
        return ActivePackagesScreen(hubId: _hubId);
      case 1:
        return const EarningsScreen();
      case 2:
        return _HubProfileTab(user: _user);
      default:
        return ActivePackagesScreen(hubId: _hubId);
    }
  }
}

class _HubProfileTab extends StatelessWidget {
  final UserModel? user;

  const _HubProfileTab({this.user});

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
              Icons.storefront_rounded,
              color: AppColors.accent,
              size: 40,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Center(
          child: Text(user?.name ?? '—', style: theme.textTheme.titleLarge),
        ),
        Center(
          child: Text(AppStrings.roleHub, style: theme.textTheme.bodyMedium),
        ),
        const SizedBox(height: 32),
        _Row(
          icon: Icons.badge_outlined,
          label: AppStrings.role,
          value: AppStrings.roleHub,
        ),
        const Divider(),
        _Row(
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
                      context.read<AuthBloc>().add(const LogoutRequested());
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

class _Row extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _Row({
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
