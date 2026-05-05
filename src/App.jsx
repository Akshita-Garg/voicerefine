import { useState } from 'react'
import { RecordButton } from './components/RecordButton'

function App() {
  const [audioBlob, setAudioBlob] = useState(null)

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
        <RecordButton onAudioReady={setAudioBlob} />

        {audioBlob && (
          <p className="text-xs text-green-500">
            Audio captured — {(audioBlob.size / 1024).toFixed(1)} KB (Step 5 will transcribe this)
          </p>
        )}

        <div className="grid grid-cols-2 gap-6 w-full max-w-4xl">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Raw Transcript
            </h2>
            <textarea
              className="w-full h-48 bg-transparent text-gray-300 text-sm resize-none outline-none placeholder-gray-600"
              placeholder="Transcript will appear here after recording..."
              readOnly
            />
          </div>

          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Refined Output
            </h2>
            <div className="h-48 text-gray-600 text-sm">
              Refined text will appear here...
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
