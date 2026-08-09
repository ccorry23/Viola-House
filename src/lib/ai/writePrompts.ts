/**
 * Prompt construction for the AI writing helper. The author writes her own
 * stories; this is an optional partner for brainstorming, drafting, continuing,
 * or gently rewriting. Everything stays wholesome and age-appropriate.
 */

export const WRITER_SYSTEM =
  'You are a warm, imaginative writing partner for an author of children\'s ' +
  'picture books. Write wholesome, gentle, age-appropriate stories for young ' +
  'children (roughly ages 2–7) unless told otherwise. Use simple, concrete, ' +
  'musical language and short sentences with a clear beginning, middle, and a ' +
  'happy or comforting ending. Never include anything scary, violent, or ' +
  'unsafe for young children. Do not add commentary, headings, or notes — ' +
  'return only the story text itself, unless asked for ideas.'

export type WriteMode = 'brainstorm' | 'draft' | 'continue' | 'rewrite'

export interface WriteRequest {
  mode: WriteMode
  theme?: string
  premise?: string
  manuscript?: string
  instruction?: string
}

export function isJsonMode(mode: WriteMode): boolean {
  return mode === 'brainstorm'
}

export function buildWritePrompt(req: WriteRequest): string {
  switch (req.mode) {
    case 'brainstorm':
      return (
        `Suggest 4 distinct children's picture-book ideas` +
        (req.theme?.trim() ? ` about: "${req.theme.trim()}".` : '.') +
        ' Return ONLY a JSON array of 4 objects, each with keys ' +
        '"title" (string), "premise" (one warm sentence), and ' +
        '"ageRange" (e.g. "3–5"). No prose outside the JSON.'
      )
    case 'draft':
      return (
        `Write a complete short children's picture-book story` +
        (req.premise?.trim()
          ? ` based on this idea: "${req.premise.trim()}".`
          : '.') +
        ' Aim for about 150–300 words across roughly 8–14 short beats, each of ' +
        'which could become its own illustrated page. Return only the story.'
      )
    case 'continue':
      return (
        'Continue this children\'s picture-book story naturally toward a gentle ' +
        'ending. Do NOT repeat what is already written — return only the new ' +
        `text that follows.\n\nStory so far:\n"""\n${req.manuscript ?? ''}\n"""`
      )
    case 'rewrite':
      return (
        'Rewrite the following children\'s picture-book story' +
        (req.instruction?.trim()
          ? ` so that it is ${req.instruction.trim()}.`
          : ' to read more smoothly while keeping its meaning.') +
        ' Keep the same overall plot. Return only the rewritten story.\n\n' +
        `Story:\n"""\n${req.manuscript ?? ''}\n"""`
      )
  }
}
