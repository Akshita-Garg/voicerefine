import { pipeline, env } from '@xenova/transformers'

// Load model weights from Hugging Face CDN (not a local copy).
// After first download they are cached in the browser's IndexedDB.
env.allowLocalModels = false

let transcriber = null

async function getTranscriber() {
  if (transcriber) return transcriber

  transcriber = await pipeline(
    'automatic-speech-recognition',
    'Xenova/whisper-tiny.en',
    {
      progress_callback: (progress) => {
        self.postMessage({ type: 'progress', data: progress })
      },
    }
  )

  return transcriber
}

self.onmessage = async ({ data }) => {
  if (data.type !== 'transcribe') return

  try {
    if (!transcriber) {
      self.postMessage({ type: 'loading' })
    }

    const t = await getTranscriber()
    self.postMessage({ type: 'processing' })

    // chunk_length_s / stride_length_s handle audio longer than Whisper's
    // 30-second native context window. For a 90s recording this produces
    // three overlapping 30s chunks that are stitched together.
    const result = await t(data.audioUrl, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
    })

    self.postMessage({ type: 'done', transcript: result.text })
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message })
  }
}
