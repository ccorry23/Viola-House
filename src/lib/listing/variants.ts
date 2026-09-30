/**
 * Spelling / punctuation variants of a book's title for KDP backend keywords.
 *
 * Amazon search doesn't reliably match queries that differ from the title by
 * punctuation or contractions ("I Didn't Win Today" vs "I Didnt Win Today" vs
 * "I Did Not Win Today"), and new books lean on exact keyword matching until
 * they have sales history. KDP's 7 backend keyword boxes (50 characters each)
 * can cover those variants — if the author thinks of them.
 *
 * Amazon matches search words across a listing's title, subtitle AND keyword
 * boxes together, so a variant only helps through the words it ADDS. We
 * therefore reduce each variant to its new words and pack them into as few
 * boxes as possible (often one), instead of spending a box per variant.
 *
 * Pure functions — no browser APIs — so they're easy to test.
 */

export type VariantKind =
  | 'apostrophe'
  | 'expanded'
  | 'possessive'
  | 'hyphen'
  | 'ampersand'
  | 'number'
  | 'typo'

export type VariantSource = 'title' | 'keywords'

export interface Variant {
  /** The variant phrase, lower case (e.g. "i didnt win today"). */
  text: string
  kind: VariantKind
  source: VariantSource
  /** Plain-language label for the checkbox (e.g. "Without the apostrophe"). */
  label: string
  /** Words this variant adds that Amazon can't already match. */
  newWords: string[]
}

/** KDP backend keyword limits. */
export const KDP_KEYWORD_BOXES = 7
export const KDP_KEYWORD_BOX_CHARS = 50

const CONTRACTIONS: Record<string, string> = {
  "aren't": 'are not',
  "can't": 'can not',
  "couldn't": 'could not',
  "didn't": 'did not',
  "doesn't": 'does not',
  "don't": 'do not',
  "hadn't": 'had not',
  "hasn't": 'has not',
  "haven't": 'have not',
  "isn't": 'is not',
  "mustn't": 'must not',
  "shouldn't": 'should not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "won't": 'will not',
  "wouldn't": 'would not',
  "i'm": 'i am',
  "i'll": 'i will',
  "i've": 'i have',
  "i'd": 'i would',
  "you're": 'you are',
  "you'll": 'you will',
  "you've": 'you have',
  "we're": 'we are',
  "we'll": 'we will',
  "we've": 'we have',
  "they're": 'they are',
  "they'll": 'they will',
  "they've": 'they have',
  "it's": 'it is',
  "that's": 'that is',
  "there's": 'there is',
  "what's": 'what is',
  "who's": 'who is',
  "he's": 'he is',
  "she's": 'she is',
  "let's": 'let us',
  "y'all": 'you all',
}

const NUMBERS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty',
]

/** Everyday words not worth typo variants (and too short/common to matter). */
const COMMON = new Set(
  (
    'a an and are as at be but by for from has have he her his how i if in into is it its ' +
    'me my no not of on or our she so that the their them then there they this to too up ' +
    'us was we what when where which who why will with you your all can did do does day ' +
    'big little small good bad best new one two just like make made more most very book ' +
    'books story stories kids kid children child today time first last about after before'
  ).split(' ')
)

/** Tiny words Amazon search ignores — adding them to a keyword box gains nothing. */
const STOP = new Set(['a', 'an', 'and', '&', 'the', 'of', 'to', 'in', 'on', 'for', 'at', 'by'])

/** Normalise curly quotes/dashes so "Didn’t" and "Didn't" are the same word. */
function clean(s: string): string {
  return s
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[‐-—]/g, '-')
    .toLowerCase()
}

/** Split a phrase into words, keeping inner apostrophes and hyphens. */
export function tokenize(phrase: string): string[] {
  return clean(phrase)
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-z0-9&]+|[^a-z0-9&]+$/g, ''))
    .filter(Boolean)
}

/** Every word Amazon can already match, spelled as written (apostrophes kept). */
export function wordSet(phrases: string[]): Set<string> {
  const out = new Set<string>()
  for (const p of phrases) for (const w of tokenize(p)) out.add(w)
  return out
}

