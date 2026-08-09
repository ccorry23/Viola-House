'use client'

/**
 * Loads the TTFs we embed into exported PDFs (KDP requires embedded fonts).
 * Fetched from /fonts and memoized; the service worker caches them so export
 * works offline after the first run.
 */
let cache: { display: ArrayBuffer; body: ArrayBuffer } | null = null

export async function loadPdfFonts() {
  if (cache) return cache
  const [display, body] = await Promise.all([
    fetch('/fonts/Fraunces.ttf').then((r) => {
      if (!r.ok) throw new Error('Could not load display font')
      return r.arrayBuffer()
    }),
    fetch('/fonts/Nunito.ttf').then((r) => {
      if (!r.ok) throw new Error('Could not load body font')
      return r.arrayBuffer()
    }),
  ])
  cache = { display, body }
  return cache
}
