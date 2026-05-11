// All three providers speak the OpenAI chat/completions format.
// Gemini supports it via their OpenAI-compatible layer at a different base URL.
const PROVIDERS = {
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    model: 'gemma3:1b', // 815 MB — fits in ~7.7 GB RAM; gemma3:latest (3.3 GB) does not
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
  },
}

/**
 * Read provider config from localStorage (written by the settings panel in Step 10).
 * Falls back to Ollama during local development.
 */
function getProviderConfig() {
  try {
    const provider = localStorage.getItem('vr_provider') ?? 'ollama'
    const apiKey = localStorage.getItem('vr_api_key') ?? ''
    return { provider, apiKey }
  } catch {
    return { provider: 'ollama', apiKey: '' }
  }
}

/**
 * Send the composed { system, user } prompt to the configured LLM provider
 * and return the refined text.
 *
 * Throws with a specific, user-readable message for auth failures, rate limits,
 * and network errors — not a generic "something went wrong".
 */
export async function refine({ system, user }) {
  const { provider, apiKey } = getProviderConfig()
  const config = PROVIDERS[provider]
  if (!config) throw new Error(`Unknown provider: "${provider}"`)

  let response
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Ollama ignores the Authorization header; the others require it
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: user },
        ],
        stream: false, // v1: wait for full response, no streaming
      }),
    })
  } catch (err) {
    // fetch() itself throws only on network-level failures (offline, CORS, DNS)
    throw new Error(`Network error. Is ${provider === 'ollama' ? 'Ollama running at localhost:11434?' : 'your internet connected?'} (${err.message})`)
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const detail = body?.error?.message ?? `HTTP ${response.status}`
    if (response.status === 401) throw new Error(`Invalid or expired API key. Check your key in Settings. (${detail})`)
    if (response.status === 429) throw new Error(`Rate limit reached. Wait a moment and try again. (${detail})`)
    throw new Error(`Provider error: ${detail}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('Unexpected response format from provider')
  return content.trim()
}

/**
 * Check whether a local Ollama instance is reachable.
 * Throws with a user-readable message if not.
 */
export async function validateOllama() {
  try {
    const response = await fetch('http://localhost:11434/api/tags')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
  } catch (err) {
    if (err.message.startsWith('HTTP')) throw new Error(`Ollama responded with ${err.message}`)
    throw new Error('Cannot reach Ollama at localhost:11434. Is it running? Try: ollama serve')
  }
}

/**
 * Fire a minimal 1-token call to check whether an API key is valid.
 * Throws with a user-readable message on failure.
 * A 429 (rate limit) means the key is real — caller should treat it as valid.
 */
export async function validateKey({ provider, apiKey }) {
  const config = PROVIDERS[provider]
  if (!config) throw new Error(`Unknown provider: "${provider}"`)

  let response
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
        stream: false,
      }),
    })
  } catch (err) {
    throw new Error(`Network error during validation. (${err.message})`)
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const detail = body?.error?.message ?? `HTTP ${response.status}`
    if (response.status === 401) throw new Error(`Invalid or expired API key. (${detail})`)
    if (response.status === 429) throw new Error(`rate_limited`) // valid key, just throttled
    throw new Error(`Validation failed: ${detail}`)
  }
}
