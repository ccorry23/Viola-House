import { NextRequest, NextResponse } from 'next/server'
import {
  getImageProvider,
  MissingKeyError,
  type ReferenceImage,
} from '@/lib/images/provider'
import {
  buildPagePrompt,
  buildReferencePrompt,
  buildRefinePrompt,
  buildCharacterPrompt,
} from '@/lib/images/prompt'
import { normalizeToPng } from '@/lib/images/process'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** A recurring character reference sent along with a page. */
interface CastRef {
  name: string
  imageB64: string
}

interface Body {
  mode: 'page' | 'reference' | 'refine' | 'character'
  style: { descriptor: string; palette: string; characters: string }
  pageText?: string
  /** Cover reference (base64 PNG, no data: prefix). */
  referenceImageB64?: string
  /** For 'page': recurring-character references matched alongside the cover. */
  cast?: CastRef[]
  /** For 'refine': the current image to edit (base64, no data: prefix). */
  baseImageB64?: string
  /** For 'refine': the change the author asked for. */
  instruction?: string
  /** For 'character': the character being drawn. */
  characterName?: string
  characterDescription?: string
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

  if (
    body.mode !== 'page' &&
    body.mode !== 'reference' &&
    body.mode !== 'refine' &&
    body.mode !== 'character'
  ) {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  }
  if (body.mode === 'page' && !body.pageText?.trim()) {
    return NextResponse.json({ error: 'pageText required' }, { status: 400 })
  }
  if (body.mode === 'refine' && (!body.baseImageB64 || !body.instruction?.trim())) {
    return NextResponse.json(
      { error: 'baseImageB64 and instruction are required to refine' },
      { status: 400 }
    )
  }
  if (body.mode === 'character' && !body.characterName?.trim()) {
    return NextResponse.json(
      { error: 'characterName is required' },
      { status: 400 }
    )
  }

  // Named character references that came with a page (used in the prompt so the
  // model can tie each image to a name).
  const cast = (body.cast ?? []).filter(
    (c) => c?.name?.trim() && c?.imageB64
  )

  const prompt =
    body.mode === 'reference'
      ? buildReferencePrompt(body.style)
      : body.mode === 'refine'
        ? buildRefinePrompt(body.style, body.instruction!)
        : body.mode === 'character'
          ? buildCharacterPrompt(
              body.style,
              body.characterName!,
              body.characterDescription ?? ''
            )
          : buildPagePrompt(
              body.style,
              body.pageText!,
              cast.map((c) => c.name)
            )

  // Assemble the reference images per mode. The cover always goes first so the
  // prompt's "FIRST image is the cover" instruction holds.
  const referenceImages: ReferenceImage[] = []
  if (body.mode === 'page') {
    if (body.referenceImageB64) referenceImages.push({ b64: body.referenceImageB64 })
    for (const c of cast) referenceImages.push({ b64: c.imageB64 })
  } else if (body.mode === 'refine') {
    if (body.baseImageB64) referenceImages.push({ b64: body.baseImageB64 })
  } else if (body.mode === 'character') {
    if (body.referenceImageB64) referenceImages.push({ b64: body.referenceImageB64 })
  }

  try {
    const provider = await getImageProvider()
    const raw = await provider.generate({ prompt, referenceImages })
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
