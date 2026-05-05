import { useState, useRef, useCallback, useEffect } from 'react'

// ?worker tells Vite to bundle this file and all its imports (including
// @xenova/transformers) as a separate worker chunk. Without this, Vite in
// dev mode serves the worker as a raw ES module and the browser tries to
// resolve bare specifiers like 'import from "@xenova/transformers"' itself —
// which fails because browsers can't resolve node_modules bare specifiers.
import WhisperWorker from '../workers/whisper.worker.js?worker'

export function useWhisper() {
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'processing' | 'error'
  const [transcript, setTranscript] = useState('')
  const [loadProgress, setLoadProgress] = useState(null) // 0-100 while downloading, null otherwise

  const workerRef = useRef(null)
  const objectUrlRef = useRef(null)

  useEffect(() => {
    const worker = new WhisperWorker()

    worker.onerror = (e) => {
      console.error('[Whisper worker] load error:', e.message, e)
      setStatus('error')
    }

    worker.onmessage = ({ data }) => {
      switch (data.type) {
        case 'loading':
          setStatus('loading')
          setLoadProgress(0)
          break
        case 'progress':
          if (data.data?.status === 'progress') {
            setLoadProgress(Math.round(data.data.progress))
          }
          break
        case 'processing':
          setStatus('processing')
          setLoadProgress(null)
          break
        case 'done':
          setTranscript(data.transcript.trim())
          setStatus('idle')
          revokeUrl()
          break
        case 'error':
          console.error('[Whisper worker] transcription error:', data.message)
          setStatus('error')
          revokeUrl()
          break
      }
    }

    workerRef.current = worker
    return () => worker.terminate()
  }, [])

  function revokeUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }

  const transcribe = useCallback((audioBlob) => {
    if (!workerRef.current) return
    const url = URL.createObjectURL(audioBlob)
    objectUrlRef.current = url
    setTranscript('')
    workerRef.current.postMessage({ type: 'transcribe', audioUrl: url })
  }, [])

  return { status, transcript, loadProgress, transcribe }
}
