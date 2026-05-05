import { pipeline, env } from '@huggingface/transformers';

// Use cached models when possible; fetch from CDN if not
env.allowLocalModels = false;

let transcriberPromise = null;

function getTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny.en',
      {
        // Force WASM backend. The Xenova/whisper-tiny.en model files were
        // exported for the v2 WASM API. @huggingface/transformers@4.x defaults
        // to WebGPU when available, but the WebGPU backend requires a different
        // model format (quantized weight scales) that this model doesn't have.
        device: 'wasm',
        // Optional progress callback for UI loading state
        progress_callback: (info) => {
          if (info.status === 'progress') {
            console.log(`[whisper] ${info.file}: ${Math.round(info.progress)}%`);
          }
        }
      }
    );
  }
  return transcriberPromise;
}

/**
 * Convert a MediaRecorder Blob into a Float32Array of mono 16kHz samples,
 * which is the format Whisper expects.
 */
async function blobToAudioSamples(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  // 16kHz mono is what Whisper wants. AudioContext does both decode and resample.
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  await audioContext.close();
  // Return mono channel as a Float32Array
  return audioBuffer.getChannelData(0);
}

/**
 * Transcribe a recorded audio Blob and return the transcribed text.
 */
export async function transcribe(blob) {
  const audio = await blobToAudioSamples(blob);
  const transcriber = await getTranscriber();
  const result = await transcriber(audio);
  return result.text.trim();
}

/**
 * Optional: pre-warm the model so the first transcription is faster.
 * Call this once at app start (e.g. on mount of the recorder component).
 */
export function preloadTranscriber() {
  return getTranscriber();
}
