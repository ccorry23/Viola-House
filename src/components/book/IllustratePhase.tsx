'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import toast from 'react-hot-toast'
import {
  db,
  getPages,
  patchPage,
  patchBook,
  setPageImageWithHistory,
  undoPageImage,
  setBookCoverWithHistory,
  undoBookCover,
  addCastMember,
  patchCastMember,
  removeCastMember,
  setCastMemberImage,
  undoCastMemberImage,
} from '@/lib/db/dexie'
import {
  checkImageAvailability,
  generatePageImage,
  generateReferenceSheet,
  generateCharacterImage,
  refineImage,
  IllustrateError,
} from '@/lib/images/client'
import { useOnline } from '@/lib/hooks/useOnline'
import { useBlobUrl } from '@/lib/hooks/useBlobUrl'
import { TRIM_SIZES } from '@/lib/kdp/constants'
import type { Book, CastMember, Page, StyleLock } from '@/lib/types'
import { cn } from '@/lib/cn'

export function IllustratePhase({
  book,
  onGoToPages,
  onGoToPublish,
}: {
  book: Book
  onGoToPages: () => void
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

  const hasPages = pages.length > 0
  const readyCount = pages.filter((p) => p.imageStatus === 'ready').length
  const allDone = hasPages && readyCount === pages.length

  return (
    <div className="mx-auto max-w-4xl">
      <CoverPanel book={book} available={available} />

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

      <CastPanel book={book} canGenerate={canGenerate} />

      {!hasPages ? (
        <NoPagesYet onGoToPages={onGoToPages} />
      ) : (
        <>
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
        </>
      )}

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

// ---- Empty state: no pages yet ---------------------------------------------

// If the story hasn't been split into pages yet, the Illustrate step has
// nothing to show. Rather than a confusing blank area, point the way back to
// the Pages step so the flow never dead-ends.
function NoPagesYet({ onGoToPages }: { onGoToPages: () => void }) {
  return (
    <div className="mt-8 rounded-2xl border border-border bg-surface p-6 text-center">
      <div className="text-4xl" aria-hidden>
        📄
      </div>
      <h2 className="mt-3 font-display text-xl font-semibold">
        Step 2 · Your pages
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Your story hasn’t been split into pages yet. Head to the{' '}
        <strong>Pages</strong> step to divide your writing into book pages —
        then come back here and each page will be ready to illustrate.
      </p>
      <button
        onClick={onGoToPages}
        className="mt-5 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg"
      >
        Go to Pages →
      </button>
    </div>
  )
}

// ---- Cast: recurring character references -----------------------------------

/**
 * Optional. Reference pictures for characters who recur across pages but may
 * not be on the cover. Each reference is fed into every page generation so the
 * character stays consistent throughout the book.
 */
function CastPanel({
  book,
  canGenerate,
}: {
  book: Book
  canGenerate: boolean
}) {
  const cast = book.cast ?? []
  const [open, setOpen] = useState(cast.length > 0)

  async function add() {
    await addCastMember(book.id)
    setOpen(true)
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="font-display text-base font-semibold">
            Your characters{' '}
            <span className="text-sm font-normal text-muted">(optional)</span>
          </span>
          <span className="mt-0.5 block text-sm text-muted">
            Add a picture for any character who shows up on several pages —
            especially if they’re not on the cover. The AI will match them on
            every page.
          </span>
        </span>
        <span className="shrink-0 text-sm text-muted">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4">
          {cast.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {cast.map((member) => (
                <CastCard
                  key={member.id}
                  book={book}
                  member={member}
                  canGenerate={canGenerate}
                />
              ))}
            </div>
          )}
          <button
            onClick={add}
            className="mt-3 rounded-xl border border-border px-3.5 py-2 text-sm font-semibold hover:bg-surface-2"
          >
            + Add a character
          </button>
        </div>
      )}
    </div>
  )
}

