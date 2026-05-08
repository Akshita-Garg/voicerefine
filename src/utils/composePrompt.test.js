import { describe, it, expect } from 'vitest'
import { composePrompt, INTENT_BLOCKS, MODE_BLOCKS } from './composePrompt'

const base = {
  intent: 'take_notes',
  mode: 'light',
  transcript: 'Hello this is a test transcript',
}

describe('composePrompt', () => {
  it('returns an object with system and user string fields', () => {
    const { system, user } = composePrompt(base)
    expect(typeof system).toBe('string')
    expect(typeof user).toBe('string')
  })

  it('places the transcript inside triple-quote delimiters in the user message', () => {
    const { user } = composePrompt(base)
    expect(user).toContain('"""')
    expect(user).toContain(base.transcript)
  })

  it('substitutes the correct intent block for every valid intent', () => {
    for (const intent of Object.keys(INTENT_BLOCKS)) {
      const { system } = composePrompt({ ...base, intent })
      expect(system).toContain(INTENT_BLOCKS[intent])
    }
  })

  it('substitutes the correct mode block for every valid mode', () => {
    for (const mode of Object.keys(MODE_BLOCKS)) {
      const { system } = composePrompt({ ...base, mode })
      expect(system).toContain(MODE_BLOCKS[mode])
    }
  })

  it('throws on an unknown intent', () => {
    expect(() => composePrompt({ ...base, intent: 'unknown' }))
      .toThrow('Unknown intent: "unknown"')
  })

  it('throws on an unknown mode', () => {
    expect(() => composePrompt({ ...base, mode: 'unknown' }))
      .toThrow('Unknown mode: "unknown"')
  })
})
