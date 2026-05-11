import { pipeline } from '@huggingface/transformers'

let refinerPromise = null
let refinerReady   = false
let progressHandler = null

function getRefiner() {
  if (!refinerPromise) {
    refinerReady   = false
    refinerPromise = pipeline(
      'text-generation',
      'onnx-community/Llama-3.2-1B-Instruct-q4f16',
      {
        device: 'webgpu',
        progress_callback: (info) => {
          if (info.status === 'progress' && progressHandler) {
            progressHandler({
              file: info.file,
              progress: Math.round(info.progress),
            })
          }
        },
      }
    ).then(r => { refinerReady = true; return r })
  }
  return refinerPromise
}

export function preloadRefiner(onProgress) {
  if (onProgress) progressHandler = onProgress
  return getRefiner()
}

export async function refineLocal(systemMessage, userMessage) {
  const refiner = await getRefiner()
  const messages = [
    { role: 'system', content: systemMessage },
    { role: 'user',   content: userMessage   },
  ]
  const output = await refiner(messages, {
    max_new_tokens: 1024,
    temperature: 0.7,
    do_sample: false,
  })
  return output[0].generated_text.at(-1).content.trim()
}

export function isRefinerLoading() {
  return refinerPromise !== null && !refinerReady
}

export function resetRefiner() {
  refinerPromise  = null
  refinerReady    = false
  progressHandler = null
}
