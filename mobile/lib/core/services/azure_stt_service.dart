import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';
import 'package:neardrop/core/config/app_config.dart';

enum AzureSttState { idle, recording, processing, done, error }

class AzureSttService {
  final AudioRecorder _recorder = AudioRecorder();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final StreamController<AzureSttState> _stateController =
      StreamController<AzureSttState>.broadcast();

  AzureSttState _currentState = AzureSttState.idle;

  Stream<AzureSttState> get stateStream => _stateController.stream;
  AzureSttState get state => _currentState;

  void _setState(AzureSttState s) {
    _currentState = s;
    _stateController.add(s);
  }

  Future<String?> startListening() async {
    final micStatus = await Permission.microphone.request();
    if (!micStatus.isGranted) {
      _setState(AzureSttState.error);
      _setState(AzureSttState.idle);
      return null;
    }

    // Fetch Azure token from backend
    String? azureToken;
    String region = 'eastus';
    try {
      final authToken = await _storage.read(key: 'auth_token');
      final resp = await http.get(
        Uri.parse('${AppConfig.baseUrl}/voice/azure-token'),
        headers: {
          if (authToken != null) 'Authorization': 'Bearer $authToken',
        },
      ).timeout(const Duration(seconds: 10));
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body) as Map<String, dynamic>;
        azureToken = data['token'] as String?;
        region = (data['region'] as String?) ?? 'eastus';
      }
    } catch (_) {
      _setState(AzureSttState.error);
      _setState(AzureSttState.idle);
      return null;
    }

    if (azureToken == null || azureToken == 'demo-token') {
      _setState(AzureSttState.error);
      _setState(AzureSttState.idle);
      return null;
    }

    // Record audio
    _setState(AzureSttState.recording);
    final tempDir = Directory.systemTemp;
    final tempPath =
        '${tempDir.path}/stt_${DateTime.now().millisecondsSinceEpoch}.wav';

    try {
      await _recorder.start(
        RecordConfig(
          encoder: AudioEncoder.wav,
          sampleRate: 16000,
          numChannels: 1,
        ),
        path: tempPath,
      );

      // Record for max 8 seconds
      await Future.delayed(const Duration(seconds: 8));

      final path = await _recorder.stop();
      if (path == null) {
        _setState(AzureSttState.error);
        _setState(AzureSttState.idle);
        return null;
      }

      _setState(AzureSttState.processing);

      final audioFile = File(path);
      if (!audioFile.existsSync()) {
        _setState(AzureSttState.error);
        _setState(AzureSttState.idle);
        return null;
      }
      final bytes = await audioFile.readAsBytes();

      // Clean up temp file
      try { audioFile.deleteSync(); } catch (_) {}

      // POST to Azure STT
      final sttUri = Uri.parse(
        'https://$region.stt.speech.microsoft.com'
        '/speech/recognition/conversation/cognitiveservices/v1'
        '?language=hi-IN&format=detailed&profanity=raw',
      );

      final sttResp = await http.post(
        sttUri,
        headers: {
          'Authorization': 'Bearer $azureToken',
          'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
          'Accept': 'application/json',
        },
        body: bytes,
      ).timeout(const Duration(seconds: 15));

      if (sttResp.statusCode == 200) {
        final data = jsonDecode(sttResp.body) as Map<String, dynamic>;
        final status = data['RecognitionStatus'] as String?;
        if (status == 'Success') {
          final text = data['DisplayText'] as String?;
          _setState(AzureSttState.done);
          _setState(AzureSttState.idle);
          return text;
        }
      }

      _setState(AzureSttState.idle);
      return null;
    } catch (e) {
      if (await _recorder.isRecording()) await _recorder.stop();
      _setState(AzureSttState.error);
      _setState(AzureSttState.idle);
      return null;
    }
  }

  Future<void> stopListening() async {
    if (await _recorder.isRecording()) await _recorder.stop();
    _setState(AzureSttState.idle);
  }

  void dispose() {
    _stateController.close();
    _recorder.dispose();
  }
}
