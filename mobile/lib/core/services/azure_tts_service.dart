import 'dart:async';
import 'dart:collection';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:just_audio/just_audio.dart';
import 'package:neardrop/core/config/app_config.dart';

class AzureTtsService {
  static final AzureTtsService _instance = AzureTtsService._internal();
  factory AzureTtsService() => _instance;
  AzureTtsService._internal();

  final AudioPlayer _player = AudioPlayer();
  final Queue<_TtsJob> _queue = Queue();
  bool _isSpeaking = false;
  final Map<String, Uint8List> _cache = {};
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  String _detectLanguage(String text) {
    if (text.isEmpty) return 'hi-IN';
    final asciiCount = text.runes.where((r) => r < 128).length;
    return (asciiCount / text.length) > 0.6 ? 'en-IN' : 'hi-IN';
  }

  String _defaultVoice(String language) =>
      language == 'en-IN' ? 'en-IN-NeerjaNeural' : 'hi-IN-SwaraNeural';

  Future<void> speak(String text, {String? language}) async {
    final lang = language ?? _detectLanguage(text);
    _queue.add(_TtsJob(text, lang));
    if (!_isSpeaking) _processQueue();
  }

  Future<void> speakImmediate(String text, {String? language}) async {
    _queue.clear();
    await _player.stop();
    _isSpeaking = false;
    final lang = language ?? _detectLanguage(text);
    await _playText(text, lang);
  }

  Future<void> stop() async {
    _queue.clear();
    _isSpeaking = false;
    await _player.stop();
  }

  Future<void> _processQueue() async {
    _isSpeaking = true;
    while (_queue.isNotEmpty) {
      final job = _queue.removeFirst();
      await _playText(job.text, job.language);
    }
    _isSpeaking = false;
  }

  Future<void> _playText(String text, String language) async {
    try {
      final bytes = await _fetchAudio(text, language);
      if (bytes == null || bytes.isEmpty) return;
      final source = _BytesAudioSource(bytes);
      await _player.stop();
      await _player.setAudioSource(source);
      await _player.play();
      await _player.playerStateStream.firstWhere(
        (s) =>
            s.processingState == ProcessingState.completed ||
            s.processingState == ProcessingState.idle,
      ).timeout(const Duration(seconds: 30), onTimeout: () {
        return PlayerState(false, ProcessingState.idle);
      });
    } catch (_) {}
  }

  Future<Uint8List?> _fetchAudio(String text, String language) async {
    final cacheKey = text.toLowerCase().trim();
    if (_cache.containsKey(cacheKey)) return _cache[cacheKey];

    try {
      final token = await _storage.read(key: 'auth_token');
      final voice = _defaultVoice(language);
      final response = await http.post(
        Uri.parse('${AppConfig.baseUrl}/tts/synthesize'),
        headers: {
          'Content-Type': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({'text': text, 'language': language, 'voice': voice}),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final bytes = response.bodyBytes;
        _cache[cacheKey] = bytes;
        return bytes;
      }
    } catch (_) {}
    return null;
  }

  void dispose() {
    _player.dispose();
  }
}

class _TtsJob {
  final String text;
  final String language;
  const _TtsJob(this.text, this.language);
}

class _BytesAudioSource extends StreamAudioSource {
  final Uint8List _bytes;
  _BytesAudioSource(this._bytes) : super(tag: 'tts_audio');

  @override
  Future<StreamAudioResponse> request([int? start, int? end]) async {
    start ??= 0;
    end ??= _bytes.length;
    return StreamAudioResponse(
      sourceLength: _bytes.length,
      contentLength: end - start,
      offset: start,
      stream: Stream.value(_bytes.sublist(start, end)),
      contentType: 'audio/mpeg',
    );
  }
}
