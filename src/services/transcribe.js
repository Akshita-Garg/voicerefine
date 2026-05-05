import { pipeline, env } from '@huggingface/transformers';

console.log('[transcribe] service loaded, device=wasm');

// Use cached models when possible; fetch from CDN if not
env.allowLocalModels = false;

let transcriberPromise = null;

function getTranscriber() {
  if (!transcriberPromise) {
    // Deviation from spec: spec says 'Xenova/whisper-tiny.en'. We're on
    // @huggingface/transformers@4.2.0 which forces WebGPU when available
    // (the `device: 'wasm'` option is ignored in this version, verified
    // against actual stack traces). The Xenova model lacks the q4/q4f16
    // weight scales the WebGPU MatMulNBits path requires. The onnx-community
    // model has those weights and works on both backends.
    transcriberPromise = pipeline(
      'automatic-speech-recognition',
      'onnx-community/whisper-tiny.en',
      {
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
