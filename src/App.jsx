import { useState, useEffect, useCallback } from 'react'
import { RecordButton } from './components/RecordButton'
import { transcribe, preloadTranscriber } from './services/transcribe'

function App() {
  const [rawTranscript, setRawTranscript] = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcribeError, setTranscribeError] = useState(false)

  // Kick off model download as soon as the app loads so the user doesn't
  // wait on their first recording. getTranscriber() is a singleton promise —
  // calling it here and inside transcribe() both resolve to the same instance.
  useEffect(() => {
    preloadTranscriber()
  }, [])

  // useCallback keeps the reference stable across renders so RecordButton's
  // useEffect doesn't re-fire with the same blob when App re-renders.
  const handleAudioReady = useCallback(async (blob) => {
    setRawTranscript('')
    setTranscribeError(false)
    setIsTranscribing(true)
    try {
      const text = await transcribe(blob)
      setRawTranscript(text)
    } catch (err) {
      console.error('[App] Transcription failed:', err)
      setTranscribeError(true)
    } finally {
      setIsTranscribing(false)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-semibold tracking-tight">VoiceRefine</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">Intent: Take notes ▾</span>
          <button className="text-sm text-gray-400 hover:text-gray-200">Settings</button>
        </div>
      </header>

      <main className="flex flex-col items-center gap-8 py-12 px-6">
        <div className="flex flex-col items-center gap-3">
          <RecordButton onAudioReady={handleAudioReady} />
          {isTranscribing && (
            <p className="text-sm text-gray-400 animate-pulse">Transcribing...</p>
          )}
          {transcribeError && (
            <p className="text-sm text-red-400">
              Transcription failed — check the browser console for details.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6 w-full max-w-4xl">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Raw Transcript
            </h2>
            <textarea
              value={rawTranscript}
              onChange={e => setRawTranscript(e.target.value)}
              className="w-full h-48 bg-transparent text-gray-300 text-sm resize-none outline-none placeholder-gray-600"
              placeholder="Record something — Whisper will transcribe it here. You can edit the text before refining."
            />
          </div>

          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Refined Output
            </h2>
            <div className="h-48 text-gray-600 text-sm">
              Refined text will appear here after Step 6 (prompt composition) and Step 7 (LLM call).
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
