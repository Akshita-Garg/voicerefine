import { useState, useEffect, useRef } from 'react'
import { Zap, PenLine, Brain, Mic2 } from 'lucide-react'
import { validateKey, validateOllama } from '../services/llm'

const INTENTS = [
  { value: 'quick_capture',     Icon: Zap,     label: 'Quick capture',  description: "Clean up something you dictated" },
  { value: 'take_notes',        Icon: PenLine, label: 'Take notes',     description: "Capture info you'll read back later" },
  { value: 'think_out_loud',    Icon: Brain,   label: 'Think out loud', description: "Explore an idea or work through a decision" },
  { value: 'practice_rehearse', Icon: Mic2,    label: 'Rehearse',       description: "Polish a pitch, answer, or presentation" },
]

const PROVIDERS = [
  { value: 'browser', label: 'In-browser model', recommended: true, needsKey: false, description: 'Runs entirely on your device. No API key, no setup needed. Requires a one-time download (~1.2 GB) and works best on hardware from the last few years. If you have an older laptop, choose Gemini or OpenAI instead.' },
  { value: 'gemini',  label: 'Cloud (Gemini)',    needsKey: true,  description: 'Faster and higher quality. Free API key from Google AI Studio.' },
  { value: 'openai',  label: 'Cloud (OpenAI)',    needsKey: true,  description: 'Higher quality. Requires an OpenAI API key (paid).' },
  { value: 'ollama',  label: 'Local Ollama',      needsKey: false, description: 'Free, runs on your machine. Requires running the app at localhost.' },
]

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

function Step1({ intent, onSelect, onContinue }) {
  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-xl">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-[#3A2F2A] mb-2">What will you mostly use this for?</h1>
        <p className="text-sm text-[#8A766E]">This shapes how VoiceRefine transforms your recordings.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        {INTENTS.map(({ value, Icon, label, description }) => {
          const selected = intent === value
          return (
            <button
              key={value}
              onClick={() => onSelect(value)}
              className={`text-left p-4 rounded-2xl border transition-all duration-150 ${
                selected
                  ? 'bg-[rgba(127,175,143,0.12)] border-[#7FAF8F]/50'
                  : 'bg-[#E6CFC7] border-[rgba(58,47,42,0.08)] hover:border-[rgba(58,47,42,0.18)] hover:bg-[#DFC8BE]'
              }`}
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <Icon size={18} strokeWidth={1.75} color={selected ? '#6FA287' : '#8A766E'} className="mb-2" />
              <p className="text-sm font-semibold mb-0.5 text-[#3A2F2A]">{label}</p>
              <p className="text-xs text-[#8A766E] leading-snug">{description}</p>
            </button>
          )
        })}
      </div>

      <p className="text-xs text-[#8A766E]">You can change this anytime in Settings.</p>

      <button
        onClick={onContinue}
        disabled={!intent}
        className="px-8 py-2.5 rounded-xl text-sm font-medium bg-[#7FAF8F] hover:bg-[#6E9E7F] text-[#F4F7F5] transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Continue
      </button>
    </div>
  )
}

