'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  callWrite,
  checkWritingAvailability,
  WriteError,
  type KeywordItem,
} from '@/lib/ai/writeClient'
import { useOnline } from '@/lib/hooks/useOnline'
import { patchBook, patchListing } from '@/lib/db/dexie'
import type { Book, ListingCopy } from '@/lib/types'

type Tool = 'description' | 'subtitle' | 'keywords'

/**
 * Ready-to-paste Amazon/KDP listing copy generated from the story: a product
 * description, subtitle options, and search keywords. Each result is saved on
 * the book (so it's still there next visit), can be edited in place, and can
 * be redone. It never touches the manuscript. Lives on the Publish tab.
 */
export function ListingHelper({ book }: { book: Book }) {
  const online = useOnline()
  const [available, setAvailable] = useState<boolean | null>(null)
  const [loading, setLoading] = useState<Tool | null>(null)
  // Start from what was saved last time (remounted per book via `key`).
  const [description, setDescription] = useState<string | null>(
    book.listing?.description ?? null
  )
  const [subtitles, setSubtitles] = useState<string[] | null>(
    book.listing?.subtitles?.length ? book.listing.subtitles : null
  )
  const [keywords, setKeywords] = useState<KeywordItem[] | null>(
    book.listing?.keywords?.length ? book.listing.keywords : null
  )

  /** Save one part of the listing copy onto the book. */
  function save(part: Partial<ListingCopy>) {
    patchListing(book.id, part)
  }

  useEffect(() => {
    checkWritingAvailability().then(setAvailable)
  }, [])

  const manuscript = book.manuscriptText.trim()
  const ready = available === true && online && manuscript.length > 0

  const REDO_WARNING: Record<Tool, string> = {
    description: 'Write a new description? This replaces the saved one, including your edits.',
    subtitle: 'Suggest new subtitles? This replaces the saved ones, including your edits.',
    keywords: 'Suggest new keywords? This replaces the saved ones, including your edits.',
  }

  async function generate(tool: Tool) {
    const has =
      tool === 'description' ? Boolean(description) : tool === 'subtitle' ? Boolean(subtitles) : Boolean(keywords)
    if (has && !window.confirm(REDO_WARNING[tool])) return
    setLoading(tool)
    try {
      const res = await callWrite({
        mode: tool,
        title: book.title,
        author: book.author,
        manuscript,
      })
      if (tool === 'description') {
        if (res.text) {
          const text = res.text.trim()
          setDescription(text)
          save({ description: text })
        } else toast('Nothing came back — try again.')
      } else if (tool === 'subtitle') {
        if (res.items?.length) {
          setSubtitles(res.items)
          save({ subtitles: res.items })
        } else toast('Nothing came back — try again.')
      } else {
        if (res.keywords?.length) {
          setKeywords(res.keywords)
          save({ keywords: res.keywords })
        } else toast('Nothing came back — try again.')
      }
    } catch (e) {
      if (e instanceof WriteError && e.code === 'no_key') setAvailable(false)
      toast.error(e instanceof Error ? e.message : 'Could not generate')
    } finally {
      setLoading(null)
    }
  }

  function copy(text: string, label = 'Copied') {
    navigator.clipboard?.writeText(text)
    toast.success(label)
  }

  const genBtn = (tool: Tool, has: boolean, idleLabel: string) => (
    <button
      onClick={() => generate(tool)}
      disabled={!ready || loading !== null}
      className="shrink-0 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50"
    >
      {loading === tool ? 'Writing…' : has ? '↻ Redo' : idleLabel}
    </button>
  )

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-display text-xl font-semibold">Amazon listing helper</h2>
      <p className="mt-1 text-sm text-muted">
        Ready-to-paste copy for your book’s Amazon page — a description, a
        subtitle, and search keywords, all written from your story. What you
        generate is saved with the book — tap any of it to edit.
      </p>

      {available === false && (
        <p className="mt-3 rounded-lg bg-[color:var(--warn)]/12 px-3 py-2 text-sm text-[color:var(--warn)]">
          The writing helper isn’t turned on yet — ask whoever set up this app to
          enable it.
        </p>
      )}
      {available !== false && manuscript.length === 0 && (
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
          Write your story on the Write tab first, then I can help with the
          listing.
        </p>
      )}

      {/* Description */}
      <div className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold">Description</h3>
            <p className="text-xs text-muted">Goes in KDP’s “Description” box.</p>
          </div>
          {genBtn('description', Boolean(description), 'Write it')}
        </div>
        {description && (
          <div className="mt-2">
            <textarea
              aria-label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => save({ description })}
              rows={10}
              className="block w-full resize-y rounded-xl border border-border bg-background p-3 text-[15px] leading-relaxed outline-none focus:border-accent"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => copy(description, 'Description copied')}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
              >
                Copy
              </button>
              <button
                onClick={async () => {
                  await patchBook(book.id, { blurb: description })
                  toast.success('Saved as the back cover description')
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
              >
                Use on back cover
              </button>
              <span className="text-xs text-muted">
                {description.split(/\s+/).filter(Boolean).length} words ·{' '}
                {description.length}/4000 characters
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Subtitle */}
      <div className="mt-5 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold">Subtitle</h3>
            <p className="text-xs text-muted">
              Optional line under the title. Pick one and copy it.
            </p>
          </div>
          {genBtn('subtitle', Boolean(subtitles), 'Suggest')}
        </div>
        {subtitles && (
          <ul className="mt-2 space-y-2">
            {subtitles.map((s, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-accent"
              >
                <input
                  aria-label={`Subtitle ${i + 1}`}
                  value={s}
                  onChange={(e) =>
                    setSubtitles(subtitles.map((x, j) => (j === i ? e.target.value : x)))
                  }
                  onBlur={() => save({ subtitles })}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
                <button
                  onClick={() => copy(s, 'Subtitle copied')}
                  className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-surface-2"
                >
                  Copy
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Keywords */}
      <div className="mt-5 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold">Keywords</h3>
            <p className="text-xs text-muted">
              KDP gives you 7 boxes (50 characters each) — copy one into each.
              Chosen to reach different Amazon searches.
            </p>
          </div>
          {genBtn('keywords', Boolean(keywords), 'Suggest')}
        </div>
        {keywords && (
          <>
            <ol className="mt-2 space-y-2">
              {keywords.map((k, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-accent"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted">{i + 1}.</span>
                      <input
                        aria-label={`Keyword ${i + 1}`}
                        value={k.keyword}
                        onChange={(e) =>
                          setKeywords(
                            keywords.map((x, j) =>
                              j === i ? { ...x, keyword: e.target.value } : x
                            )
                          )
                        }
                        onBlur={() => save({ keywords })}
                        className="min-w-0 flex-1 bg-transparent outline-none"
                      />
                      <span
                        className={
                          k.keyword.length > 50
                            ? 'shrink-0 text-xs font-semibold text-red-600'
                            : 'shrink-0 text-xs text-muted'
                        }
                      >
                        {k.keyword.length}/50
                      </span>
                    </div>
                    {k.why && (
                      <p className="mt-0.5 text-xs text-muted">→ {k.why}</p>
                    )}
                  </div>
                  <button
                    onClick={() => copy(k.keyword, 'Keyword copied')}
                    className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-surface-2"
                  >
                    Copy
                  </button>
                </li>
              ))}
            </ol>
            <button
              onClick={() =>
                copy(keywords.map((k) => k.keyword).join('\n'), 'All keywords copied')
              }
              className="mt-2 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
            >
              Copy all
            </button>
          </>
        )}
      </div>
    </section>
  )
}
