// Native implementation: delegates to the real DartPluginRegistrant.
import 'dart:ui';

void ensureDartPluginRegistrantInitialized() {
  DartPluginRegistrant.ensureInitialized();
}
