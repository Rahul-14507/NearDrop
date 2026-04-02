import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:neardrop/core/di/service_locator.dart';
import 'package:neardrop/core/theme/app_theme.dart';
import 'package:neardrop/features/auth/bloc/auth_bloc.dart';
import 'package:neardrop/features/auth/bloc/auth_event.dart';
import 'package:neardrop/features/auth/bloc/auth_state.dart';
import 'package:neardrop/features/auth/repository/auth_repository.dart';
import 'package:neardrop/features/auth/screens/login_screen.dart';
import 'package:neardrop/features/driver/screens/driver_home_screen.dart';
import 'package:neardrop/features/hub/screens/hub_home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase — graceful fallback if google-services.json not present
  try {
    await Firebase.initializeApp();
  } catch (e) {
    debugPrint('Firebase init skipped: $e');
  }

  setupServiceLocator();
  runApp(const NearDropApp());
}

// ── App ───────────────────────────────────────────────────────────────────────

class NearDropApp extends StatelessWidget {
  const NearDropApp({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<AuthBloc>(
      create: (_) => AuthBloc(sl<AuthRepository>())
        ..add(const TokenChecked()),
      child: MaterialApp(
        title: 'NearDrop',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.darkTheme,
        home: const _AppRoot(),
        routes: {
          '/login': (_) => const LoginScreen(),
          '/driver': (_) => const DriverHomeScreen(),
          '/hub': (_) => const HubHomeScreen(),
        },
      ),
    );
  }
}

/// Listens to AuthBloc and routes to the right screen on cold start.
class _AppRoot extends StatelessWidget {
  const _AppRoot();

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<AuthBloc, AuthState>(
      listenWhen: (prev, curr) => curr is! AuthInitial,
      listener: (context, state) {
        if (state is AuthAuthenticated) {
          final route = state.user.isDriver ? '/driver' : '/hub';
          Navigator.of(context).pushReplacementNamed(route);
        } else if (state is AuthUnauthenticated || state is AuthError) {
          Navigator.of(context).pushReplacementNamed('/login');
        }
      },
      builder: (context, state) {
        if (state is AuthLoading || state is AuthInitial) {
          return const Scaffold(
            body: Center(
              child: CircularProgressIndicator(color: Color(0xFF00B4A6)),
            ),
          );
        }
        return const LoginScreen();
      },
    );
  }
}
