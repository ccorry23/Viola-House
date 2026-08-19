'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import toast from 'react-hot-toast'
import { db, getPages, patchPage, patchBook } from '@/lib/db/dexie'
import {
  checkImageAvailability,
  generatePageImage,
  generateReferenceSheet,
  IllustrateError,
} from '@/lib/images/client'
import { useOnline } from '@/lib/hooks/useOnline'
import { useBlobUrl } from '@/lib/hooks/useBlobUrl'
import { TRIM_SIZES } from '@/lib/kdp/constants'
import type { Book, Page, StyleLock } from '@/lib/types'
import { cn } from '@/lib/cn'

export function IllustratePhase({
  book,
  onGoToPublish,
}: {
  book: Book
  onGoToPublish: () => void
}) {
  const online = useOnline()
  const [available, setAvailable] = useState<boolean | null>(null)
  const pages = useLiveQuery(() => getPages(book.id), [book.id]) ?? []

  useEffect(() => {
    checkImageAvailability().then((a) => setAvailable(a.available))
  }, [])

  const canGenerate = available === true && online
  // The cover is the anchor: pages can't be AI-illustrated until it's set, so
  // every page matches an approved look. (Uploading your own art is always OK.)
  const hasCover = Boolean(book.style.characterSheet)
  const canGeneratePages = canGenerate && hasCover

  const readyCount = pages.filter((p) => p.imageStatus === 'ready').length
  const allDone = pages.length > 0 && readyCount === pages.length

  return (
    <div className="mx-auto max-w-4xl">
      <CoverPanel book={book} />

      {available === false && (
        <Banner tone="warn">
          AI illustration isn&apos;t turned on yet — ask whoever set up this app
          to enable it. You can still <strong>upload your own art</strong> on
          each page below, and write, split, and export as usual.
        </Banner>
      )}
      {available !== false && !online && (
        <Banner tone="muted">
          You&apos;re offline. Reconnect to generate illustrations — your pages
          are safe and waiting.
        </Banner>
      )}

      <div className="mt-8 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">
            Step 2 · Your pages{' '}
            <span className="text-muted">
              ({readyCount}/{pages.length})
            </span>
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {hasCover
              ? 'Illustrate every page in your cover’s style — all at once or one at a time.'
              : 'Create your cover above first — it sets the look every page will match. (You can still upload your own art on any page.)'}
          </p>
        </div>
        {hasCover && (
          <GenerateAll
            book={book}
            pages={pages}
            disabled={!canGeneratePages}
            onDone={() => {}}
          />
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {pages.map((page) => (
          <PageCard
            key={page.id}
            book={book}
            page={page}
            canGenerate={canGeneratePages}
            onNoKey={() => setAvailable(false)}
          />
        ))}
      </div>

      {allDone && (
        <div className="mt-8 flex justify-end">
          <button
            onClick={onGoToPublish}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg"
          >
            Continue to Publish →
          </button>
        </div>
      )}
    </div>
  )
}

// ---- Style panel ------------------------------------------------------------

function CoverPanel({ book }: { book: Book }) {
  const online = useOnline()
  const [descriptor, setDescriptor] = useState(book.style.descriptor)
  const [palette, setPalette] = useState(book.style.palette)
  const [characters, setCharacters] = useState(book.style.characters)
  const [genRef, setGenRef] = useState(false)
  const [collapsed, setCollapsed] = useState(book.style.locked)

  const sheetUrl = useBlobUrl(book.style.characterSheet)

  async function saveStyle(patch: Partial<StyleLock>) {
    await patchBook(book.id, { style: { ...book.style, ...patch } })
  }

  async function makeReference() {
    setGenRef(true)
    try {
      await saveStyle({ descriptor, palette, characters })
      const blob = await generateReferenceSheet({
        ...book.style,
        descriptor,
        palette,
        characters,
      })
      await saveStyle({
        descriptor,
        palette,
        characters,
        characterSheet: blob,
      })
      toast.success('Cover ready')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate')
    } finally {
      setGenRef(false)
    }
  }

  async function uploadReference(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    await saveStyle({ descriptor, palette, characters, characterSheet: file })
    toast.success('Cover set — the AI will match this look')
  }

  if (collapsed) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
        {sheetUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sheetUrl}
            alt="Cover"
            className="h-12 w-12 rounded-lg object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">✓ Cover set</p>
          <p className="truncate text-xs text-muted">
            {book.style.descriptor || 'Illustrate your pages below'}
          </p>
        </div>
        <button
          onClick={() => setCollapsed(false)}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-2"
        >
          Edit cover
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-display text-lg font-semibold">
        Step 1 · Create your cover
      </h2>
      <p className="mt-1 text-sm text-muted">
        Start with one image — your cover. Describe the look, generate it, and
        regenerate until the theme feels right. This cover sets the style the AI
        matches on every page.
      </p>

      <div className="mt-4 grid gap-3">
        <Field label="Style">
          <textarea
            value={descriptor}
            onChange={(e) => setDescriptor(e.target.value)}
            onBlur={() => saveStyle({ descriptor })}
            rows={2}
            placeholder="e.g. soft watercolor, gentle rounded shapes, dreamy and warm"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Colors (optional)">
          <input
            value={palette}
            onChange={(e) => setPalette(e.target.value)}
            onBlur={() => saveStyle({ palette })}
            placeholder="e.g. warm autumn oranges and soft browns"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Characters">
          <textarea
            value={characters}
            onChange={(e) => setCharacters(e.target.value)}
            onBlur={() => saveStyle({ characters })}
            rows={2}
            placeholder="e.g. Pip, a small orange fox with a white-tipped tail and a blue scarf"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-2">
            {sheetUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sheetUrl}
                alt="Cover"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-3xl opacity-40" aria-hidden>
                🖼️
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={makeReference}
              disabled={genRef || !online || !descriptor.trim()}
              className="rounded-xl border border-border px-3.5 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
            >
              {genRef
                ? 'Generating…'
                : book.style.characterSheet
                  ? 'Regenerate cover'
                  : 'Generate cover'}
            </button>
            <label className="cursor-pointer rounded-xl border border-border px-3.5 py-2 text-center text-sm font-semibold hover:bg-surface-2">
              ↑ Upload your own
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  uploadReference(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        </div>

        <button
          onClick={() => {
            saveStyle({ descriptor, palette, characters, locked: true })
            setCollapsed(true)
          }}
          disabled={!book.style.characterSheet}
          title={
            book.style.characterSheet
              ? 'Use this cover and move on to your pages'
              : 'Generate or upload a cover first'
          }
          className="ml-auto rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          Use this cover →
        </button>
      </div>

      {book.style.characterSheet ? (
        <p className="mt-3 rounded-lg bg-[color:var(--ok)]/12 px-3 py-2 text-xs text-[color:var(--ok)]">
          ✓ Cover set. Now illustrate your pages below — all at once or one at a
          time.
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted">
          Prefer to draw it yourself? Upload your own cover — or skip AI entirely
          and upload a finished illustration on each page below.
        </p>
      )}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      {children}
    </label>
  )
}

// ---- Page card --------------------------------------------------------------

function PageCard({
  book,
  page,
  canGenerate,
  onNoKey,
}: {
  book: Book
  page: Page
  canGenerate: boolean
  onNoKey: () => void
}) {
  const trim = TRIM_SIZES[book.trimSize]
  const aspect = trim.w / trim.h
  const url = useBlobUrl(page.image)
  const generating = page.imageStatus === 'generating'

  async function generate() {
    await patchPage(page.id, { imageStatus: 'generating' })
    try {
      const freshBook = await db.books.get(book.id)
      const blob = await generatePageImage(
        freshBook?.style ?? book.style,
        page.text
      )
      await patchPage(page.id, {
        image: blob,
        imageStatus: 'ready',
        imageSource: 'ai',
      })
    } catch (e) {
      await patchPage(page.id, { imageStatus: 'error' })
      if (e instanceof IllustrateError && e.code === 'no_key') onNoKey()
      toast.error(e instanceof Error ? e.message : 'Generation failed')
    }
  }

  async function uploadImage(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    await patchPage(page.id, {
      image: file,
      imageStatus: 'ready',
      imageSource: 'upload',
    })
    toast.success(`Page ${page.index + 1} illustration added`)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div
        className="relative w-full bg-surface-2"
        style={{ aspectRatio: String(aspect) }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Page ${page.index + 1}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl opacity-30">
            🎨
          </div>
        )}
        {generating && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-semibold text-white">
            Painting…
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-semibold text-white">
          Page {page.index + 1}
        </span>
        {page.imageStatus === 'ready' && page.imageSource && (
          <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-semibold text-white">
            {page.imageSource === 'upload' ? '🖐 Yours' : '🎨 AI'}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-sm text-muted">{page.text}</p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={generate}
            disabled={!canGenerate || generating}
            className={cn(
              'flex-1 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50',
              page.imageStatus === 'ready'
                ? 'border border-border hover:bg-surface-2'
                : 'bg-accent text-accent-fg'
            )}
          >
            {generating
              ? 'Painting…'
              : page.imageStatus === 'ready'
                ? 'Regenerate'
                : page.imageStatus === 'error'
                  ? 'Try again'
                  : 'Generate with AI'}
          </button>
          <label
            className="cursor-pointer whitespace-nowrap rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-2"
            title="Upload your own illustration for this page"
          >
            ↑ Upload your own
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                uploadImage(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </div>
    </div>
  )
}

// ---- Generate all -----------------------------------------------------------

function GenerateAll({
  book,
  pages,
  disabled,
  onDone,
}: {
  book: Book
  pages: Page[]
  disabled: boolean
  onDone: () => void
}) {
  const [running, setRunning] = useState(false)
  const remaining = useMemo(
    () => pages.filter((p) => p.imageStatus !== 'ready'),
    [pages]
  )

  async function run() {
    setRunning(true)
    try {
      for (const page of remaining) {
        await patchPage(page.id, { imageStatus: 'generating' })
        try {
          const freshBook = await db.books.get(book.id)
          const blob = await generatePageImage(
            freshBook?.style ?? book.style,
            page.text
          )
          await patchPage(page.id, {
            image: blob,
            imageStatus: 'ready',
            imageSource: 'ai',
          })
        } catch (e) {
          await patchPage(page.id, { imageStatus: 'error' })
          toast.error(e instanceof Error ? e.message : 'Generation failed')
          break
        }
      }
      onDone()
    } finally {
      setRunning(false)
    }
  }

  if (remaining.length === 0) return null

  return (
    <button
      onClick={run}
      disabled={disabled || running}
      className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50"
    >
      {running ? 'Painting…' : `Illustrate all remaining (${remaining.length})`}
    </button>
  )
}

function Banner({
  tone,
  children,
}: {
  tone: 'warn' | 'muted'
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'mt-4 rounded-xl px-4 py-3 text-sm',
        tone === 'warn'
          ? 'bg-[color:var(--warn)]/12 text-[color:var(--warn)]'
          : 'bg-surface-2 text-muted'
      )}
    >
      {children}
    </div>
  )
}