function Step2({ onComplete }) {
  const [provider, setProvider]   = useState('browser')
  const [apiKey, setApiKey]       = useState('')
  const [status, setStatus]       = useState('idle') // 'idle' | 'checking' | 'valid' | 'rate_limited' | 'invalid'
  const [statusMsg, setStatusMsg] = useState('')
  const [override, setOverride]   = useState(false)

  const handleProviderChange = (val) => {
    setProvider(val)
    setStatus('idle')
    setStatusMsg('')
    setOverride(false)
    setApiKey('')
  }

  const handleValidate = async () => {
    setStatus('checking')
    setStatusMsg('')
    try {
      if (provider === 'ollama') {
        await validateOllama()
        setStatus('valid')
      } else {
        await validateKey({ provider, apiKey })
        setStatus('valid')
      }
    } catch (err) {
      if (err.message === 'rate_limited') {
        setStatus('rate_limited')
      } else {
        setStatus('invalid')
        setStatusMsg(err.message)
      }
    }
  }

  const needsKey = PROVIDERS.find(p => p.value === provider)?.needsKey ?? false

  const canContinue =
    provider === 'browser' ||
    provider === 'ollama' ||
    (provider && (status === 'valid' || status === 'rate_limited' || override))

  const handleComplete = () => {
    localStorage.setItem('vr_provider', provider)
    if (needsKey && apiKey) localStorage.setItem('vr_api_key', apiKey)
    else localStorage.removeItem('vr_api_key')
    onComplete()
  }

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-xl">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-[#3A2F2A] mb-2">How do you want to power refinements?</h1>
        <p className="text-sm text-[#8A766E]">Your key is stored only in your browser, never on our servers.</p>
      </div>

      <div className="flex flex-col gap-2 w-full">
        {PROVIDERS.map(({ value, label, recommended, description }) => {
          const selected = provider === value
          return (
            <button
              key={value}
              onClick={() => handleProviderChange(value)}
              className={`text-left px-4 py-3 rounded-xl border transition-all duration-150 ${
                selected
                  ? 'bg-[rgba(127,175,143,0.12)] border-[#7FAF8F]/50'
                  : 'bg-[#E6CFC7] border-[rgba(58,47,42,0.08)] hover:border-[rgba(58,47,42,0.18)]'
              }`}
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-[#3A2F2A]">{label}</span>
                {recommended && <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#7FAF8F]/20 text-[#5C8F70] font-medium">Recommended</span>}
              </div>
              <p className="text-xs text-[#8A766E] leading-snug">{description}</p>
            </button>
          )
        })}
      </div>

      {/* Key input for Gemini / OpenAI */}
      {provider && needsKey && (
        <div className="w-full flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); setStatus('idle'); setOverride(false) }}
              placeholder={`Paste your ${provider === 'gemini' ? 'Gemini' : 'OpenAI'} API key`}
              className="flex-1 rounded-lg px-3 py-2 text-sm text-[#3A2F2A] placeholder-[#8A766E] outline-none border border-[rgba(58,47,42,0.08)] focus:border-[#7FAF8F]/50"
              style={{ background: '#DFC8BE' }}
            />
            <button
              onClick={handleValidate}
              disabled={!apiKey || status === 'checking'}
              className="px-3 py-2 rounded-lg text-sm text-[#6B5B52] hover:text-[#3A2F2A] border border-[rgba(58,47,42,0.08)] disabled:opacity-40 transition-colors"
              style={{ background: '#DFC8BE' }}
            >
              {status === 'checking' ? '…' : 'Validate'}
            </button>
          </div>
          <ValidationFeedback status={status} message={statusMsg} override={override} onOverride={setOverride} />
        </div>
      )}

      {/* Ollama instructions + validate */}
      {provider === 'ollama' && (
        <div className="w-full flex flex-col gap-3">
          <div
            className="rounded-xl p-4 border border-[rgba(58,47,42,0.08)] text-sm text-[#3A2F2A]"
            style={{ background: '#DFC8BE' }}
          >
            {isLocalhost ? (
              <>
                <p className="font-medium mb-1">Make sure Ollama is running:</p>
                <code className="text-xs bg-[rgba(58,47,42,0.08)] px-2 py-1 rounded font-mono">ollama serve</code>
                <p className="text-xs text-[#8A766E] mt-2">
                  Also pull the model if you haven't: <code className="font-mono">ollama pull gemma3:1b</code>
                </p>
              </>
            ) : (
              <p className="text-[#8A766E]">
                Local Ollama only works when running the app at <code className="font-mono text-xs">localhost</code>. It cannot reach your machine from a hosted deployment. Choose Gemini or OpenAI instead, or <a href="https://github.com/Akshita-Garg/voicerefine" className="underline hover:text-[#3A2F2A]">run the app locally</a>.
              </p>
            )}
          </div>
          {isLocalhost && (
            <>
              <button
                onClick={handleValidate}
                disabled={status === 'checking'}
                className="self-start px-4 py-2 rounded-lg text-sm text-[#6B5B52] hover:text-[#3A2F2A] border border-[rgba(58,47,42,0.08)] disabled:opacity-40 transition-colors"
                style={{ background: '#DFC8BE' }}
              >
                {status === 'checking' ? 'Checking…' : 'Check connection'}
              </button>
              <ValidationFeedback status={status} message={statusMsg} override={override} onOverride={setOverride} />
            </>
          )}
        </div>
      )}

      <button
        onClick={handleComplete}
        disabled={!canContinue}
        className="px-8 py-2.5 rounded-xl text-sm font-medium bg-[#7FAF8F] hover:bg-[#6E9E7F] text-[#F4F7F5] transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Get started
      </button>
    </div>
  )
}

function ValidationFeedback({ status, message, override, onOverride }) {
  if (status === 'idle') return null
  return (
    <div className="text-sm">
      {status === 'checking' && <p className="text-[#8A766E]">Checking…</p>}
      {status === 'valid' && <p className="text-[#6FA287]">✓ Connected</p>}
      {status === 'rate_limited' && <p className="text-amber-700">✓ Valid key (rate limited, quota resets soon)</p>}
      {status === 'invalid' && (
        <div className="flex flex-col gap-2">
          <p className="text-red-700">✗ {message}</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={override}
              onChange={e => onOverride(e.target.checked)}
              className="accent-[#7FAF8F]"
            />
            <span className="text-xs text-[#8A766E]">Continue anyway, I know what I'm doing</span>
          </label>
        </div>
      )}
    </div>
  )
}

export function Onboarding({ onComplete }) {
  const [step, setStep]     = useState(1)
  const [intent, setIntent] = useState(null)
  const [fading, setFading] = useState(false)
  const fadeTimerRef        = useRef(null)

  useEffect(() => () => clearTimeout(fadeTimerRef.current), [])

  const handleStep1Continue = () => {
    localStorage.setItem('vr_intent', intent)
    setStep(2)
  }

  const handleStep2Complete = () => {
    localStorage.setItem('vr_onboarding_done', 'true')
    setFading(true)
    fadeTimerRef.current = setTimeout(onComplete, 500)
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center px-6 transition-opacity duration-500 ${fading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      style={{ background: 'linear-gradient(180deg, #EADBD2 0%, #E6D4C2 100%)' }}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 border-b border-[rgba(58,47,42,0.08)]">
        <h1 className="text-xl font-semibold tracking-tight text-[#C96F3B]">VoiceRefine</h1>
        <span className="text-xs text-[#8A766E]">Step {step} of 2</span>
      </div>

      {step === 1
        ? <Step1 intent={intent} onSelect={setIntent} onContinue={handleStep1Continue} />
        : <Step2 onComplete={handleStep2Complete} />
      }
    </div>
  )
}
