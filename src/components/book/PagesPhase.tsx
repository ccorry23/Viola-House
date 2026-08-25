'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { patchBook, getPages, replacePages } from '@/lib/db/dexie'
import {
  splitSentences,
  pagesFromBreaks,
  autoPageBreaks,
  pageBreaksForTargetCount,
  validBreaks,
} from '@/lib/pages/split'
import type { Book, Page } from '@/lib/types'
import { MIN_PAGE_COUNT } from '@/lib/kdp/constants'
import { cn } from '@/lib/cn'

export function PagesPhase({
  book,
  onGoToIllustrate,
}: {
  book: Book
  onGoToIllustrate: () => void
}) {
  const sentences = useMemo(
    () => splitSentences(book.manuscriptText),
    [book.manuscriptText]
  )
  const breaks = useMemo(
    () => validBreaks(book.manuscriptText, book.pageBreaks),
    [book.manuscriptText, book.pageBreaks]
  )
  const pages = useMemo(
    () => pagesFromBreaks(book.manuscriptText, breaks),
    [book.manuscriptText, breaks]
  )

  // First time in with no breaks yet → seed with the auto suggestion.
  useEffect(() => {
    if (
      !book.breaksLocked &&
      book.pageBreaks.length === 0 &&
      sentences.length > 0
    ) {
      patchBook(book.id, { pageBreaks: autoPageBreaks(book.manuscriptText) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, sentences.length])

  const locked = book.breaksLocked

  function setBreaks(next: number[]) {
    patchBook(book.id, {
      pageBreaks: [...new Set(next)].sort((a, b) => a - b),
    })
  }
  function splitAt(offset: number) {
    if (locked) return
    setBreaks([...breaks, offset])
  }
  function mergeUp(pageStartOffset: number) {
    if (locked) return
    setBreaks(breaks.filter((b) => b !== pageStartOffset))
  }
  function autoSplit() {
    setBreaks(autoPageBreaks(book.manuscriptText))
    toast.success('Re-split into pages')
  }

  const [target, setTarget] = useState('')
  // Seed the target box with a sensible starting point once the story is known.
  useEffect(() => {
    if (sentences.length > 0 && target === '') {
      setTarget(String(Math.min(MIN_PAGE_COUNT, sentences.length)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentences.length])

  function applyTargetCount() {
    const n = Math.max(
      1,
      Math.min(Math.round(Number(target) || 1), sentences.length)
    )
    const next = pageBreaksForTargetCount(book.manuscriptText, n)
    setBreaks(next)
    const achieved = pagesFromBreaks(book.manuscriptText, next).length
    toast.success(`Split into ${achieved} ${achieved === 1 ? 'page' : 'pages'}`)
  }

  async function lockPages() {
    // Build concrete page records, preserving any existing images when the
    // page text is unchanged at the same index.
    const existing = await getPages(book.id)
    const now = Date.now()
    const records: Page[] = pages.map((p, index) => {
      const prev = existing[index]
      const keepImage = prev && prev.text === p.text ? prev : null
      return {
        id: keepImage?.id ?? crypto.randomUUID(),
        bookId: book.id,
        index,
        text: p.text,
        image: keepImage?.image,
        imageStatus: keepImage?.imageStatus ?? 'none',
        promptUsed: keepImage?.promptUsed,
        updatedAt: now,
      }
    })
    await replacePages(book.id, records)
    await patchBook(book.id, { breaksLocked: true, status: 'illustrating' })
    toast.success('Page breaks locked')
    onGoToIllustrate()
  }

  async function unlock() {
    await patchBook(book.id, {
      breaksLocked: false,
      status: book.status === 'ready' ? 'illustrating' : book.status,
    })
    toast('Page breaks unlocked — you can adjust them again.')
  }

  if (sentences.length === 0) {
    return (
      <div className="py-16 text-center text-muted">
        Write your story on the Write tab first, then come back to split it into
        pages.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">
            {pages.length} {pages.length === 1 ? 'page' : 'pages'}
          </h2>
          <p className="text-sm text-muted">
            {locked
              ? 'Locked. Unlock to change where pages break.'
              : 'Click between sentences to start a new page, or merge pages together.'}
          </p>
        </div>
        <div className="flex gap-2">
          {!locked ? (
            <>
              <button
                onClick={autoSplit}
                className="rounded-xl border border-border px-3.5 py-2 text-sm font-semibold hover:bg-surface-2"
              >
                Auto-split
              </button>
              <button
                onClick={lockPages}
                className="rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg"
              >
                Lock page breaks →
              </button>
            </>
          ) : (
            <button
              onClick={unlock}
              className="rounded-xl border border-border px-3.5 py-2 text-sm font-semibold hover:bg-surface-2"
            >
              Unlock to edit
            </button>
          )}
        </div>
      </div>

      {!locked && (
        <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
          <h3 className="font-display text-base font-semibold">Set page count</h3>
          <p className="mt-0.5 text-sm text-muted">
            Choose about how many pages you want. We’ll balance the story across
            them, keeping related paragraphs together where we can — rather than
            breaking after every sentence.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor="target-pages" className="text-sm font-semibold">
              Target pages
            </label>
            <input
              id="target-pages"
              type="number"
              min={1}
              max={sentences.length}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyTargetCount()
              }}
              className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              onClick={applyTargetCount}
              className="rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg"
            >
              Set pages
            </button>
            <span className="text-xs text-muted">
              KDP needs at least {MIN_PAGE_COUNT}. Your story has{' '}
              {sentences.length}{' '}
              {sentences.length === 1 ? 'sentence' : 'sentences'}, so that’s the
              most pages possible.
            </span>
          </div>
        </div>
      )}

      {pages.length < MIN_PAGE_COUNT && (
        <p className="mt-3 rounded-lg bg-[color:var(--warn)]/12 px-3 py-2 text-xs text-[color:var(--warn)]">
          KDP paperbacks need at least {MIN_PAGE_COUNT} interior pages. You have{' '}
          {pages.length}. Blank pages will be added automatically at export to
          reach the minimum — your story pages are unaffected.
        </p>
      )}

      <div className="mt-6 space-y-3">
        {pages.map((page, pageIndex) => {
          const pageStart = page.sentences[0]?.start ?? 0
          return (
            <div
              key={pageStart}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-display text-sm font-semibold text-muted">
                  Page {pageIndex + 1}
                </span>
                {pageIndex > 0 && !locked && (
                  <button
                    onClick={() => mergeUp(pageStart)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-accent hover:bg-accent-soft"
                  >
                    ⤒ Merge with previous
                  </button>
                )}
              </div>

              <p className="font-display text-[17px] leading-relaxed">
                {page.sentences.map((s, i) => (
                  <span key={s.start}>
                    {i > 0 && !locked && (
                      <SplitHandle onClick={() => splitAt(s.start)} />
                    )}
                    {i > 0 && locked && ' '}
                    {s.text}
                  </span>
                ))}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SplitHandle({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Split into a new page here"
      aria-label="Split into a new page here"
      className={cn(
        'mx-0.5 inline-flex h-9 w-9 items-center justify-center align-middle',
        'rounded-full text-base text-muted/70',
        'hover:bg-accent-soft hover:text-accent focus-visible:bg-accent-soft focus-visible:text-accent'
      )}
    >
      ✂
    </button>
  )
}
