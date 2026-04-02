import 'package:flutter/foundation.dart';

class AppConfig {
  // ── Backend ──────────────────────────────────────────────
  // Change this to your Azure App Service URL in production
  // e.g. https://neardrop-api.azurewebsites.net
  
  static String get baseUrl => kIsWeb ? 'http://localhost:8000' : 'http://192.168.1.7:8000';
  static String get wsBaseUrl => kIsWeb ? 'ws://localhost:8000' : 'ws://192.168.1.7:8000';

  // ── Azure Maps ───────────────────────────────────────────
  // Injected at build time via --dart-define=AZURE_MAPS_SUBSCRIPTION_KEY=...
  // Never hardcode — keep the value in the root .env file.
  static const String azureMapsKey = String.fromEnvironment('AZURE_MAPS_SUBSCRIPTION_KEY');

  // ── Azure Speech ─────────────────────────────────────────
  // Not stored here — Flutter fetches a short-lived token from
  // POST /voice/azure-token on the backend. No key in Flutter code.

  // ── Environment ──────────────────────────────────────────
  static const bool isProduction = false;
}
