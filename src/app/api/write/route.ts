import { NextRequest, NextResponse } from 'next/server'
import { generateText, MissingKeyError, writingAvailable } from '@/lib/ai/text'
import {
  buildWritePrompt,
  isJsonMode,
  systemFor,
  type WriteRequest,
  type WriteMode,
} from '@/lib/ai/writePrompts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MODES: WriteMode[] = [
  'brainstorm',
  'draft',
  'continue',
  'rewrite',
  'review',
]

export interface Idea {
  title: string
  premise: string
  ageRange: string
}

interface ReviewItem {
  area: string
  observation: string
  suggestion: string
}
interface ReviewResult {
  strengths: string[]
  feedback: ReviewItem[]
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
    (body.mode === 'continue' ||
      body.mode === 'rewrite' ||
      body.mode === 'review') &&
    !body.manuscript?.trim()
  ) {
    return NextResponse.json(
      {
        error:
          body.mode === 'review'
            ? 'Add the manuscript you want reviewed first.'
            : 'Write some of the story first.',
      },
      { status: 400 }
    )
  }

  try {
    const raw = await generateText({
      prompt: buildWritePrompt(body),
      system: systemFor(body.mode),
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

    if (body.mode === 'review') {
      try {
        const parsed = JSON.parse(raw)
        const review: ReviewResult = {
          strengths: Array.isArray(parsed?.strengths)
            ? parsed.strengths.filter((s: unknown) => typeof s === 'string')
            : [],
          feedback: Array.isArray(parsed?.feedback)
            ? parsed.feedback.filter(
                (f: unknown): f is ReviewItem =>
                  !!f &&
                  typeof (f as ReviewItem).suggestion === 'string'
              )
            : [],
        }
        return NextResponse.json({ review })
      } catch {
        // If the model didn't return clean JSON, hand back the raw feedback.
        return NextResponse.json({ text: raw.trim() })
      }
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
