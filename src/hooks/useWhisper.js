import { useState, useRef, useCallback, useEffect } from 'react'

export function useWhisper() {
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'processing' | 'error'
  const [transcript, setTranscript] = useState('')
  const [loadProgress, setLoadProgress] = useState(null) // 0-100 while downloading, null otherwise

  const workerRef = useRef(null)
  const objectUrlRef = useRef(null) // held so we can revoke it after the worker is done

  useEffect(() => {
    // new URL(..., import.meta.url) is Vite's way to reference a worker file
    // so the bundler can find and bundle it correctly.
    const worker = new Worker(
      new URL('../workers/whisper.worker.js', import.meta.url),
      { type: 'module' }
    )

    worker.onmessage = ({ data }) => {
      switch (data.type) {
        case 'loading':
          setStatus('loading')
          setLoadProgress(0)
          break
        case 'progress':
          // Only the 'progress' status events carry a download percentage.
          // 'initiate' and 'done' events fire for each file but have no progress number.
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
          console.error('[Whisper worker]', data.message)
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
    // Object URLs let the worker fetch the blob across the thread boundary.
    // We keep a reference so we can clean it up once the worker is done.
    const url = URL.createObjectURL(audioBlob)
    objectUrlRef.current = url
    setTranscript('')
    workerRef.current.postMessage({ type: 'transcribe', audioUrl: url })
  }, [])

  return { status, transcript, loadProgress, transcribe }
}
