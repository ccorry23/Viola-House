'use client'

import { use } from 'react'
import { BookWorkspace } from '@/components/book/BookWorkspace'

export default function BookPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return <BookWorkspace bookId={id} />
}
