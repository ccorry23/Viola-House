/**
 * Page-splitting heuristics for the manuscript.
 *
 * Pages in a picture book are sequential slices of the story, so the natural
 * unit is the sentence. We split the manuscript into sentences (with their
 * character offsets preserved), then group ~1–2 sentences per page as a
 * starting point. The author adjusts boundaries by hand from there.
 *
 * Page breaks are stored on the book as sorted character offsets — each offset
 * is the start of a sentence that begins a new page.
 */

export interface Sentence {
  text: string
  /** Char offset in the manuscript where this sentence begins. */
  start: number
  end: number
}

const isWs = (c: string) => /\s/.test(c)
const isEnd = (c: string) => c === '.' || c === '!' || c === '?'

/** Split manuscript text into trimmed sentences with original offsets. */
export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = []
  const n = text.length
  let segStart = 0
  let i = 0

  const push = (from: number, to: number) => {
    const raw = text.slice(from, to)
    const trimmed = raw.trim()
    if (!trimmed) return
    // Recompute the true start after leading whitespace so the offset points
    // at the first visible character.
    let s = from
    while (s < to && isWs(text[s])) s++
    out.push({ text: trimmed, start: s, end: to })
  }

  while (i < n) {
    const ch = text[i]
    if (isEnd(ch)) {
      let j = i + 1
      while (j < n && isEnd(text[j])) j++
      if (j >= n || isWs(text[j])) {
        push(segStart, j)
        let k = j
        while (k < n && isWs(text[k])) k++
        segStart = k
        i = k
        continue
      }
    }
    // Hard paragraph break also ends a sentence.
    if (ch === '\n' && text[i + 1] === '\n') {
      push(segStart, i)
      let k = i
      while (k < n && isWs(text[k])) k++
      segStart = k
      i = k
      continue
    }
    i++
  }
  if (segStart < n) push(segStart, n)
  return out
}

export interface SplitOptions {
  maxSentences?: number
  maxChars?: number
}

/** Suggested page breaks (sentence-start offsets) for a first pass. */
export function autoPageBreaks(
  text: string,
  { maxSentences = 2, maxChars = 200 }: SplitOptions = {}
): number[] {
  const sentences = splitSentences(text)
  const breaks: number[] = []
  let count = 0
  let chars = 0
  for (const s of sentences) {
    if (count > 0 && (count >= maxSentences || chars + s.text.length > maxChars)) {
      breaks.push(s.start)
      count = 0
      chars = 0
    }
    count++
    chars += s.text.length
  }
  return breaks
}

export interface DerivedPage {
  text: string
  sentences: Sentence[]
}

/** Group sentences into pages using the given break offsets. */
export function pagesFromBreaks(text: string, breaks: number[]): DerivedPage[] {
  const sentences = splitSentences(text)
  const sorted = [...new Set(breaks)].sort((a, b) => a - b)
  const pages: Sentence[][] = []
  let current: Sentence[] = []
  let bi = 0

  for (const s of sentences) {
    let broke = false
    while (bi < sorted.length && s.start >= sorted[bi]) {
      bi++
      broke = true
    }
    if (broke && current.length) {
      pages.push(current)
      current = []
    }
    current.push(s)
  }
  if (current.length) pages.push(current)

  return pages.map((sents) => ({
    text: sents.map((x) => x.text).join(' '),
    sentences: sents,
  }))
}

/** Keep only breaks that fall on a real sentence boundary (drop stale ones). */
export function validBreaks(text: string, breaks: number[]): number[] {
  const starts = new Set(splitSentences(text).map((s) => s.start))
  return [...new Set(breaks)].filter((b) => starts.has(b)).sort((a, b) => a - b)
}
