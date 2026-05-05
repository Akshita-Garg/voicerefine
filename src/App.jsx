function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-semibold tracking-tight">VoiceRefine</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">Intent: Take notes ▾</span>
          <button className="text-sm text-gray-400 hover:text-gray-200">Settings</button>
        </div>
      </header>

      <main className="p-6">
        <p className="text-gray-500 text-sm">Setup complete — ready to build.</p>
      </main>
    </div>
  )
}

export default App
