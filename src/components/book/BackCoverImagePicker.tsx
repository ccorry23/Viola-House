'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { getPages, patchBook } from '@/lib/db/dexie'
import { useBlobUrl } from '@/lib/hooks/useBlobUrl'
import type { Book } from '@/lib/types'

/**
 * Choose an optional back-cover illustration: pick one of the book's existing
 * pictures (cover art or any page), or upload your own. Stored on the book as
 * `backCoverImage`; it fills the printed back cover with the back-cover
 * description layered over it. Lives on the Illustrate tab, under the cover.
 */
export function BackCoverImagePicker({ book }: { book: Book }) {
  const pages = useLiveQuery(() => getPages(book.id), [book.id]) ?? []
  const currentUrl = useBlobUrl(book.backCoverImage)

  const candidates: { key: string; label: string; blob: Blob }[] = []
  if (book.style.characterSheet) {
    candidates.push({ key: 'cover', label: 'Cover', blob: book.style.characterSheet })
  }
  for (const p of [...pages].sort((a, b) => a.index - b.index)) {
    if (p.image) candidates.push({ key: p.id, label: `Page ${p.index + 1}`, blob: p.image })
  }

  return (
    <section className="mt-4 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Back cover picture (optional)</h3>
          <p className="mt-0.5 text-xs text-muted">
            Fills the back of the printed book, with your back cover description
            (Publish tab) layered over it. Pick one of your pictures or upload
            your own.
          </p>
        </div>
        <label className="shrink-0 cursor-pointer rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-2">
          ↑ Upload
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) patchBook(book.id, { backCoverImage: file })
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {book.backCoverImage ? (
        <div className="mt-2 flex items-center gap-3">
          {currentUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentUrl}
              alt="Back cover"
              className="h-20 w-20 rounded-lg border border-border object-cover"
            />
          )}
          <button
            onClick={() => patchBook(book.id, { backCoverImage: undefined })}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
          >
            Remove
          </button>
        </div>
      ) : null}

      {candidates.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {candidates.map((c) => (
            <Thumb
              key={c.key}
              label={c.label}
              blob={c.blob}
              onClick={() => patchBook(book.id, { backCoverImage: c.blob })}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function Thumb({
  label,
  blob,
  onClick,
}: {
  label: string
  blob: Blob
  onClick: () => void
}) {
  const url = useBlobUrl(blob)
  return (
    <button
      onClick={onClick}
      title={`Use ${label}`}
      className="shrink-0 rounded-lg border border-border p-1 hover:border-accent"
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
