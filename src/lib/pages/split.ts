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

// ---- Target page count ------------------------------------------------------

/** Which sentences begin a new paragraph (a blank line precedes them). */
function paragraphStarts(text: string, sentences: Sentence[]): boolean[] {
  return sentences.map((s, i) => {
    if (i === 0) return true
    const between = text.slice(sentences[i - 1].end, s.start)
    return /\n\s*\n/.test(between)
  })
}

/**
 * Partition `sizes` into exactly `k` contiguous, non-empty groups so that the
 * largest group total is as small as possible (balanced pages). Classic linear
 * partition DP. Returns each group as a [from, to) range over the input array.
 */
function linearPartition(sizes: number[], k: number): Array<[number, number]> {
  const n = sizes.length
  k = Math.max(1, Math.min(k, n))
  if (k <= 1) return [[0, n]]

  const prefix = [0]
  for (let i = 0; i < n; i++) prefix.push(prefix[i] + sizes[i])
  const rangeSum = (a: number, b: number) => prefix[b] - prefix[a]

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array(k + 1).fill(Infinity)
  )
  const pos: number[][] = Array.from({ length: n + 1 }, () =>
    Array(k + 1).fill(0)
  )
  for (let i = 1; i <= n; i++) dp[i][1] = rangeSum(0, i)
  for (let j = 2; j <= k; j++) {
    for (let i = j; i <= n; i++) {
      for (let p = j - 1; p < i; p++) {
        const val = Math.max(dp[p][j - 1], rangeSum(p, i))
        if (val < dp[i][j]) {
          dp[i][j] = val
          pos[i][j] = p
        }
      }
    }
  }

  const bounds: number[] = [n]
  let i = n
  let j = k
  while (j > 1) {
    const p = pos[i][j]
    bounds.push(p)
    i = p
    j--
  }
  bounds.push(0)
  bounds.reverse()

  const groups: Array<[number, number]> = []
  for (let g = 0; g < bounds.length - 1; g++) groups.push([bounds[g], bounds[g + 1]])
  return groups
}

/**
 * Page breaks that split the manuscript into about `target` balanced pages,
 * respecting narrative structure: whole paragraphs are kept together on a page
 * where possible, and only split when there are fewer paragraphs than pages.
 * The result is capped at one page per sentence (you can't have more pages than
 * sentences) — callers should read the achieved count from pagesFromBreaks.
 */
export function pageBreaksForTargetCount(text: string, target: number): number[] {
  const sentences = splitSentences(text)
  if (sentences.length === 0) return []
  const N = Math.max(1, Math.min(Math.round(target), sentences.length))
  if (N <= 1) return []

  const paraStart = paragraphStarts(text, sentences)

  // Blocks = paragraphs, as [from, to) ranges over `sentences`.
  let blocks: Array<[number, number]> = []
  let start = 0
  for (let i = 1; i < sentences.length; i++) {
    if (paraStart[i]) {
      blocks.push([start, i])
      start = i
    }
  }
  blocks.push([start, sentences.length])

  // +1 per sentence so single-sentence paragraphs still carry weight.
  const blockLen = ([f, t]: [number, number]) => {
    let n = 0
    for (let k = f; k < t; k++) n += sentences[k].text.length + 1
    return n
  }

  // Too few paragraphs for the target? Split the largest multi-sentence block
  // at its best halving point, repeatedly, until we have enough blocks.
  while (blocks.length < N) {
    let bi = -1
    let best = -1
    for (let k = 0; k < blocks.length; k++) {
      const [f, t] = blocks[k]
      if (t - f > 1 && blockLen(blocks[k]) > best) {
        best = blockLen(blocks[k])
        bi = k
      }
    }
    if (bi < 0) break // every block is a single sentence — can't split more
    const [f, t] = blocks[bi]
    const half = blockLen([f, t]) / 2
    let acc = 0
    let mid = f + 1
    for (let k = f; k < t - 1; k++) {
      acc += sentences[k].text.length + 1
      if (acc >= half) {
        mid = k + 1
        break
      }
    }
    blocks.splice(bi, 1, [f, mid], [mid, t])
  }

  // Merge blocks into exactly N balanced, contiguous groups.
  const groups = linearPartition(blocks.map(blockLen), N)

  const breaks: number[] = []
  for (let g = 1; g < groups.length; g++) {
    const firstBlock = groups[g][0]
    const sentenceIdx = blocks[firstBlock][0]
    breaks.push(sentences[sentenceIdx].start)
  }
  return breaks
}
