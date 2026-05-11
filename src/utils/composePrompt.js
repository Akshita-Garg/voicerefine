export const INTENT_BLOCKS = {
  quick_capture:
    'The speaker is dictating a short thought, memo, or observation to themselves. They want their thought back, lightly tidied — not rewritten. Preserve their phrasing, their casual register, and the order in which they said things. Remove only obvious speech artifacts: fillers, false starts, repetitions. Do not group ideas, do not reorder, do not summarize, do not expand. The speaker chose their words; keep them.',
  take_notes:
    'The speaker is recording information they will re-read later to retrieve specific facts, names, claims, or concepts. Their voice does not need to be preserved; the information does. Keep proper nouns, numbers, technical terms, and specific claims verbatim. Trim conversational language and rhetorical filler aggressively. Light grouping of related ideas is welcome where it aids findability. Do not preserve casual asides, hedges, or speaker personality.',
  think_out_loud:
    'The speaker is reasoning through something in real time — exploring an idea, working a decision, or brainstorming. The value is the reasoning itself, including its uncertainty, not just the conclusion. Preserve hedges ("I think", "maybe", "not sure but", "on the other hand"), false starts that resolve into a point, and the rhythm of working a problem. Do not collapse tentative phrasing into confident statements. Do not impose structure the speaker did not have. Do not skip to the conclusion.',
  practice_rehearse:
    'The speaker is rehearsing something they will deliver to an audience: an interview answer, a presentation, a pitch, or a difficult message. The output is the polished version they would actually deliver, not a transcript of their rehearsal. Sharpen phrasing, smooth transitions between ideas, and project confidence. Cut hesitations, restarts, and self-corrections — those are rehearsal artifacts, not content. The speaker should be able to read or speak the output as-is to their intended audience.',
}

export const MODE_BLOCKS = {
  light:
    'Output a single block of flowing prose. Use paragraph breaks where the topic shifts naturally. Do not use headers, bullets, lists, bold, italic, or any markdown structure. The output reads continuously, end to end, like a paragraph from a book.',
  bullets:
    'Output a bulleted list. One distinct idea per bullet. Each bullet should read on its own without context from neighbors. Nest sub-bullets only when one idea genuinely depends on another (use sparingly). Do not include paragraphs of prose above or below the list. Do not add section headers. Order bullets by importance first, then by the speaker\'s natural flow.',
  document:
    'Output a structured document. Identify natural topic shifts in the transcript and place a brief section header (one line, plain text, no markdown formatting characters) before each. Within sections, write flowing paragraphs. A reader should be able to scan headers to navigate or read the document linearly. If the content is too short to justify multiple sections, output a single short paragraph without a header.',
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
- Preserve the speaker's meaning. The intent block below tells you how much of their voice to preserve.
- Do not add information, opinions, examples, or claims the speaker did not say.
- Use the speaker's own terms and phrases verbatim where possible. Do not paraphrase technical terms, proper nouns, or named concepts.
- Match the information content of the transcript. Length may vary slightly by format (bullets compress; documents may add header lines).

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
