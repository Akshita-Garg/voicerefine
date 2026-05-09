import { useState, useEffect } from 'react'
import { Zap, PenLine, Brain, Mic2 } from 'lucide-react'
import { validateKey } from '../services/llm'
import { resetTranscriber, preloadTranscriber, isTranscriberLoading } from '../services/transcribe'
import { Tooltip } from './Tooltip'

const PROVIDER_OPTIONS = [
  { value: 'gemini', label: 'Gemini',       needsKey: true  },
  { value: 'openai', label: 'OpenAI',       needsKey: true  },
  { value: 'ollama', label: 'Local Ollama', needsKey: false },
]


const INTENT_OPTIONS = [
  { value: 'quick_capture',     Icon: Zap,     label: 'Quick capture',  description: "You want a quick clean-up of something you dictated" },
  { value: 'take_notes',        Icon: PenLine, label: 'Take notes',     description: "You're capturing information you'll read back later" },
  { value: 'think_out_loud',    Icon: Brain,   label: 'Think out loud', description: "You're exploring an idea or working through a decision" },
  { value: 'practice_rehearse', Icon: Mic2,    label: 'Rehearse',       description: "You're rehearsing a pitch, answer, or presentation" },
]

export function SettingsPanel({ open, onClose, onSaved }) {
  const [provider, setProvider]                     = useState('ollama')
  const [apiKey, setApiKey]                         = useState('')
  const [intent, setIntent]                         = useState('take_notes')
  const [useHqTranscription, setUseHqTranscription] = useState(false)
  const [modelLoading, setModelLoading]             = useState(false)

  // 'idle' | 'validating' | 'valid' | 'rate_limited' | 'invalid'
  const [keyStatus, setKeyStatus] = useState('idle')
  const [keyError, setKeyError]   = useState('')
  const [override, setOverride]   = useState(false)

  useEffect(() => {
    if (!open) return
    setProvider(localStorage.getItem('vr_provider') ?? 'ollama')
    setApiKey(localStorage.getItem('vr_api_key')   ?? '')
    setIntent(localStorage.getItem('vr_intent')    ?? 'take_notes')
    setUseHqTranscription(localStorage.getItem('voicerefine.useHighQualityTranscription') === 'true')
    setModelLoading(isTranscriberLoading())
    setKeyStatus('idle')
    setKeyError('')
    setOverride(false)
  }, [open])

  const needsKey = PROVIDER_OPTIONS.find(p => p.value === provider)?.needsKey ?? false

  const handleProviderChange = (val) => {
    setProvider(val)
    setKeyStatus('idle')
    setKeyError('')
    setOverride(false)
  }

  const handleValidate = async () => {
    setKeyStatus('validating')
    setKeyError('')
    try {
      await validateKey({ provider, apiKey })
      setKeyStatus('valid')
    } catch (err) {
      if (err.message === 'rate_limited') {
        setKeyStatus('rate_limited')
      } else {
        setKeyStatus('invalid')
        setKeyError(err.message)
      }
    }
  }

  const canSave =
    !needsKey ||
    keyStatus === 'valid' ||
    keyStatus === 'rate_limited' ||
    override

  const handleHqToggle = async (e) => {
    const enabled = e.target.checked
    setUseHqTranscription(enabled)
    localStorage.setItem('voicerefine.useHighQualityTranscription', String(enabled))
    resetTranscriber()
    setModelLoading(true)
    try {
      await preloadTranscriber()
    } finally {
      setModelLoading(false)
    }
  }

  const handleSave = () => {
    localStorage.setItem('vr_provider', provider)
    localStorage.setItem('vr_intent',  intent)
    if (needsKey) {
      localStorage.setItem('vr_api_key', apiKey)
    } else {
      localStorage.removeItem('vr_api_key')
    }
    onSaved?.()
    onClose()
  }

  const handleReset = () => {
    localStorage.clear()
    onClose()
    window.location.reload()
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-[rgba(58,47,42,0.2)] z-40" onClick={onClose} />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full w-96 border-l border-[rgba(58,47,42,0.08)] z-50 flex flex-col overflow-y-auto"
        style={{ background: '#E8D9C5', boxShadow: '-4px 0 24px rgba(58,47,42,0.08)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(58,47,42,0.08)]">
          <h2 className="text-base font-semibold text-[#3A2F2A]">Settings</h2>
          <button onClick={onClose} className="text-[#6B5B52] hover:text-[#3A2F2A] text-2xl leading-none transition-colors">×</button>
        </div>

        <div className="flex-1 px-6 py-6 flex flex-col gap-8">

          {/* Provider */}
          <section>
            <h3 className="text-xs font-medium text-[#6B5B52] uppercase tracking-[0.08em] mb-3">Provider</h3>
            <div className="flex flex-col gap-2">
              {PROVIDER_OPTIONS.map(p => (
                <label key={p.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="provider"
                    value={p.value}
                    checked={provider === p.value}
                    onChange={() => handleProviderChange(p.value)}
                    className="accent-[#7FAF8F]"
                  />
                  <span className="text-sm text-[#3A2F2A]">{p.label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* API Key — hidden for Ollama */}
          {needsKey && (
            <section>
              <h3 className="text-xs font-medium text-[#6B5B52] uppercase tracking-[0.08em] mb-3">API Key</h3>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); setKeyStatus('idle') }}
                  placeholder="Paste your key here"
                  className="flex-1 rounded-lg px-3 py-2 text-sm text-[#3A2F2A] placeholder-[#6B5B52] outline-none border border-[rgba(58,47,42,0.08)] focus:border-[#7FAF8F]/50"
                  style={{ background: '#E6CFC7' }}
                />
                <button
                  onClick={handleValidate}
                  disabled={!apiKey || keyStatus === 'validating'}
                  className="px-3 py-2 rounded-lg text-sm text-[#6B5B52] hover:text-[#3A2F2A] border border-[rgba(58,47,42,0.08)] disabled:opacity-40 transition-colors"
                  style={{ background: '#E6CFC7' }}
                >
                  {keyStatus === 'validating' ? '…' : 'Validate'}
                </button>
              </div>

              {keyStatus === 'valid' && (
                <p className="mt-2 text-sm text-[#7FAF8F]">✓ Key is valid</p>
              )}
              {keyStatus === 'rate_limited' && (
                <p className="mt-2 text-sm text-amber-700">✓ Key is valid (rate limited, quota resets soon)</p>
              )}
              {keyStatus === 'invalid' && (
                <div className="mt-2">
                  <p className="text-sm text-red-700">✗ {keyError}</p>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={override}
                      onChange={e => setOverride(e.target.checked)}
                      className="accent-[#7FAF8F]"
                    />
                    <span className="text-xs text-[#8A766E]">Save anyway, I know what I'm doing</span>
                  </label>
                </div>
              )}

              <p className="mt-3 text-xs text-[#8A766E]">
                🔒 Your key is stored only in your browser and never sent to any server we own.
              </p>
            </section>
          )}

          {/* Transcription */}
          <section>
            <h3 className="text-xs font-medium text-[#6B5B52] uppercase tracking-[0.08em] mb-3">Transcription</h3>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={useHqTranscription}
                onChange={handleHqToggle}
                disabled={modelLoading}
                className="accent-[#7FAF8F] mt-0.5 flex-shrink-0"
              />
              <span className="flex flex-col gap-1">
                <span className="text-sm text-[#3A2F2A]">Use higher-quality transcription</span>
                {modelLoading
                  ? <span className="text-xs text-[#8A766E]">Downloading model…</span>
                  : <span className="text-xs text-[#8A766E]">Slower and requires a larger one-time download (~1 GB), but transcribes proper nouns and technical terms more accurately. Recommended for newer hardware.</span>
                }
              </span>
            </label>
          </section>

          {/* Intent */}
          <section>
            <h3 className="text-xs font-medium text-[#6B5B52] uppercase tracking-[0.08em] mb-3">Intent</h3>
            <div className="flex flex-col gap-2">
              {INTENT_OPTIONS.map(({ value, Icon, label, description }) => (
                <label key={value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="intent"
                    value={value}
                    checked={intent === value}
                    onChange={() => setIntent(value)}
                    className="accent-[#7FAF8F]"
                  />
                  <Tooltip text={description} align="left">
                    <span className="flex items-center gap-2 text-sm text-[#3A2F2A]">
                      <Icon size={14} strokeWidth={1.75} color="#5C4B44" />
                      {label}
                    </span>
                  </Tooltip>
                </label>
              ))}
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[rgba(58,47,42,0.08)] flex flex-col gap-3">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full py-2 rounded-xl text-sm font-medium bg-[#7FAF8F] hover:bg-[#6E9E7F] text-[#F4F7F5] transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>
          <button
            onClick={handleReset}
            className="w-full py-2 rounded-xl text-sm text-[#6B5B52] hover:text-[#3A2F2A] transition-colors"
          >
            Reset onboarding
          </button>
        </div>
      </div>
    </>
  )
}
