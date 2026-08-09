import { NextRequest, NextResponse } from 'next/server'
import { getImageProvider, MissingKeyError } from '@/lib/images/provider'
import { buildPagePrompt, buildReferencePrompt } from '@/lib/images/prompt'
import { normalizeToPng } from '@/lib/images/process'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface Body {
  mode: 'page' | 'reference'
  style: { descriptor: string; palette: string; characters: string }
  pageText?: string
  /** Character reference sheet (base64 PNG, no data: prefix). */
  referenceImageB64?: string
}

/**
 * Generate one illustration. Stateless by design: the client sends the style +
 * page text (+ optional reference image) and gets back PNG bytes, which it
 * stores locally in IndexedDB. Keeps the offline-first, no-backend model intact.
 */
export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  if (body.mode !== 'page' && body.mode !== 'reference') {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  }
  if (body.mode === 'page' && !body.pageText?.trim()) {
    return NextResponse.json({ error: 'pageText required' }, { status: 400 })
  }

  const prompt =
    body.mode === 'reference'
      ? buildReferencePrompt(body.style)
      : buildPagePrompt(body.style, body.pageText!)

  try {
    const provider = await getImageProvider()
    const raw = await provider.generate({
      prompt,
      // Reference-sheet generation gets no input image; pages get the sheet.
      referenceImageB64:
        body.mode === 'page' ? body.referenceImageB64 : undefined,
    })
    const png = await normalizeToPng(raw)
    return NextResponse.json({ imageB64: png.toString('base64') })
  } catch (err) {
    if (err instanceof MissingKeyError) {
      return NextResponse.json(
        {
          error:
            'Image generation is not configured. Add your Gemini API key (GEMINI_API_KEY) to enable illustrations.',
          code: 'no_key',
        },
        { status: 501 }
      )
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 }
    )
  }
}

/** Lets the UI tell whether illustration is available without generating. */
export async function GET() {
  const { imageGenerationAvailable } = await import('@/lib/images/provider')
  return NextResponse.json(imageGenerationAvailable())
}
