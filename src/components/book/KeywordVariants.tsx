'use client'

import { useState } from 'react'
import { patchListing } from '@/lib/db/dexie'
import {
  KDP_KEYWORD_BOXES,
  placeVariants,
  stripVariants,
  suggestVariants,
  variantWords,
  type Variant,
} from '@/lib/listing/variants'
import type { Book, ListingKeyword } from '@/lib/types'

/**
 * Keyword variant assistant: suggests the ways shoppers might type the title
 * that Amazon may not match on its own — no apostrophe ("didnt"), spelled out
 * ("did not"), hyphens, numbers, and common typos — as checkboxes. Ticked
 * variants are reduced to the words they add, which are tucked into spare room
 * in the existing keyword boxes (a new box only if none has room), and saved
 * with the book's other keywords.
 */
export function KeywordVariants({
  book,
  keywords,
  onApply,
}: {
  book: Book
  keywords: ListingKeyword[]
  onApply: (next: ListingKeyword[], accepted: string[]) => void
}) {
  const [subtitle, setSubtitle] = useState(book.listing?.subtitle ?? '')
  // The author's own boxes, without anything this assistant added to them.
  const ownBoxes = stripVariants(keywords)
  // Cheap pure computation — fine to redo on every render.
  const variants = suggestVariants({
    title: book.title,
    subtitle,
    keywordPhrases: ownBoxes.map((k) => k.keyword),
  })

  // Saved choices if any; otherwise tick every non-typo variant that helps.
  const [checked, setChecked] = useState<Set<string>>(() => {
    const saved = book.listing?.acceptedVariants
    if (saved) return new Set(saved)
    return new Set(
      suggestVariants({
        title: book.title,
        subtitle: book.listing?.subtitle,
        keywordPhrases: stripVariants(book.listing?.keywords ?? []).map((k) => k.keyword),
      })
        .filter((v) => v.kind !== 'typo' && v.newWords.length > 0)
        .map((v) => v.text)
    )
  })

  const chosen = variants.filter((v) => checked.has(v.text) && v.newWords.length > 0)
  const words = variantWords(chosen)
  const preview = placeVariants(keywords, words)
  const newBoxes = preview.length - ownBoxes.length
  const hostBoxes = preview
    .map((b, i) => (b.variantSuffix ? i + 1 : 0))
    .filter(Boolean)
  const over = preview.length - KDP_KEYWORD_BOXES
  const hasPlaced = keywords.some((k) => k.variant || k.variantSuffix)
  const same = (a: ListingKeyword, b: ListingKeyword) =>
    a.keyword === b.keyword &&
    Boolean(a.variant) === Boolean(b.variant) &&
    (a.variantSuffix ?? '') === (b.variantSuffix ?? '')
  const upToDate =
    preview.length === keywords.length && preview.every((b, i) => same(b, keywords[i]))

  function toggle(text: string) {
    const next = new Set(checked)
    if (next.has(text)) next.delete(text)
    else next.add(text)
    setChecked(next)
  }

  function apply() {
    onApply(preview, chosen.map((v) => v.text))
  }

  const groups: { title: string; hint?: string; items: Variant[] }[] = [
    {
      title: 'How shoppers might type your title',
      items: variants.filter((v) => v.source === 'title' && v.kind !== 'typo'),
    },
    {
      title: 'Common typos',
      hint: 'Only tick these for unusual words or names — Amazon already fixes typos of everyday words.',
      items: variants.filter((v) => v.kind === 'typo'),
    },
  ]

  if (!book.title.trim()) return null

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface-2/60 p-3">
      <h4 className="text-sm font-semibold">Spelling &amp; punctuation variants</h4>
      <p className="mt-0.5 text-xs text-muted">
        Amazon may not connect “Didnt” or “Did Not” to a title spelled “Didn’t”,
        especially while a book is new. Tick the versions shoppers might type and
        we’ll tuck the words they add into spare room in your keyword boxes, so
        they don’t use up a box.
      </p>

      <label htmlFor="kv-subtitle" className="mt-3 block text-xs font-semibold text-muted">
        Subtitle you’re using on KDP (optional)
      </label>
      <input
        id="kv-subtitle"
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        onBlur={() => patchListing(book.id, { subtitle: subtitle.trim() })}
        placeholder="Leave blank if none"
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-accent"
      />

      {variants.length === 0 ? (
        <p className="mt-3 text-xs text-muted">
          Your title has no apostrophes, hyphens, numbers or unusual words, so
          there are no variants to add.
        </p>
      ) : (
        groups.map(
          (g) =>
            g.items.length > 0 && (
              <div key={g.title} className="mt-3">
                <p className="text-xs font-semibold">{g.title}</p>
                {g.hint && <p className="text-[11px] text-muted">{g.hint}</p>}
                <ul className="mt-1 space-y-1">
                  {g.items.map((v) => {
                    const covered = v.newWords.length === 0
                    return (
                      <li key={v.text}>
                        <label
                          className={
                            covered
                              ? 'flex items-start gap-2 text-sm opacity-60'
                              : 'flex cursor-pointer items-start gap-2 text-sm'
                          }
                        >
                          <input
                            type="checkbox"
                            disabled={covered}
                            checked={!covered && checked.has(v.text)}
                            onChange={() => toggle(v.text)}
                            className="mt-1 h-4 w-4 accent-[color:var(--accent)]"
                          />
                          <span className="min-w-0">
                            <span className="font-medium">{v.text}</span>
                            <span className="block text-[11px] text-muted">
                              {v.label} ·{' '}
                              {covered
                                ? 'already covered — Amazon matches these words from your title'
                                : `adds: ${v.newWords.join(', ')}`}
                            </span>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
        )
      )}

      <div className="mt-3 rounded-lg bg-background px-3 py-2 text-xs">
        {words.length === 0 ? (
          <span className="text-muted">Nothing ticked, so nothing to add.</span>
        ) : (
          <>
            Adds{' '}
            <code className="rounded bg-surface-2 px-1">{words.join(' ')}</code>
            {newBoxes === 0 ? (
              <>
                {' '}
                to the spare room in box {hostBoxes.join(' & ')}. <strong>No extra box
                needed.</strong>
              </>
            ) : (
              <>
                {' '}
                — your boxes are too full to fit {hostBoxes.length ? 'all of them' : 'them'},
                so this uses <strong>{newBoxes}</strong> new box{newBoxes > 1 ? 'es' : ''}.
              </>
            )}
          </>
        )}
        {over > 0 && (
          <p className="mt-1 font-semibold text-red-600">
            That makes {preview.length} boxes, but KDP only has {KDP_KEYWORD_BOXES}.
            Remove {over} of the boxes above first. Any marked “adds nothing new” are
            the safest to drop.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={apply}
        disabled={upToDate}
        className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg disabled:opacity-50"
      >
        {upToDate
          ? words.length
            ? '✓ Saved in your keywords'
            : 'Nothing added'
          : words.length
            ? hasPlaced
              ? 'Update my keywords'
              : 'Add to my keywords'
            : 'Take the variants out'}
      </button>
    </div>
  )
}
