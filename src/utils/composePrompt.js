export const INTENT_BLOCKS = {
  quick_capture:
    'The user is dictating something they want quickly cleaned up. Keep their casual register and meaning. Light touch: fix grammar, remove fillers, do not restructure unless the format requires it. Use a casual, conversational register that matches the speaker\'s voice.',
  take_notes:
    'The user is capturing information they want to read back later, such as class notes, research notes, or learning material. Prioritize clarity and information density. Group related ideas. It is okay to lightly restructure for readability. Use a neutral, information-focused register. Trim conversational filler.',
  think_out_loud:
    'The user is thinking through something aloud, exploring an idea or working through a decision. Preserve their exploratory voice. Do not over-polish or strip uncertainty markers if they signal real thinking. Add gentle structure only where it helps. Use a casual register that preserves the speaker\'s exploratory voice and any tentative phrasing that signals real thinking.',
  practice_rehearse:
    'The user is rehearsing a spoken response such as an interview answer, presentation, or pitch. Make the output coherent, well-structured, and confident. Smooth transitions between ideas. Aim for something the user could practice from. Use a polished, confident register suitable for spoken delivery to an audience.',
}

export const MODE_BLOCKS = {
  light:
    'Output a clean readable version of what the speaker said. Remove fillers and false starts. Fix grammar. Preserve sentence flow and structure.',
  bullets:
    'Extract the key points as a concise bulleted list. Each bullet captures one distinct idea. Order bullets by importance or natural flow.',
  document:
    'Restructure into a written document with logical sections. Add brief section headers if the content has natural breaks. Write in flowing paragraphs within sections. Do not add content — only restructure what is already in the transcript.',
}

/**
 * Assemble the { system, user } message pair for an LLM refinement call.
 *
 * Pure function — no side effects, no I/O.
 * Throws on unknown intent / mode so caller bugs surface immediately.
 */
export function composePrompt({ intent, mode, transcript }) {
  if (!(intent in INTENT_BLOCKS)) throw new Error(`Unknown intent: "${intent}"`)
  if (!(mode   in MODE_BLOCKS))   throw new Error(`Unknown mode: "${mode}"`)

  const system = `You transform raw voice transcripts into useful written output.

About the input:
- Raw output from a speech-to-text model
- May contain fillers ("um", "uh", "like"), false starts, repetitions, self-corrections
- May still contain transcription errors, though the user has had a chance to edit
- Treat these as artifacts of speech, not meaningful content

Universal rules:
- Preserve the speaker's meaning and voice
- Do not elaborate, infer, or explain. If the speaker did not say it, it does not appear in the output.
- The output word length should be roughly the same as the input word length.

User context:
${INTENT_BLOCKS[intent]}

Output format for this recording:
${MODE_BLOCKS[mode]}

Begin your response with the first word of the transformed text. Do not write any introduction, label, or acknowledgment — no "Here is the cleaned-up version:", no "Sure!", nothing before the text itself.`

  const user = `Transcript:
"""
${transcript}
"""`

  return { system, user }
}
