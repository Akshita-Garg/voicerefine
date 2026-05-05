import { useState, useEffect } from 'react'
import { RecordButton } from './components/RecordButton'
import { useWhisper } from './hooks/useWhisper'

function App() {
  const { status: whisperStatus, transcript: whisperTranscript, loadProgress, transcribe } = useWhisper()

  // rawTranscript is the user-editable version. Whisper populates it,
  // but the user can fix names, jargon, or errors before running refinement.
  const [rawTranscript, setRawTranscript] = useState('')

  // Sync Whisper output into the editable textarea whenever a new
  // transcription completes. We use a separate state (not Whisper's internal
  // transcript directly) so user edits don't fight with Whisper's value.
  useEffect(() => {
    if (whisperTranscript) setRawTranscript(whisperTranscript)
  }, [whisperTranscript])

  const handleAudioReady = (blob) => {
    setRawTranscript('')
    transcribe(blob)
  }

  const isLoading = whisperStatus === 'loading'
  const isProcessing = whisperStatus === 'processing'

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-semibold tracking-tight">VoiceRefine</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">Intent: Take notes ▾</span>
          <button className="text-sm text-gray-400 hover:text-gray-200">Settings</button>
        </div>
      </header>

      {isLoading && (
        <div className="mx-6 mt-4 bg-yellow-900/20 border border-yellow-700/40 text-yellow-300/90 text-sm px-4 py-3 rounded-lg">
          <span className="font-medium">Loading Whisper model</span>
          {loadProgress ? ` — ${loadProgress}%` : ''}
          <span className="text-yellow-400/60 ml-2">
            (~39 MB on first use, then cached in your browser)
          </span>
        </div>
      )}

      <main className="flex flex-col items-center gap-8 py-12 px-6">
        <div className="flex flex-col items-center gap-3">
          <RecordButton onAudioReady={handleAudioReady} />
          {isProcessing && (
            <p className="text-sm text-gray-400 animate-pulse">Transcribing...</p>
          )}
          {whisperStatus === 'error' && (
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
