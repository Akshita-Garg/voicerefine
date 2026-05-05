import { useState, useRef, useCallback } from 'react'

const MAX_SECONDS = 90

export function useAudioRecorder() {
  const [state, setState] = useState('idle') // 'idle' | 'recording'
  const [countdown, setCountdown] = useState(MAX_SECONDS)
  const [audioBlob, setAudioBlob] = useState(null)
  const [error, setError] = useState(null) // null | 'permission_denied' | 'unavailable'

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const timerRef = useRef(null)

  const stop = useCallback(() => {
    clearInterval(timerRef.current)
    if (recorderRef.current?.state !== 'inactive') {
      recorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setAudioBlob(null)
    chunksRef.current = []
    setCountdown(MAX_SECONDS)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      // onstop fires after stop() drains the final chunk — this is where the
      // usable audio blob is assembled from all collected chunks.
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setState('idle')
      }

      recorder.start()
      setState('recording')

      let secondsLeft = MAX_SECONDS
      timerRef.current = setInterval(() => {
        secondsLeft -= 1
        setCountdown(secondsLeft)
        if (secondsLeft <= 0) stop()
      }, 1000)
    } catch (err) {
      const isPermission =
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
      setError(isPermission ? 'permission_denied' : 'unavailable')
    }
  }, [stop])

  const toggle = useCallback(() => {
    if (state === 'recording') stop()
    else if (state === 'idle') start()
  }, [state, start, stop])

  return { state, countdown, audioBlob, error, toggle }
}
