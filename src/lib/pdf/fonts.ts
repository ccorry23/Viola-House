'use client'

import { bodyFontDef, type BodyFontId } from './bodyFonts'

/**
 * Loads the TTFs we embed into exported PDFs (KDP requires embedded fonts).
 * Fetched from /fonts and memoized; the service worker caches them so export
 * works offline after the first run.
 *
 * The display font (titles / cover / spine) is always Fraunces. The body
 * (story-text) font is the author's choice from the curated set in
 * `bodyFonts.ts`; each file is fetched once and cached by URL.
 */
const DISPLAY_URL = '/fonts/Fraunces.ttf'

const fontCache = new Map<string, Promise<ArrayBuffer>>()

function loadFont(url: string, label: string): Promise<ArrayBuffer> {
  let p = fontCache.get(url)
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Could not load ${label}`)
      return r.arrayBuffer()
    })
    // Don't cache a rejected fetch — allow a later retry.
    p.catch(() => fontCache.delete(url))
    fontCache.set(url, p)
  }
  return p
}

export async function loadPdfFonts(bodyFont?: BodyFontId) {
  const bodyUrl = bodyFontDef(bodyFont).file
  const [display, body] = await Promise.all([
    loadFont(DISPLAY_URL, 'display font'),
    loadFont(bodyUrl, 'body font'),
  ])
  return { display, body }
}
