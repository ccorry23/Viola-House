'use client'

import type { WriteMode } from './writePrompts'

export interface Idea {
  title: string
  premise: string
  ageRange: string
}

export interface ReviewItem {
  area: string
  observation: string
  suggestion: string
}

export interface ReviewResult {
  strengths: string[]
  feedback: ReviewItem[]
}

export interface KeywordItem {
  keyword: string
  why: string
}

export interface WriteResult {
  text?: string
  ideas?: Idea[]
  review?: ReviewResult
  /** For 'subtitle': the generated list of options. */
  items?: string[]
  /** For 'keywords': strategic keyword phrases with a targeting note each. */
  keywords?: KeywordItem[]
}

export interface WritePayload {
  mode: WriteMode
  theme?: string
  premise?: string
  manuscript?: string
  instruction?: string
  title?: string
  author?: string
}

export class WriteError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

export async function checkWritingAvailability(): Promise<boolean> {
  try {
    const res = await fetch('/api/write')
    if (!res.ok) return false
    const data = await res.json()
    return Boolean(data.available)
  } catch {
    return false
  }
}

export async function callWrite(payload: WritePayload): Promise<WriteResult> {
  const res = await fetch('/api/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new WriteError(data.error || 'Generation failed', data.code)
  return data
}
