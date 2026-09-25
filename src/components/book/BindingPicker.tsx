'use client'

import { useState } from 'react'
import { patchBook } from '@/lib/db/dexie'
import {
  HARDCOVER_MIN_PAGES,
  HARDCOVER_MAX_PAGES,
  KDP_COVER_CALCULATOR_URL,
  TRIM_SIZES,
  type BindingId,
} from '@/lib/kdp/constants'
import type { Book } from '@/lib/types'
import { cn } from '@/lib/cn'

/**
 * Paperback / hardcover choice for the print files, plus the hardcover
 * safeguards: KDP's requirements up front, hard stops (wrong trim size, too many
 * pages), an acknowledgement before blank pages are added to reach KDP's
 * 75-page minimum, and the exact spine width from KDP's cover calculator.
 */
export function BindingPicker({
  book,
  storyPages,
  finalPages,
  blanksAdded,
  blockers,
  needsAck,
  ack,
  onAck,
  spineEstimateIn,
  coverSizeIn,
  onBindingChange,
}: {
  book: Book
  storyPages: number
  finalPages: number
  blanksAdded: number
  blockers: string[]
  needsAck: boolean
  ack: boolean
  onAck: (v: boolean) => void
  spineEstimateIn: number
  coverSizeIn: { w: number; h: number }
  onBindingChange: (b: BindingId) => void
}) {
  const binding = book.binding ?? 'paperback'
  const isHardcover = binding === 'hardcover'
  const [spineInput, setSpineInput] = useState(
    book.hardcoverSpineIn ? String(book.hardcoverSpineIn) : ''
  )
  function saveSpine() {
    const v = parseFloat(spineInput)
    if (!spineInput.trim()) {
      patchBook(book.id, { hardcoverSpineIn: undefined })
      return
    }
    if (!Number.isFinite(v) || v < 0.05 || v > 3) {
      setSpineInput(book.hardcoverSpineIn ? String(book.hardcoverSpineIn) : '')
      return
    }
    patchBook(book.id, { hardcoverSpineIn: v })
  }

  function choose(b: BindingId) {
    if (b === binding) return
    patchBook(book.id, { binding: b })
    onBindingChange(b)
  }

  return (
    <div className="mt-4 rounded-xl border border-border p-3">
      <span className="block text-xs font-semibold text-muted">Binding</span>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(['paperback', 'hardcover'] as BindingId[]).map((b) => (
          <button
            key={b}
            type="button"
            aria-pressed={binding === b}
            onClick={() => choose(b)}
            className={cn(
              'rounded-xl border px-3 py-2 text-left text-sm font-semibold',
              binding === b ? 'border-accent bg-accent-soft' : 'border-border hover:bg-surface-2'
            )}
          >
            {b === 'paperback' ? '📖 Paperback' : '📚 Hardcover'}
            <span className="mt-0.5 block text-xs font-normal text-muted">
              {b === 'paperback'
                ? '24+ pages · all our sizes'
                : `${HARDCOVER_MIN_PAGES}+ pages · 7″×10″ only`}
            </span>
          </button>
        ))}
      </div>

      {isHardcover && (
        <div className="mt-3 space-y-3 text-sm">
          {/* Requirements up front */}
          <div className="rounded-lg bg-[color:var(--warn)]/12 px-3 py-2 text-xs text-[color:var(--warn)]">
            <p className="font-semibold">KDP hardcover requirements</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>
                <strong>At least {HARDCOVER_MIN_PAGES} pages</strong> (max{' '}
                {HARDCOVER_MAX_PAGES}) — KDP rejects shorter hardcovers.
              </li>
              <li>Only the 7″ × 10″ size (of the sizes Viola House offers).</li>
              <li>White paper, case-laminate (printed cover glued to boards).</li>
              <li>Hardcovers cost more to print, so your royalty per copy is lower.</li>
            </ul>
          </div>

          {/* Hard stops */}
          {blockers.map((b) => (
            <div
              key={b}
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
            >
              <p className="font-semibold">Can&apos;t make a hardcover yet</p>
              <p className="mt-0.5">{b}</p>
              {b.includes("don't come in") && (
                <p className="mt-1">
                  Change the book size on the <strong>Write</strong> tab to{' '}
                  {TRIM_SIZES['7x10'].label}. Changing the size changes the page
                  shape, so look over your illustrations afterward.
                </p>
              )}
            </div>
          ))}

          {/* Blank-page padding — allowed, but only with acknowledgement */}
          {needsAck && blockers.length === 0 && (
            <div className="rounded-lg border border-[color:var(--warn)] px-3 py-2 text-xs">
              <p className="font-semibold text-[color:var(--warn)]">
                ⚠️ Your book is shorter than {HARDCOVER_MIN_PAGES} pages
              </p>
              <p className="mt-1 text-muted">
                You have {storyPages} story pages ({storyPages + 2} with the title
                and copyright pages). To meet KDP&apos;s minimum,{' '}
                <strong>{blanksAdded} blank pages</strong> will be added at the end,
                for {finalPages} pages total. Readers will see those empty pages.
                If you can, spread your story across more pages on the{' '}
                <strong>Pages</strong> tab instead.
              </p>
              <label className="mt-2 flex cursor-pointer items-start gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => onAck(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[color:var(--accent)]"
                />
                <span>
                  I understand {blanksAdded} blank pages will be added to my
                  hardcover.
                </span>
              </label>
            </div>
          )}

          {/* Spine width from KDP's calculator */}
          {blockers.length === 0 && (
            <div className="rounded-lg border border-border px-3 py-2">
              <label htmlFor="hc-spine" className="block text-xs font-semibold text-muted">
                Spine width from KDP&apos;s cover calculator (inches)
              </label>
              <input
                id="hc-spine"
                inputMode="decimal"
                value={spineInput}
                onChange={(e) => setSpineInput(e.target.value)}
                onBlur={saveSpine}
                placeholder={spineEstimateIn.toFixed(3)}
                className="mt-1 w-32 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-accent"
              />
              <p className="mt-1 text-xs text-muted">
                Open{' '}
                <a
                  href={KDP_COVER_CALCULATOR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-accent underline"
                >
                  KDP&apos;s cover calculator ↗
                </a>
                , choose <strong>Hardcover</strong>, white paper,{' '}
                {TRIM_SIZES[book.trimSize].label}, and {finalPages} pages, then
                type the spine width it shows here. Until you do, we use an estimate
                ({spineEstimateIn.toFixed(3)}″), and KDP may reject the cover if it
                doesn&apos;t match.
              </p>
              <p className="mt-1 text-xs text-muted">
                Your cover file will be{' '}
                <strong>
                  {coverSizeIn.w.toFixed(3)}″ × {coverSizeIn.h.toFixed(3)}″
                </strong>{' '}
                — check that it matches the calculator&apos;s full cover size.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
