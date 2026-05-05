import { useEffect } from 'react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function RecordButton({ onAudioReady }) {
  const { state, countdown, audioBlob, error, toggle } = useAudioRecorder()

  // Pass the blob up to the parent (App) when a recording finishes.
  // Step 5 (Whisper) will consume it there.
  useEffect(() => {
    if (audioBlob) onAudioReady?.(audioBlob)
  }, [audioBlob, onAudioReady])

  const isRecording = state === 'recording'

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={toggle}
        className={`
          relative w-20 h-20 rounded-full text-3xl
          flex items-center justify-center transition-all duration-200
          ${isRecording
            ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/50'
            : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700'
          }
        `}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isRecording ? '⏹' : '🎙'}
        {isRecording && (
          <span className="absolute inset-0 rounded-full animate-ping bg-red-600 opacity-30" />
        )}
      </button>

      <div className="text-sm text-gray-400 h-5 tabular-nums">
        {isRecording ? `${formatTime(countdown)} / 01:30` : 'Click to record'}
      </div>

      {error === 'permission_denied' && (
        <p className="text-red-400 text-sm text-center max-w-xs">
          Microphone access denied. Allow microphone access in your browser settings and reload.
        </p>
      )}
      {error === 'unavailable' && (
        <p className="text-red-400 text-sm text-center max-w-xs">
          Could not access your microphone. Make sure it is connected and try again.
        </p>
      )}
    </div>
  )
}
