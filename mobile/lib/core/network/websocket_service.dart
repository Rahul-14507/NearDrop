import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:neardrop/core/config/app_config.dart';

class WebSocketService {
  WebSocketChannel? _channel;
  final _controller =
      StreamController<Map<String, dynamic>>.broadcast();
  Timer? _reconnectTimer;
  Timer? _pingTimer;
  int _reconnectDelay = 1;
  bool _intentionalClose = false;
  String? _token;

  Stream<Map<String, dynamic>> get events => _controller.stream;

  void connect(String token) {
    _token = token;
    _intentionalClose = false;
    _reconnectDelay = 1;
    _connect();
  }

  void _connect() {
    try {
      final uri = Uri.parse('${AppConfig.wsBaseUrl}/ws?token=${_token ?? ""}');
      _channel = WebSocketChannel.connect(uri);
      _channel!.stream.listen(
        (data) {
          try {
            final json =
                jsonDecode(data as String) as Map<String, dynamic>;
            _controller.add(json);
          } catch (e) {
            debugPrint('WS parse error: $e');
          }
        },
        onError: (Object error) {
          debugPrint('WS error: $error');
          _scheduleReconnect();
        },
        onDone: () {
          if (!_intentionalClose) _scheduleReconnect();
        },
      );
      _reconnectDelay = 1;
      _startPing();
      debugPrint('WS connected to ${AppConfig.wsBaseUrl}');
    } catch (e) {
      debugPrint('WS connect error: $e');
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    _pingTimer?.cancel();
    _reconnectTimer?.cancel();
    final delay = _reconnectDelay;
    _reconnectDelay = (_reconnectDelay * 2).clamp(1, 30);
    debugPrint('WS reconnecting in ${delay}s...');
    _reconnectTimer = Timer(Duration(seconds: delay), _connect);
  }

  void _startPing() {
    _pingTimer?.cancel();
    _pingTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      try {
        _channel?.sink.add(jsonEncode({'type': 'ping'}));
      } catch (_) {}
    });
  }

  void disconnect() {
    _intentionalClose = true;
    _pingTimer?.cancel();
    _reconnectTimer?.cancel();
    _channel?.sink.close();
    _channel = null;
  }

  void dispose() {
    disconnect();
    _controller.close();
  }
}