const stripApos = (w: string) => w.replace(/'/g, '')

/** Plausible misspellings of one distinctive word (rule-based, not random). */
export function typosFor(word: string): string[] {
  const w = stripApos(word)
  if (w.length < 4 || COMMON.has(w) || /\d/.test(w)) return []
  const out = new Set<string>()
  // Double letter written once: "feelings" → "felings", "happy" → "hapy".
  w.replace(/([a-z])\1/g, (m, c: string, i: number) => {
    out.add(w.slice(0, i) + c + w.slice(i + 2))
    return m
  })
  // -ie / -y / -ey endings get mixed up, especially in names: "rosie" → "rosy".
  if (w.endsWith('ie')) {
    out.add(w.slice(0, -2) + 'y')
    out.add(w.slice(0, -2) + 'ey')
  } else if (w.endsWith('ey')) {
    out.add(w.slice(0, -2) + 'y')
    out.add(w.slice(0, -2) + 'ie')
  } else if (w.endsWith('y') && w.length >= 5 && !/[aeiou]y$/.test(w)) {
    out.add(w.slice(0, -1) + 'ie')
  }
  // Sound-alike spellings.
  if (w.includes('ph')) out.add(w.replace('ph', 'f'))
  if (w.includes('ck')) out.add(w.replace('ck', 'k'))
  if (w.includes('ei')) out.add(w.replace('ei', 'ie'))
  // A dropped letter in a long compound: "sportsmanship" → "sportmanship".
  if (w.length >= 9) {
    const m = w.match(/^(.{3,}?)s(man|woman|ship)/)
    if (m) out.add(w.replace(`${m[1]}s${m[2]}`, `${m[1]}${m[2]}`))
  }
  out.delete(w)
  return [...out].slice(0, 3)
}

/**
 * Suggest variants of the title (and subtitle), plus — optionally — typos of
 * distinctive words in the author's other keywords (e.g. "sportsmanship").
 * `known` is every word Amazon can already match (title, subtitle, and the
 * non-variant keyword boxes); each variant's `newWords` excludes those.
 */
export function suggestVariants({
  title,
  subtitle,
  keywordPhrases = [],
}: {
  title: string
  subtitle?: string
  keywordPhrases?: string[]
}): Variant[] {
  const titlePhrases = [title, subtitle ?? ''].filter((p) => p.trim())
  const known = wordSet([...titlePhrases, ...keywordPhrases])
  const out: Variant[] = []
  const seen = new Set<string>()

  const push = (
    tokens: string[],
    kind: VariantKind,
    source: VariantSource,
    label: string,
    base: string[]
  ) => {
    const text = tokens.join(' ')
    if (!text || text === base.join(' ') || seen.has(text)) return
    seen.add(text)
    const newWords = [...new Set(tokens.filter((w) => w && !known.has(w) && !STOP.has(w)))]
    out.push({ text, kind, source, label, newWords })
  }

  for (const phrase of titlePhrases) {
    const t = tokenize(phrase)
    if (!t.length) continue
    const hasApos = t.some((w) => w.includes("'"))

    if (hasApos) {
      push(t.map(stripApos), 'apostrophe', 'title', 'Without the apostrophe', t)
      if (t.some((w) => CONTRACTIONS[w])) {
        push(
          t.flatMap((w) => (CONTRACTIONS[w] ? CONTRACTIONS[w].split(' ') : [w])),
          'expanded',
          'title',
          'Spelled out (no contraction)',
          t
        )
      }
      if (t.some((w) => w.endsWith("'s") && !CONTRACTIONS[w])) {
        push(
          t.map((w) => (w.endsWith("'s") && !CONTRACTIONS[w] ? w.slice(0, -2) : w)),
          'possessive',
          'title',
          "Without the 's",
          t
        )
      }
    }
    if (t.some((w) => w.includes('-'))) {
      push(
        t.flatMap((w) => w.split('-').filter(Boolean)),
        'hyphen',
        'title',
        'Hyphen as a space',
        t
      )
      push(t.map((w) => w.replace(/-/g, '')), 'hyphen', 'title', 'Hyphen removed', t)
    }
    if (t.includes('&') || t.includes('and')) {
      push(
        t.map((w) => (w === '&' ? 'and' : w === 'and' ? '&' : w)),
        'ampersand',
        'title',
        t.includes('&') ? '"&" as "and"' : '"and" as "&"',
        t
      )
    }
    if (t.some((w) => /^\d+$/.test(w) && Number(w) <= 20)) {
      push(
        t.map((w) => (/^\d+$/.test(w) && Number(w) <= 20 ? NUMBERS[Number(w)] : w)),
        'number',
        'title',
        'Number as a word',
        t
      )
    } else if (t.some((w) => NUMBERS.indexOf(w) > 0)) {
      push(
        t.map((w) => (NUMBERS.indexOf(w) > 0 ? String(NUMBERS.indexOf(w)) : w)),
        'number',
        'title',
        'Word as a number',
        t
      )
    }
    for (const w of t) {
      // For a possessive like "rosie's", misspell the name itself ("rosey").
      const core = w.endsWith("'s") && !CONTRACTIONS[w] ? w.slice(0, -2) : w
      for (const typo of typosFor(core)) {
        push(
          t.map((x) => (x === w ? typo : x)),
          'typo',
          'title',
          `Possible typo of "${stripApos(core)}"`,
          t
        )
      }
    }
  }

  // Typos of distinctive theme words in the other keyword boxes — long words
  // only (e.g. "sportsmanship", "mindfulness"), where misspelling is common.
  const themeWords = new Set<string>()
  for (const p of keywordPhrases) for (const w of tokenize(p)) if (stripApos(w).length >= 8) themeWords.add(w)
  let themeCount = 0
  for (const w of themeWords) {
    for (const typo of typosFor(w)) {
      if (themeCount >= 6) break
      push([typo], 'typo', 'keywords', `Possible typo of "${stripApos(w)}"`, [w])
      themeCount++
    }
  }

  return out
}

/** Unique new words across the chosen variants, in the order they appear. */
export function variantWords(chosen: Variant[]): string[] {
  const out: string[] = []
  for (const v of chosen) for (const w of v.newWords) if (!out.includes(w)) out.push(w)
  return out
}

/** Pack words into as few keyword boxes as possible (≤ 50 characters each). */
export function packBoxes(words: string[], max = KDP_KEYWORD_BOX_CHARS): string[] {
  const boxes: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length > max && cur) {
      boxes.push(cur)
      cur = w
    } else {
      cur = next
    }
  }
  if (cur) boxes.push(cur)
  return boxes
}

/**
 * For each keyword box, the words it adds beyond the title/subtitle and the
 * OTHER boxes. A box that adds nothing is redundant — Amazon already matches
 * all its words elsewhere — and is the first candidate to drop.
 */
export function boxNewWords(boxes: string[], titlePhrases: string[]): string[][] {
  const base = wordSet(titlePhrases)
  return boxes.map((box, i) => {
    const others = wordSet(boxes.filter((_, j) => j !== i))
    return [
      ...new Set(tokenize(box).filter((w) => !base.has(w) && !others.has(w) && !STOP.has(w))),
    ]
  })
}
