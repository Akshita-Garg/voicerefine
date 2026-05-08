import { pipeline, env } from '@huggingface/transformers';

// In a browser there is no local filesystem to search, so skip that lookup
// and always fetch from the HuggingFace CDN (cached by the browser after first load).
env.allowLocalModels = false;

let transcriberPromise = null;

function getTranscriber() {
  if (!transcriberPromise) {
    // Cohere Transcribe is a 2B-parameter Conformer-based ASR model.
    // dtype 'q4' (4-bit quantization) is the recommended dtype per the model card.
    // device 'webgpu' is explicitly required — the model card example passes it directly.
    transcriberPromise = pipeline(
      'automatic-speech-recognition',
      'onnx-community/cohere-transcribe-03-2026-ONNX',
      {
        dtype: 'q4',
        device: 'webgpu',
        progress_callback: (info) => {
          if (info.status === 'progress') {
            console.log(`[transcribe] ${info.file}: ${Math.round(info.progress)}%`);
          }
        }
      }
    );
  }
  return transcriberPromise;
}

/**
 * Convert a MediaRecorder Blob into a Float32Array of mono 16kHz samples.
 * 16kHz mono is the standard input format for ASR models including Cohere Transcribe.
 */
async function blobToAudioSamples(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  // AudioContext with a fixed sampleRate decodes the compressed audio file
  // and resamples to 16kHz in one step — no manual resampling needed.
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  await audioContext.close();
  return audioBuffer.getChannelData(0);
}

/**
 * Transcribe a recorded audio Blob and return the transcribed text.
 */
export async function transcribe(blob) {
  const audio = await blobToAudioSamples(blob);
  const transcriber = await getTranscriber();
  // max_new_tokens caps the output token length (per the model card example).
  // Unlike Whisper, Cohere Transcribe is a Conformer that handles variable-length
  // audio natively — no chunk_length_s/stride_length_s needed.
  const result = await transcriber(audio, {
    max_new_tokens: 1024,
  });
  return result.text.trim();
}

/**
 * Pre-warm the model so the first transcription is fast.
 * Call once at app start — the singleton promise is shared with transcribe().
 */
export function preloadTranscriber() {
  return getTranscriber();
}
