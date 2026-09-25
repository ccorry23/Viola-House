'use client'

import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import toast from 'react-hot-toast'
import { getPages } from '@/lib/db/dexie'
import { useBlobUrl } from '@/lib/hooks/useBlobUrl'
import { callWrite } from '@/lib/ai/writeClient'
import { fileStem } from '@/lib/pdf/export'
import {
  renderAplusSlide,
  SLIDE_W,
  SLIDE_H,
  type SlideTemplate,
} from '@/lib/marketing/slide'
import type { Book } from '@/lib/types'
import { cn } from '@/lib/cn'

/**
 * Generate an Amazon A+ Content marketing banner (1940×600 "Image & Text
 * Overlay") from the book's art + a headline and up to 3 benefit lines. Preview
 * updates live; the image downloads for upload into KDP's A+ Content builder.
 */
export function MarketingSlide({ book }: { book: Book }) {
  const pages = useLiveQuery(() => getPages(book.id), [book.id]) ?? []
  const [template, setTemplate] = useState<SlideTemplate>('overlay')
  const [headline, setHeadline] = useState('')
  const [bullets, setBullets] = useState<string[]>(['', '', ''])
  // Default to the cover art when there is one (captured once on mount).
  const [imageBlob, setImageBlob] = useState<Blob | null>(
    () => book.style.characterSheet ?? null
  )
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const urlRef = useRef<string | null>(null)

  const candidates: { key: string; label: string; blob: Blob }[] = []
  if (book.style.characterSheet) {
    candidates.push({ key: 'cover', label: 'Cover', blob: book.style.characterSheet })
  }
  for (const p of [...pages].sort((a, b) => a.index - b.index)) {
    if (p.image) candidates.push({ key: p.id, label: `Page ${p.index + 1}`, blob: p.image })
  }

  // Live preview (debounced so typing stays smooth).
  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const bytes = await renderAplusSlide({ imageBlob, headline, bullets, template })
        if (cancelled) return
        const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/jpeg' }))
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = url
        setPreviewUrl(url)
      } catch {
        /* ignore transient render errors while typing */
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [imageBlob, headline, bullets, template])

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    []
  )

  async function suggest() {
    if (!book.manuscriptText.trim()) {
      toast.error('Write your story first, then I can suggest benefits.')
      return
    }
    setSuggesting(true)
    try {
      const res = await callWrite({
        mode: 'benefits',
        manuscript: book.manuscriptText,
        title: book.title,
      })
      const lines = (res.text ?? '')
        .split('\n')
        .map((l) => l.replace(/^[-*•\d.\s"]+|["\s]+$/g, '').trim())
        .filter(Boolean)
      if (!lines.length) throw new Error('No suggestions came back — try again.')
      setHeadline(lines[0])
      setBullets([lines[1] ?? '', lines[2] ?? '', lines[3] ?? ''])
      toast.success('Added a headline and benefits')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not suggest benefits')
    } finally {
      setSuggesting(false)
    }
  }

  async function download() {
    try {
      const bytes = await renderAplusSlide({ imageBlob, headline, bullets, template })
      const blob = new Blob([bytes as BlobPart], { type: 'image/jpeg' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileStem(book.title)}-amazon-1940x600.jpg`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the image')
    }
  }

  const setBullet = (i: number, v: string) =>
    setBullets((b) => b.map((x, j) => (j === i ? v : x)))

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-display text-xl font-semibold">Amazon marketing image</h2>
      <p className="mt-1 text-sm text-muted">
        A wide banner (1940×600) for Amazon&apos;s{' '}
        <strong>A+ Content</strong> — the “From the Publisher” section further
        down your book&apos;s page. Add a headline and a few things the book
        teaches, pick a picture, and download it to upload in KDP.
      </p>

      {/* Preview */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface-2">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Marketing banner preview"
            className="block w-full"
            style={{ aspectRatio: `${SLIDE_W} / ${SLIDE_H}` }}
          />
        ) : (
          <div
            className="flex items-center justify-center text-sm text-muted"
            style={{ aspectRatio: `${SLIDE_W} / ${SLIDE_H}` }}
          >
            Preview appears here
          </div>
        )}
      </div>

      {/* Layout toggle */}
      <div className="mt-4 flex gap-2">
        {(['overlay', 'split'] as SlideTemplate[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTemplate(t)}
            className={cn(
              'rounded-xl border px-3.5 py-2 text-sm font-semibold',
              template === t ? 'border-accent bg-accent-soft' : 'border-border hover:bg-surface-2'
            )}
          >
            {t === 'overlay' ? 'Text over picture' : 'Text beside picture'}
          </button>
        ))}
      </div>

      {/* Text */}
      <div className="mt-4 rounded-xl border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted">Headline &amp; benefits</span>
          <button
            type="button"
            onClick={suggest}
            disabled={suggesting}
            className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent-soft disabled:opacity-60"
          >
            {suggesting ? 'Thinking…' : '✨ Suggest from my story'}
          </button>
        </div>
        <input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Headline — e.g. Big feelings, gentle lessons"
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {bullets.map((b, i) => (
          <input
            key={i}
            value={b}
            onChange={(e) => setBullet(i, e.target.value)}
            placeholder={`Benefit ${i + 1} — a short thing your child learns`}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        ))}
        <p className="mt-1 text-xs text-muted">
          Keep it wholesome and factual — Amazon A+ doesn&apos;t allow prices,
          discounts, or words like “new,” “now,” or “buy.”
        </p>
      </div>

      {/* Image */}
      <div className="mt-3 rounded-xl border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted">Picture</span>
          <label className="cursor-pointer rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-2">
            ↑ Upload
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setImageBlob(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        {candidates.length > 0 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {candidates.map((c) => (
              <Thumb
                key={c.key}
                label={c.label}
                blob={c.blob}
                selected={imageBlob === c.blob}
                onClick={() => setImageBlob(c.blob)}
              />
            ))}
          </div>
        )}
      </div>

      <button
        onClick={download}
        className="mt-4 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg"
      >
        ↓ Download banner (1940×600)
      </button>
      <p className="mt-2 text-xs text-muted">
        In KDP, open <strong>A+ Content</strong> → add an{' '}
        <strong>Image &amp; Text Overlay</strong> module → upload this image.
        You can add up to 5 modules.
      </p>
    </section>
  )
}

function Thumb({
  label,
  blob,
  selected,
  onClick,
}: {
  label: string
  blob: Blob
  selected: boolean
  onClick: () => void
}) {
  const url = useBlobUrl(blob)
  return (
    <button
      onClick={onClick}
      title={`Use ${label}`}
      className={cn(
        'shrink-0 rounded-lg border p-1',
        selected ? 'border-accent' : 'border-border hover:border-accent'
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="h-16 w-16 rounded object-cover" />
      ) : (
        <div className="h-16 w-16 rounded bg-surface-2" />
      )}
      <div className="mt-0.5 text-center text-[10px] text-muted">{label}</div>
    </button>
  )
}
