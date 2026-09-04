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

export const REVIEWER_SYSTEM =
  'You are a warm, encouraging, and honest developmental editor who ' +
  'specializes in children\'s picture books (roughly ages 2–7). You give ' +
  'specific, constructive, actionable feedback that respects the author\'s ' +
  'own story, plot, and voice. You critique ONLY the manuscript you are given. ' +
  'You never rewrite the story, never write an alternative version, and never ' +
  'invent a different story — you help the author strengthen exactly what they ' +
  'wrote. Keep suggestions kind, concrete, and easy for a non-expert to act on.'

export const MARKETER_SYSTEM =
  'You are an expert children\'s-book marketing copywriter. You write warm, ' +
  'honest, appealing Amazon listing copy for picture books that makes parents ' +
  'and grandparents want to buy. You base everything ONLY on the manuscript — ' +
  'never invent characters, events, or facts that are not in it. Follow the ' +
  'exact output format each task specifies, and never give away the ending.'

export type WriteMode =
  | 'brainstorm'
  | 'draft'
  | 'continue'
  | 'rewrite'
  | 'review'
  | 'description'
  | 'subtitle'
  | 'keywords'

export interface WriteRequest {
  mode: WriteMode
  theme?: string
  premise?: string
  manuscript?: string
  instruction?: string
  title?: string
  author?: string
}

export function isJsonMode(mode: WriteMode): boolean {
  return (
    mode === 'brainstorm' ||
    mode === 'review' ||
    mode === 'subtitle' ||
    mode === 'keywords'
  )
}

/** Which persona to run a mode under. */
export function systemFor(mode: WriteMode): string {
  if (mode === 'review') return REVIEWER_SYSTEM
  if (mode === 'description' || mode === 'subtitle' || mode === 'keywords') {
    return MARKETER_SYSTEM
  }
  return WRITER_SYSTEM
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
    case 'description':
      return (
        'Write an Amazon product description for this children\'s picture book ' +
        'to help it sell.' +
        (req.title?.trim() ? ` Title: "${req.title.trim()}".` : '') +
        (req.author?.trim() ? ` Author: ${req.author.trim()}.` : '') +
        ' Base it only on the manuscript below — capture its story, ' +
        'characters, tone, and the gentle lesson, and entice the reader ' +
        'without giving away the ending. Keep it concise (about 120–180 ' +
        'words) in short, inviting sentences, and finish with one line naming ' +
        'a sensible age range for the reading level and who it is perfect for. ' +
        'Return ONLY the description text — no title, no headings, no markdown ' +
        'symbols, no surrounding quotation marks.\n\n' +
        `Manuscript:\n"""\n${req.manuscript ?? ''}\n"""`
      )
    case 'subtitle':
      return (
        'Suggest 4 short subtitle options for this children\'s picture book, ' +
        'for the Amazon/KDP "Subtitle" field.' +
        (req.title?.trim() ? ` The title is "${req.title.trim()}".` : '') +
        ' Each subtitle is a brief, appealing phrase (roughly 4–12 words) that ' +
        'hints at the story\'s heart or the gentle lesson — the kind that sits ' +
        'under a picture-book title (e.g. "A Story About Learning to Lose ' +
        'Without a Meltdown"). Base them only on the manuscript. Return ONLY a ' +
        'JSON array of 4 strings, no prose outside the JSON.\n\n' +
        `Manuscript:\n"""\n${req.manuscript ?? ''}\n"""`
      )
    case 'keywords':
      return (
        'You are optimizing Amazon KDP keywords so this children\'s picture ' +
        'book gets found and sells. KDP gives 7 keyword slots, each up to 50 ' +
        'characters. Apply proven KDP keyword strategy:\n' +
        '- Use buyer-intent phrases real shoppers actually type — NOT the ' +
        'book\'s title or author (those are already searchable).\n' +
        '- Make them specific and long-tail (3–6 words), each 50 characters or ' +
        'fewer, lowercase, no punctuation.\n' +
        '- Spread across DIFFERENT angles so the book appears in more searches. ' +
        'Across the 7, cover a mix of: the story\'s theme/lesson; the target ' +
        'age; a gift or occasion angle (e.g. "gift for a 4 year old"); a ' +
        'reading-context angle (e.g. "bedtime story", "read aloud"); an ' +
        'emotional-benefit angle for the parent; and a comparable-genre angle ' +
        '(e.g. "picture books about feelings").\n' +
        '- Phrase them the natural way a parent or grandparent would search.\n' +
        'Base everything only on the manuscript. Return ONLY a JSON array of 7 ' +
        'objects, each {"keyword": the phrase (<=50 chars), "why": a 3–8 word ' +
        'note naming the shopper or search it targets}. No prose outside the ' +
        'JSON.\n\n' +
        `Manuscript:\n"""\n${req.manuscript ?? ''}\n"""`
      )
    case 'review':
      return (
        'Read this children\'s picture-book manuscript in full and give ' +
        'constructive feedback to strengthen THIS manuscript. Consider pacing, ' +
        'character development, dialogue, plot holes or logic gaps, tone and ' +
        'voice consistency, age-appropriateness, language and readability, and ' +
        'overall structure — but only raise the points that actually apply. ' +
        'Do NOT rewrite the story, do NOT provide an alternative version, and ' +
        'do NOT invent new ideas — only feedback and specific suggestions tied ' +
        'to what is written. Point to concrete moments in the text. ' +
        'Return ONLY JSON of the form: ' +
        '{"strengths": [up to 3 short encouraging strings about what already ' +
        'works], "feedback": [{"area": short label e.g. "Pacing", ' +
        '"observation": what you noticed in the manuscript, "suggestion": one ' +
        'concrete, actionable improvement}]}. Include up to 8 feedback items, ' +
        'most important first. No prose outside the JSON.\n\n' +
        `Manuscript:\n"""\n${req.manuscript ?? ''}\n"""`
      )
  }
}
