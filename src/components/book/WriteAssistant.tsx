'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  callWrite,
  checkWritingAvailability,
  WriteError,
  type Idea,
  type ReviewResult,
  type WritePayload,
} from '@/lib/ai/writeClient'
import type { WriteMode } from '@/lib/ai/writePrompts'
import { useOnline } from '@/lib/hooks/useOnline'
import { cn } from '@/lib/cn'

const MODES: { id: WriteMode; label: string; icon: string }[] = [
  { id: 'brainstorm', label: 'Ideas', icon: '💡' },
  { id: 'draft', label: 'Write a draft', icon: '✍️' },
  { id: 'continue', label: 'Continue', icon: '➡️' },
  { id: 'rewrite', label: 'Rewrite', icon: '✨' },
  { id: 'review', label: 'Review & Suggest', icon: '🔎' },
]

const REWRITE_PRESETS = [
  'simpler for very young children',
  'shorter and punchier',
  'gently rhyming',
  'more descriptive and vivid',
]

export function WriteAssistant({
  manuscript,
  onApply,
}: {
  manuscript: string
  onApply: (text: string, how: 'replace' | 'append') => void
}) {
  const online = useOnline()
  const [available, setAvailable] = useState<boolean | null>(null)
  const [mode, setMode] = useState<WriteMode>('brainstorm')
  const [theme, setTheme] = useState('')
  const [premise, setPremise] = useState('')
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [ideas, setIdeas] = useState<Idea[] | null>(null)
  const [review, setReview] = useState<ReviewResult | null>(null)
  // The text to review — starts from the current story, but the author can
  // paste or upload a different manuscript here without touching their draft.
  const [reviewText, setReviewText] = useState('')

  useEffect(() => {
    checkWritingAvailability().then(setAvailable)
  }, [])

  // Seed the review box with the current story the first time review is opened.
  useEffect(() => {
    if (mode === 'review' && !reviewText.trim()) setReviewText(manuscript)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const reviewSource = reviewText.trim() || manuscript.trim()
  const canRun =
    available === true &&
    online &&
    !loading &&
    (mode === 'continue' || mode === 'rewrite'
      ? manuscript.trim().length > 0
      : mode === 'review'
        ? reviewSource.length > 0
        : true)

  async function run(override?: Partial<WritePayload>) {
    setLoading(true)
    setText(null)
    setIdeas(null)
    setReview(null)
    try {
      const payload: WritePayload = {
        mode,
        theme,
        premise,
        instruction,
        manuscript: mode === 'review' ? reviewSource : manuscript,
        ...override,
      }
      const res = await callWrite(payload)
      if (res.ideas && res.ideas.length) setIdeas(res.ideas)
      else if (res.review) setReview(res.review)
      else if (res.text) {
        // For review, never offer to apply text as the story — show it as feedback.
        if (mode === 'review')
          setReview({
            strengths: [],
            feedback: [{ area: 'Feedback', observation: '', suggestion: res.text }],
          })
        else setText(res.text)
      } else toast('No suggestion came back — try again.')
    } catch (e) {
      if (e instanceof WriteError && e.code === 'no_key') setAvailable(false)
      toast.error(e instanceof Error ? e.message : 'Could not generate')
    } finally {
      setLoading(false)
    }
  }

  function onUploadManuscript(file: File | undefined) {
    if (!file) return
    const okType =
      /\.(txt|md|markdown|text)$/i.test(file.name) ||
      file.type.startsWith('text/')
    if (!okType) {
      toast.error('Please choose a plain-text file (.txt or .md).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setReviewText(String(reader.result ?? ''))
    reader.onerror = () => toast.error('Could not read that file')
    reader.readAsText(file)
  }

  function copyReview() {
    if (!review) return
    const lines: string[] = []
    if (review.strengths.length) {
      lines.push('What’s working:')
      review.strengths.forEach((s) => lines.push(`• ${s}`))
      lines.push('')
    }
    review.feedback.forEach((f) => {
      lines.push(f.area ? `${f.area}` : 'Feedback')
      if (f.observation) lines.push(f.observation)
      lines.push(`Suggestion: ${f.suggestion}`)
      lines.push('')
    })
    navigator.clipboard?.writeText(lines.join('\n').trim())
    toast.success('Feedback copied')
  }

  function writeFromIdea(idea: Idea) {
    setMode('draft')
    setPremise(idea.premise)
    run({ mode: 'draft', premise: idea.premise })
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="font-display text-base font-semibold">✨ Writing helper</span>
        <span className="text-xs text-muted">optional — you stay in control</span>
      </div>

      {available === false && (
        <p className="mt-2 rounded-lg bg-[color:var(--warn)]/12 px-3 py-2 text-sm text-[color:var(--warn)]">
          The writing helper isn&apos;t turned on yet — ask whoever set up this
          app to enable it. Your own writing always works, with or without it.
        </p>
      )}
      {available !== false && !online && (
        <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
          The helper needs an internet connection. You can keep writing offline.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setMode(m.id)
              setText(null)
              setIdeas(null)
              setReview(null)
            }}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-semibold transition',
              mode === m.id
                ? 'bg-accent text-accent-fg'
                : 'bg-surface-2 text-muted hover:text-foreground'
            )}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* Mode-specific input */}
      <div className="mt-3">
        {mode === 'brainstorm' && (
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="What should the ideas be about? (optional) e.g. bedtime, sharing, the ocean"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        )}
        {mode === 'draft' && (
          <textarea
            value={premise}
            onChange={(e) => setPremise(e.target.value)}
            rows={2}
            placeholder="Describe your idea (optional). e.g. A shy turtle learns to make a friend at the pond."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        )}
        {mode === 'continue' && (
          <p className="text-sm text-muted">
            Picks up your story where it stops and carries it toward a gentle
            ending.
          </p>
        )}
        {mode === 'rewrite' && (
          <div className="flex flex-wrap gap-1.5">
            {REWRITE_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setInstruction(p)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium',
                  instruction === p
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border text-muted hover:bg-surface-2'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        )}
        {mode === 'review' && (
          <div>
            <p className="mb-1.5 text-sm text-muted">
              Paste or upload the manuscript you want feedback on. It’s filled
              with your current story to start — edits here don’t change your
              draft. You’ll get suggestions to improve what’s written, not a
              rewrite.
            </p>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={6}
              placeholder="Paste your manuscript here…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <div className="mt-1.5 flex items-center gap-3 text-xs text-muted">
              <label className="cursor-pointer rounded-lg border border-border px-2.5 py-1 font-semibold hover:bg-surface-2">
                ↑ Upload a .txt file
                <input
                  type="file"
                  accept=".txt,.md,.markdown,.text,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    onUploadManuscript(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>
              <span>
                {reviewSource
                  ? `${reviewSource.split(/\s+/).length} words to review`
                  : 'No text yet'}
              </span>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => run()}
        disabled={!canRun}
        className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50"
      >
        {loading
          ? 'Thinking…'
          : mode === 'brainstorm'
            ? 'Suggest ideas'
            : mode === 'draft'
              ? 'Write a draft'
              : mode === 'continue'
                ? 'Continue the story'
                : mode === 'rewrite'
                  ? 'Rewrite the story'
                  : 'Review my manuscript'}
      </button>

      {/* Ideas output */}
      {ideas && (
        <div className="mt-4 grid gap-2">
          {ideas.map((idea, i) => (
            <div key={i} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display font-semibold">{idea.title}</p>
                <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
                  Ages {idea.ageRange}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{idea.premise}</p>
              <button
                onClick={() => writeFromIdea(idea)}
                className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-2"
              >
                Write a draft from this →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Review output — feedback only, never applied to the story */}
      {review && (
        <div className="mt-4 space-y-3">
          {review.strengths.length > 0 && (
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-sm font-semibold">✅ What’s working</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
                {review.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {review.feedback.map((f, i) => (
            <div key={i} className="rounded-xl border border-border bg-background p-3">
              <p className="text-sm font-semibold">{f.area || 'Feedback'}</p>
              {f.observation && (
                <p className="mt-1 text-sm text-muted">{f.observation}</p>
              )}
              <p className="mt-1.5 text-sm">
                <span className="font-semibold text-accent">Suggestion: </span>
                {f.suggestion}
              </p>
            </div>
          ))}
          {(review.strengths.length > 0 || review.feedback.length > 0) && (
            <div className="flex gap-2">
              <button
                onClick={copyReview}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
              >
                Copy feedback
              </button>
              <button
                onClick={() => run()}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-muted hover:bg-surface-2"
              >
                Review again
              </button>
            </div>
          )}
        </div>
      )}

      {/* Text output */}
      {text && (
        <div className="mt-4">
          <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-3 font-display text-[15px] leading-relaxed">
            {text}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => {
                onApply(text, 'replace')
                toast.success('Replaced your story')
              }}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg"
            >
              Replace story
            </button>
            <button
              onClick={() => {
                onApply(text, 'append')
                toast.success('Added to your story')
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
            >
              Insert at end
            </button>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(text)
                toast.success('Copied')
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
            >
              Copy
            </button>
            <button
              onClick={() => run()}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-muted hover:bg-surface-2"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
