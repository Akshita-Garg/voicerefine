import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

const DEFAULT_MODEL_ID = 'onnx-community/whisper-small.en';
const HQ_MODEL_ID     = 'onnx-community/cohere-transcribe-03-2026-ONNX';

const INFERENCE_PARAMS = {
  [DEFAULT_MODEL_ID]: {
    max_new_tokens: 256,
    chunk_length_s: 30,
    stride_length_s: 5,
  },
  [HQ_MODEL_ID]: {
    max_new_tokens: 1024,
    language: 'en',
  },
}

function currentModelId() {
  return localStorage.getItem('voicerefine.useHighQualityTranscription') === 'true'
    ? HQ_MODEL_ID
    : DEFAULT_MODEL_ID;
}

let transcriberPromise = null;
let transcriberReady   = false;

function getTranscriber() {
  if (!transcriberPromise) {
    transcriberReady   = false;
    transcriberPromise = pipeline(
      'automatic-speech-recognition',
      currentModelId(),
      {
        dtype: 'q4',
        device: 'webgpu',
        progress_callback: (info) => {
          if (info.status === 'progress') {
            console.log(`[transcribe] ${info.file}: ${Math.round(info.progress)}%`);
          }
        },
      }
    ).then(t => { transcriberReady = true; return t; });
  }
  return transcriberPromise;
}

async function blobToAudioSamples(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const audioBuffer  = await audioContext.decodeAudioData(arrayBuffer);
  await audioContext.close();
  return audioBuffer.getChannelData(0);
}

export async function transcribe(blob) {
  const modelId     = currentModelId();
  const audio       = await blobToAudioSamples(blob);
  const transcriber = await getTranscriber();
  const result      = await transcriber(audio, INFERENCE_PARAMS[modelId]);
  return result.text.trim();
}

export function resetTranscriber() {
  transcriberPromise = null;
  transcriberReady   = false;
}

export function preloadTranscriber() {
  return getTranscriber();
}

export function isTranscriberLoading() {
  return transcriberPromise !== null && !transcriberReady;
}
