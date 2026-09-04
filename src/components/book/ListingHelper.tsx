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
import type { Book } from '@/lib/types'

type Tool = 'description' | 'subtitle' | 'keywords'

/**
 * Ready-to-paste Amazon/KDP listing copy generated from the story: a product
 * description, subtitle options, and search keywords. Read-only output with
 * Copy buttons — it never touches the manuscript. Lives on the Publish tab.
 */
export function ListingHelper({ book }: { book: Book }) {
  const online = useOnline()
  const [available, setAvailable] = useState<boolean | null>(null)
  const [loading, setLoading] = useState<Tool | null>(null)
  const [description, setDescription] = useState<string | null>(null)
  const [subtitles, setSubtitles] = useState<string[] | null>(null)
  const [keywords, setKeywords] = useState<KeywordItem[] | null>(null)

  useEffect(() => {
    checkWritingAvailability().then(setAvailable)
  }, [])

  const manuscript = book.manuscriptText.trim()
  const ready = available === true && online && manuscript.length > 0

  async function generate(tool: Tool) {
    setLoading(tool)
    try {
      const res = await callWrite({
        mode: tool,
        title: book.title,
        author: book.author,
        manuscript,
      })
      if (tool === 'description') {
        if (res.text) setDescription(res.text.trim())
        else toast('Nothing came back — try again.')
      } else if (tool === 'subtitle') {
        if (res.items?.length) setSubtitles(res.items)
        else toast('Nothing came back — try again.')
      } else {
        if (res.keywords?.length) setKeywords(res.keywords)
        else toast('Nothing came back — try again.')
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
      {loading === tool ? 'Writing…' : has ? 'Again' : idleLabel}
    </button>
  )

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-display text-xl font-semibold">Amazon listing helper</h2>
      <p className="mt-1 text-sm text-muted">
        Ready-to-paste copy for your book’s Amazon page — a description, a
        subtitle, and search keywords, all written from your story.
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
            <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-3 text-[15px] leading-relaxed">
              {description}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => copy(description, 'Description copied')}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
              >
                Copy
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
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2"
              >
                <span className="text-sm">{s}</span>
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
                  className="flex items-start justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="mr-2 text-muted">{i + 1}.</span>
                      {k.keyword}
                    </p>
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
