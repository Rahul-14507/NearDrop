import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:neardrop/core/services/azure_stt_service.dart';
import 'package:neardrop/features/driver/bloc/voice_event.dart';
import 'package:neardrop/features/driver/bloc/voice_state.dart';

class VoiceBloc extends Bloc<VoiceEvent, VoiceState> {
  final AzureSttService _sttService = AzureSttService();

  VoiceBloc() : super(const VoiceIdle()) {
    on<VoiceStartListening>(_onStart);
    on<VoiceStopListening>(_onStop);
    on<VoiceTranscriptReceived>(_onTranscript);
    on<VoiceReset>(_onReset);
  }

  Future<void> _onStart(
    VoiceStartListening event,
    Emitter<VoiceState> emit,
  ) async {
    emit(const VoiceListening());
    final text = await _sttService.startListening();
    if (!isClosed) {
      if (text != null && text.isNotEmpty) {
        add(VoiceTranscriptReceived(text));
      } else {
        emit(const VoiceIdle());
      }
    }
  }

  Future<void> _onStop(
    VoiceStopListening event,
    Emitter<VoiceState> emit,
  ) async {
    await _sttService.stopListening();
    emit(const VoiceIdle());
  }

  void _onTranscript(
    VoiceTranscriptReceived event,
    Emitter<VoiceState> emit,
  ) {
    emit(const VoiceProcessing());
    final intent = _classify(event.transcript.toLowerCase());
    emit(VoiceCommandRecognized(
      intent: intent,
      transcript: event.transcript,
    ));
  }

  void _onReset(VoiceReset event, Emitter<VoiceState> emit) {
    emit(const VoiceIdle());
  }

  String _classify(String text) {
    if (text.contains('deliver') ||
        text.contains('done') ||
        text.contains('complete') ||
        text.contains('ho gaya') ||
        text.contains('दिया')) {
      return 'delivered';
    }
    if (text.contains('fail') ||
        text.contains('unable') ||
        text.contains('nahi') ||
        text.contains('customer nahi') ||
        text.contains('नहीं')) {
      return 'failed';
    }
    if (text.contains('arriv') ||
        text.contains('reached') ||
        text.contains('pahunch') ||
        text.contains('पहुंच')) {
      return 'arrived';
    }
    if (text.contains('navigate') ||
        text.contains('direction') ||
        text.contains('rasta') ||
        text.contains('raasta')) {
      return 'navigate';
    }
    return 'unknown';
  }

  @override
  Future<void> close() {
    _sttService.dispose();
    return super.close();
  }
}