function CastCard({
  book,
  member,
  canGenerate,
}: {
  book: Book
  member: CastMember
  canGenerate: boolean
}) {
  const [name, setName] = useState(member.name)
  const [description, setDescription] = useState(member.description ?? '')
  const [busy, setBusy] = useState(false)
  const url = useBlobUrl(member.image)

  const hasImage = Boolean(member.image)
  const canUndo = (member.imageHistory?.length ?? 0) > 0
  const canMakeArt = canGenerate && Boolean(name.trim())

  function handleError(e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Could not generate')
  }

  async function generate() {
    if (!name.trim()) return
    setBusy(true)
    try {
      // Persist the latest name/description first so generation uses them.
      await patchCastMember(book.id, member.id, {
        name: name.trim(),
        description: description.trim(),
      })
      const freshBook = await db.books.get(book.id)
      const blob = await generateCharacterImage(
        freshBook?.style ?? book.style,
        name.trim(),
        description.trim()
      )
      await setCastMemberImage(book.id, member.id, blob)
      toast.success(`${name.trim() || 'Character'} ready`)
    } catch (e) {
      handleError(e)
    } finally {
      setBusy(false)
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    await setCastMemberImage(book.id, member.id, file)
    toast.success('Character picture added')
  }

  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex gap-3">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={name || 'Character'} className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl opacity-40" aria-hidden>
              🧑‍🎨
            </span>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-semibold text-white">
              Painting…
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => patchCastMember(book.id, member.id, { name: name.trim() })}
            placeholder="Character name"
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-accent"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() =>
              patchCastMember(book.id, member.id, {
                description: description.trim(),
              })
            }
            placeholder="e.g. round brown bear, red cap, yellow scarf"
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          onClick={generate}
          disabled={!canMakeArt || busy}
          title={
            !canGenerate
              ? 'Turn on AI illustration to draw this character'
              : !name.trim()
                ? 'Give the character a name first'
                : 'Draw this character in your book’s style'
          }
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg disabled:opacity-50"
        >
          {busy ? 'Painting…' : hasImage ? 'Regenerate' : 'Generate'}
        </button>
        <label className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-2">
          ↑ Upload
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              upload(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
        {canUndo && (
          <button
            onClick={() => undoCastMemberImage(book.id, member.id)}
            disabled={busy}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-2 disabled:opacity-50"
          >
            ↩ Undo
          </button>
        )}
        <button
          onClick={() => removeCastMember(book.id, member.id)}
          disabled={busy}
          className="ml-auto rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:bg-surface-2 disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </div>
  )
}

// ---- Style panel ------------------------------------------------------------

