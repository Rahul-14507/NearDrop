// HOW TO CONFIGURE:
// 1. For local dev: keep baseUrl as 10.0.2.2:8000 (Android emulator)
//    For physical device: change to your machine's local IP e.g. http://192.168.1.5:8000
// 2. For production: change baseUrl to your Azure App Service URL
// 3. Azure Maps key: get from portal.azure.com → your Maps account → Authentication tab
// 4. Azure Speech key is NOT stored here — it is fetched securely from the backend at runtime

class AppConfig {
  // ── Backend ──────────────────────────────────────────────
  // Change this to your Azure App Service URL in production
  // e.g. https://neardrop-api.azurewebsites.net
  static const String baseUrl = 'http://192.168.1.7:8000'; // Physical device on LAN
  static const String wsBaseUrl = 'ws://192.168.1.7:8000'; // WebSocket base

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
