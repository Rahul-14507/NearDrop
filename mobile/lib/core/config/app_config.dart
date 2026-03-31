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
  static const String baseUrl = 'http://localhost:8000'; // Chrome web dev (same machine)
  static const String wsBaseUrl = 'ws://localhost:8000'; // WebSocket base

  // ── Azure Maps ───────────────────────────────────────────
  // portal.azure.com → Azure Maps Account → Authentication
  static const String azureMapsKey = 'PASTE_YOUR_AZURE_MAPS_KEY_HERE';

  // ── Azure Speech ─────────────────────────────────────────
  // Not stored here — Flutter fetches a short-lived token from
  // POST /voice/azure-token on the backend. No key in Flutter code.

  // ── Environment ──────────────────────────────────────────
  static const bool isProduction = false;
}
