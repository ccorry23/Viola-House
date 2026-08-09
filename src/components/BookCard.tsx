'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'
import { TRIM_SIZES } from '@/lib/kdp/constants'
import type { Book } from '@/lib/types'
import { StatusBadge } from './StatusBadge'

/** Deterministic warm cover tint from the title, for books with no art yet. */
function tintFor(title: string): string {
  const hues = [8, 28, 92, 200, 265, 330]
  let h = 0
  for (let i = 0; i < title.length; i++) h = (h + title.charCodeAt(i)) % hues.length
  return `hsl(${hues[h]} 45% 82%)`
}

export function BookCard({ book }: { book: Book }) {
  const trim = TRIM_SIZES[book.trimSize]
  const aspect = trim.w / trim.h

  // Cover art = the first page's image, if it exists.
  const coverBlob = useLiveQuery(async () => {
    const first = await db.pages
      .where('[bookId+index]')
      .equals([book.id, 0])
      .first()
    return first?.image ?? null
  }, [book.id])

  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!coverBlob) {
      setCoverUrl(null)
      return
    }
    const url = URL.createObjectURL(coverBlob)
    setCoverUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [coverBlob])

  return (
    <Link href={`/book/${book.id}`} className="group block">
      <div
        className="relative overflow-hidden rounded-2xl border border-border shadow-sm transition group-hover:-translate-y-1 group-hover:shadow-md"
        style={{ aspectRatio: String(aspect) }}
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={book.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center p-5 text-center"
            style={{ background: tintFor(book.title) }}
          >
            <span className="font-display text-lg font-semibold text-[#2b2118]">
              {book.title}
            </span>
          </div>
        )}
        <div className="absolute left-2 top-2">
          <StatusBadge status={book.status} />
        </div>
      </div>
      <div className="mt-2 px-0.5">
        <p className="truncate font-display text-base font-semibold">
          {book.title}
        </p>
        <p className="text-xs text-muted">{trim.label}</p>
      </div>
    </Link>
  )
}
