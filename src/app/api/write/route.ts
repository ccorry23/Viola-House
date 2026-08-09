import { NextRequest, NextResponse } from 'next/server'
import { generateText, MissingKeyError, writingAvailable } from '@/lib/ai/text'
import {
  buildWritePrompt,
  isJsonMode,
  WRITER_SYSTEM,
  type WriteRequest,
  type WriteMode,
} from '@/lib/ai/writePrompts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MODES: WriteMode[] = ['brainstorm', 'draft', 'continue', 'rewrite']

export interface Idea {
  title: string
  premise: string
  ageRange: string
}

export async function POST(req: NextRequest) {
  let body: WriteRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  if (!MODES.includes(body.mode)) {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  }
  if (
    (body.mode === 'continue' || body.mode === 'rewrite') &&
    !body.manuscript?.trim()
  ) {
    return NextResponse.json(
      { error: 'Write some of the story first.' },
      { status: 400 }
    )
  }

  try {
    const raw = await generateText({
      prompt: buildWritePrompt(body),
      system: WRITER_SYSTEM,
      json: isJsonMode(body.mode),
    })

    if (body.mode === 'brainstorm') {
      let ideas: Idea[] = []
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) ideas = parsed
      } catch {
        // Fall back to returning the raw text if the model didn't give JSON.
        return NextResponse.json({ ideas: [], text: raw })
      }
      return NextResponse.json({ ideas })
    }

    return NextResponse.json({ text: raw.trim() })
  } catch (err) {
    if (err instanceof MissingKeyError) {
      return NextResponse.json(
        {
          error:
            'The writing helper needs an API key. Add GEMINI_API_KEY to enable it.',
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

export async function GET() {
  return NextResponse.json(writingAvailable())
}
