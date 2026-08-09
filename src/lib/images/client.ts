'use client'

import type { StyleLock } from '@/lib/types'

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function base64ToBlob(b64: string, mime = 'image/png'): Blob {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function stylePayload(style: StyleLock) {
  return {
    descriptor: style.descriptor,
    palette: style.palette,
    characters: style.characters,
  }
}

export interface AvailabilityInfo {
  available: boolean
  provider: string
}

export async function checkImageAvailability(): Promise<AvailabilityInfo> {
  try {
    const res = await fetch('/api/illustrate', { method: 'GET' })
    if (!res.ok) return { available: false, provider: 'unknown' }
    return await res.json()
  } catch {
    return { available: false, provider: 'unknown' }
  }
}

class IllustrateError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

async function callIllustrate(payload: unknown): Promise<Blob> {
  const res = await fetch('/api/illustrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new IllustrateError(
      data.error || 'Image generation failed',
      data.code
    )
  }
  return base64ToBlob(data.imageB64)
}

/** Generate the one-time character reference sheet. */
export async function generateReferenceSheet(style: StyleLock): Promise<Blob> {
  return callIllustrate({ mode: 'reference', style: stylePayload(style) })
}

/** Generate one page illustration, conditioned on the reference sheet. */
export async function generatePageImage(
  style: StyleLock,
  pageText: string
): Promise<Blob> {
  const referenceImageB64 = style.characterSheet
    ? await blobToBase64(style.characterSheet)
    : undefined
  return callIllustrate({
    mode: 'page',
    style: stylePayload(style),
    pageText,
    referenceImageB64,
  })
}

export { IllustrateError }