function CoverPanel({
  book,
  available,
}: {
  book: Book
  available: boolean | null
}) {
  const online = useOnline()
  const [descriptor, setDescriptor] = useState(book.style.descriptor)
  const [palette, setPalette] = useState(book.style.palette)
  const [characters, setCharacters] = useState(book.style.characters)
  const [busy, setBusy] = useState(false)
  const [collapsed, setCollapsed] = useState(book.style.locked)

  // Like the page cards: a candidate is a freshly made cover awaiting yes/no,
  // held in state so the saved cover is untouched until she accepts.
  const [candidate, setCandidate] = useState<Blob | null>(null)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [instruction, setInstruction] = useState('')

  const sheetUrl = useBlobUrl(book.style.characterSheet)
  const candidateUrl = useBlobUrl(candidate)

  const hasCover = Boolean(book.style.characterSheet)
  const canUndo = (book.style.coverHistory?.length ?? 0) > 0
  const aiReady = available === true && online

  // Merge against fresh DB state so a text-field save never clobbers a cover
  // that was just written (accept / undo / upload).
  async function saveStyle(patch: Partial<StyleLock>) {
    await db.transaction('rw', db.books, async () => {
      const b = await db.books.get(book.id)
      if (!b) return
      await db.books.put({
        ...b,
        style: { ...b.style, ...patch },
        updatedAt: Date.now(),
      })
    })
  }

  function handleError(e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Could not generate')
  }

  // First cover (nothing to preserve): write it straight in.
  async function generateInitialCover() {
    setBusy(true)
    try {
      await saveStyle({ descriptor, palette, characters })
      const blob = await generateReferenceSheet({
        ...book.style,
        descriptor,
        palette,
        characters,
      })
      await saveStyle({ characterSheet: blob })
      toast.success('Cover ready')
    } catch (e) {
      handleError(e)
    } finally {
      setBusy(false)
    }
  }

  // Start over: a brand-new cover from the description, held for review.
  async function startOver() {
    setSuggestOpen(false)
    setBusy(true)
    try {
      await saveStyle({ descriptor, palette, characters })
      const blob = await generateReferenceSheet({
        ...book.style,
        descriptor,
        palette,
        characters,
      })
      setCandidate(blob)
    } catch (e) {
      handleError(e)
    } finally {
      setBusy(false)
    }
  }

  // Suggest a change: keep the current cover, apply one tweak, held for review.
  async function applySuggestion() {
    if (!instruction.trim() || !book.style.characterSheet) return
    setBusy(true)
    try {
      const blob = await refineImage(
        book.style,
        book.style.characterSheet,
        instruction.trim()
      )
      setCandidate(blob)
    } catch (e) {
      handleError(e)
    } finally {
      setBusy(false)
    }
  }

  async function acceptCandidate() {
    if (!candidate) return
    await setBookCoverWithHistory(book.id, candidate)
    setCandidate(null)
    setInstruction('')
    setSuggestOpen(false)
    toast.success('Cover updated')
  }

  function keepCurrent() {
    setCandidate(null)
    toast('Kept your current cover')
  }

  async function undo() {
    await undoBookCover(book.id)
    toast('Went back to the previous cover')
  }

  async function uploadReference(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    await setBookCoverWithHistory(book.id, file)
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

  const thumb = (
    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-2">
      {sheetUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sheetUrl} alt="Cover" className="h-full w-full object-cover" />
      ) : (
        <span className="text-3xl opacity-40" aria-hidden>
          🖼️
        </span>
      )}
      {busy && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-semibold text-white">
          Painting…
        </div>
      )}
    </div>
  )

  const uploadLabel = (
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
  )

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-display text-lg font-semibold">
        Step 1 · Create your cover
      </h2>
      <p className="mt-1 text-sm text-muted">
        Start with one image — your cover. Describe the look and generate it.
        Once you have a cover you can suggest a change or start over until it
        feels right. This cover sets the style the AI matches on every page.
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

      {candidate ? (
        // Review: compare the new cover against the current one.
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold">
            Do you like this new cover?
          </p>
          <div className="grid max-w-md grid-cols-2 gap-3">
            <figure>
              <div className="aspect-square w-full overflow-hidden rounded-xl border border-border bg-surface-2">
                {sheetUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sheetUrl} alt="Current cover" className="h-full w-full object-cover" />
                )}
              </div>
              <figcaption className="mt-1 text-center text-xs text-muted">
                Now
              </figcaption>
            </figure>
            <figure>
              <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-accent bg-surface-2">
                {candidateUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={candidateUrl} alt="New cover" className="h-full w-full object-cover" />
                )}
                <span className="absolute left-1.5 top-1.5 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-fg">
                  New
                </span>
              </div>
              <figcaption className="mt-1 text-center text-xs text-muted">
                New
              </figcaption>
            </figure>
          </div>
          <div className="mt-3 flex max-w-md gap-2">
            <button
              onClick={acceptCandidate}
              className="flex-1 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-fg"
            >
              ✓ Use the new one
            </button>
            <button
              onClick={keepCurrent}
              className="flex-1 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-2"
            >
              Keep the old one
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-start gap-4">
          <div className="flex items-start gap-3">
            {thumb}
            <div className="flex min-w-[12rem] flex-col gap-2">
              {!hasCover ? (
                <>
                  <button
                    onClick={generateInitialCover}
                    disabled={busy || !aiReady || !descriptor.trim()}
                    title={
                      aiReady
                        ? undefined
                        : 'Turn on AI illustration, or upload your own cover'
                    }
                    className="rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50"
                  >
                    {busy ? 'Painting…' : 'Generate cover'}
                  </button>
                  {uploadLabel}
                </>
              ) : suggestOpen ? (
                <div className="min-w-[16rem]">
                  <label className="mb-1 block text-xs font-semibold text-muted">
                    What would you like changed?
                  </label>
                  <input
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && instruction.trim() && !busy) {
                        applySuggestion()
                      }
                    }}
                    autoFocus
                    placeholder="e.g. add a moon, or make the title area calmer"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={applySuggestion}
                      disabled={!aiReady || busy || !instruction.trim()}
                      className="flex-1 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50"
                    >
                      {busy ? 'Painting…' : 'Make this change'}
                    </button>
                    <button
                      onClick={() => {
                        setSuggestOpen(false)
                        setInstruction('')
                      }}
                      disabled={busy}
                      className="rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSuggestOpen(true)}
                    disabled={!aiReady || busy}
                    title={
                      aiReady
                        ? 'Keep this cover but change something about it'
                        : 'Turn on AI illustration to change this cover'
                    }
                    className="rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50"
                  >
                    ✏️ Suggest a change
                  </button>
                  <button
                    onClick={startOver}
                    disabled={!aiReady || busy || !descriptor.trim()}
                    title="Make a completely new cover"
                    className="rounded-xl border border-border px-3.5 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
                  >
                    🔄 Start over
                  </button>
                  {uploadLabel}
                  {canUndo && (
                    <button
                      onClick={undo}
                      disabled={busy}
                      title="Go back to the previous cover"
                      className="rounded-xl border border-border px-3.5 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
                    >
                      ↩ Undo
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              saveStyle({ descriptor, palette, characters, locked: true })
              setCollapsed(true)
            }}
            disabled={!hasCover}
            title={
              hasCover
                ? 'Use this cover and move on to your pages'
                : 'Generate or upload a cover first'
            }
            className="ml-auto rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50"
          >
            Use this cover →
          </button>
        </div>
      )}

      {hasCover ? (
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

  // A candidate is a freshly generated/tweaked image awaiting the author's
  // yes/no. It lives only in local state — the saved image is never touched
  // until she accepts, so a bad change can't destroy a picture she liked.
  const [candidate, setCandidate] = useState<Blob | null>(null)
  const candidateUrl = useBlobUrl(candidate)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)

  const generatingInitial = page.imageStatus === 'generating'
  const hasImage = page.imageStatus === 'ready' && Boolean(page.image)
  const canUndo = (page.imageHistory?.length ?? 0) > 0
  const working = busy || generatingInitial

  function handleError(e: unknown) {
    if (e instanceof IllustrateError && e.code === 'no_key') onNoKey()
    toast.error(e instanceof Error ? e.message : 'Generation failed')
  }

  // First image for a page (nothing to preserve): write it straight in.
  async function generateInitial() {
    await patchPage(page.id, { imageStatus: 'generating' })
    try {
      const freshBook = await db.books.get(book.id)
      const blob = await generatePageImage(
        freshBook?.style ?? book.style,
        page.text,
        freshBook?.cast ?? book.cast ?? []
      )
      await patchPage(page.id, {
        image: blob,
        imageStatus: 'ready',
        imageSource: 'ai',
      })
    } catch (e) {
      await patchPage(page.id, { imageStatus: 'error' })
      handleError(e)
    }
  }

  // Start over: a brand-new image from scratch, held for review.
  async function startOver() {
    setSuggestOpen(false)
    setBusy(true)
    try {
      const freshBook = await db.books.get(book.id)
      const blob = await generatePageImage(
        freshBook?.style ?? book.style,
        page.text,
        freshBook?.cast ?? book.cast ?? []
      )
      setCandidate(blob)
    } catch (e) {
      handleError(e)
    } finally {
      setBusy(false)
    }
  }

  // Suggest a change: keep the current picture, apply one tweak, held for review.
  async function applySuggestion() {
    if (!instruction.trim() || !page.image) return
    setBusy(true)
    try {
      const freshBook = await db.books.get(book.id)
      const blob = await refineImage(
        freshBook?.style ?? book.style,
        page.image,
        instruction.trim()
      )
      setCandidate(blob)
    } catch (e) {
      handleError(e)
    } finally {
      setBusy(false)
    }
  }

  async function acceptCandidate() {
    if (!candidate) return
    await setPageImageWithHistory(page.id, candidate, 'ai')
    setCandidate(null)
    setInstruction('')
    setSuggestOpen(false)
    toast.success(`Page ${page.index + 1} updated`)
  }

  function keepCurrent() {
    setCandidate(null)
    toast('Kept your current picture')
  }

  async function undo() {
    await undoPageImage(page.id)
    toast('Went back to the previous picture')
  }

  async function uploadImage(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    await setPageImageWithHistory(page.id, file, 'upload')
    toast.success(`Page ${page.index + 1} illustration added`)
  }

  // ---- Review view: compare the new picture against the current one --------
  if (candidate) {
    return (
      <div className="overflow-hidden rounded-2xl border border-accent bg-surface">
        <div className="border-b border-border bg-surface-2 px-3 py-2 text-sm font-semibold">
          Page {page.index + 1} · Do you like this new one?
        </div>
        <div className="grid grid-cols-2 gap-px bg-border">
          <figure className="bg-surface">
            <div
              className="relative w-full bg-surface-2"
              style={{ aspectRatio: String(aspect) }}
            >
              {url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="Current" className="h-full w-full object-cover" />
              )}
            </div>
            <figcaption className="px-2 py-1 text-center text-xs text-muted">
              Now
            </figcaption>
          </figure>
          <figure className="bg-surface">
            <div
              className="relative w-full bg-surface-2"
              style={{ aspectRatio: String(aspect) }}
            >
              {candidateUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={candidateUrl} alt="New" className="h-full w-full object-cover" />
              )}
              <span className="absolute left-1.5 top-1.5 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-fg">
                New
              </span>
            </div>
            <figcaption className="px-2 py-1 text-center text-xs text-muted">
              New
            </figcaption>
          </figure>
        </div>
        <div className="flex gap-2 p-3">
          <button
            onClick={acceptCandidate}
            className="flex-1 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-fg"
          >
            ✓ Use the new one
          </button>
          <button
            onClick={keepCurrent}
            className="flex-1 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-2"
          >
            Keep the old one
          </button>
        </div>
      </div>
    )
  }

  // ---- Normal view ---------------------------------------------------------
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
        {working && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-semibold text-white">
            Painting…
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-semibold text-white">
          Page {page.index + 1}
        </span>
        {hasImage && page.imageSource && (
          <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-semibold text-white">
            {page.imageSource === 'upload' ? '🖐 Yours' : '🎨 AI'}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-sm text-muted">{page.text}</p>

        {hasImage ? (
          suggestOpen ? (
            // Suggestion box: type a change, apply it.
            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold text-muted">
                What would you like changed?
              </label>
              <input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && instruction.trim() && !working) {
                    applySuggestion()
                  }
                }}
                autoFocus
                placeholder="e.g. give her a red coat, or make it nighttime"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={applySuggestion}
                  disabled={!canGenerate || working || !instruction.trim()}
                  className="flex-1 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50"
                >
                  {working ? 'Painting…' : 'Make this change'}
                </button>
                <button
                  onClick={() => {
                    setSuggestOpen(false)
                    setInstruction('')
                  }}
                  disabled={working}
                  className="rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // Keep / suggest a change / start over / undo.
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setSuggestOpen(true)}
                disabled={!canGenerate || working}
                title={
                  canGenerate
                    ? 'Keep this picture but change something about it'
                    : 'Turn on AI illustration to change this picture'
                }
                className="flex-1 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50"
              >
                ✏️ Suggest a change
              </button>
              <button
                onClick={startOver}
                disabled={!canGenerate || working}
                title="Make a completely new picture for this page"
                className="rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
              >
                🔄 Start over
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
              {canUndo && (
                <button
                  onClick={undo}
                  disabled={working}
                  title="Go back to the previous picture"
                  className="rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
                >
                  ↩ Undo
                </button>
              )}
            </div>
          )
        ) : (
          // No image yet: generate or upload.
          <div className="mt-3 flex gap-2">
            <button
              onClick={generateInitial}
              disabled={!canGenerate || working}
              className="flex-1 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50"
            >
              {working
                ? 'Painting…'
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
        )}
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
            page.text,
            freshBook?.cast ?? book.cast ?? []
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
