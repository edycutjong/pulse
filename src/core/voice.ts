import {
  loadLLMModel,
  loadTTSModel,
  unloadQVACModel,
  runTextToSpeech,
  LLAMA_MODEL_ID,
} from "./qvac.js";
import {
  loadModel,
  unloadModel,
  WHISPER_EN_TINY_Q8_0,
} from "@qvac/sdk";

// ── Speech-to-Text (Whisper STT) ─────────────────────────────────────────────

let whisperModelId: string | null = null;

export async function loadWhisperModel(): Promise<string> {
  if (whisperModelId) return whisperModelId;
  whisperModelId = await loadModel({
    modelSrc: WHISPER_EN_TINY_Q8_0,
    modelType: "stt",
  } as any);
  return whisperModelId;
}

export async function unloadWhisperModel(): Promise<void> {
  if (whisperModelId) {
    await unloadModel({ modelId: whisperModelId });
    whisperModelId = null;
  }
}

/**
 * Transcribe audio buffer to text using local Whisper STT.
 * Accepts raw audio (WAV/PCM) as a Buffer.
 */
export async function transcribeAudio(audioBuffer: Uint8Array): Promise<string> {
  const modelId = await loadWhisperModel();
  try {
    // Use QVAC SDK's transcription capability
    const { transcribe } = await import("@qvac/sdk");
    const result: any = await transcribe({
      modelId,
      audio: audioBuffer,
    } as any);
    // Result may be { text } or an array of segments
    if (Array.isArray(result)) {
      return result.map((seg: any) => seg.text ?? "").join(" ");
    }
    return result.text ?? "";
  } catch (error) {
    console.error("Whisper STT transcription failed:", error);
    throw error;
  }
}

// ── Text-to-Speech (Piper TTS) ───────────────────────────────────────────────

/**
 * Synthesize text to speech audio buffer using local Piper TTS.
 * Returns a raw audio buffer ready for playback.
 */
export async function synthesizeSpeech(text: string): Promise<Uint8Array> {
  try {
    const result = await runTextToSpeech({ text });
    return new Uint8Array(result as any);
  } catch (error) {
    console.error("Piper TTS synthesis failed:", error);
    throw error;
  }
}

// ── Full Voice Pipeline ──────────────────────────────────────────────────────

export interface VoicePipelineResult {
  transcription: string;
  responseText: string;
  responseAudio: Uint8Array;
}

/**
 * Full voice loop: audio in → STT → process callback → TTS → audio out.
 * The `processText` callback should handle RAG + triage logic.
 */
export async function runVoicePipeline(
  audioInput: Uint8Array,
  processText: (text: string) => Promise<string>
): Promise<VoicePipelineResult> {
  // 1. Transcribe spoken input
  const transcription = await transcribeAudio(audioInput);
  console.log(`[voice] Transcribed: "${transcription}"`);

  // 2. Process through triage/RAG (caller provides this)
  const responseText = await processText(transcription);

  // 3. Synthesize spoken response
  const responseAudio = await synthesizeSpeech(responseText);

  return { transcription, responseText, responseAudio };
}
