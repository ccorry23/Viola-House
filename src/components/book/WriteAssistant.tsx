'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  callWrite,
  checkWritingAvailability,
  WriteError,
  type Idea,
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

  useEffect(() => {
    checkWritingAvailability().then(setAvailable)
  }, [])

  const canRun =
    available === true &&
    online &&
    !loading &&
    (mode !== 'continue' && mode !== 'rewrite' ? true : manuscript.trim().length > 0)

  async function run(override?: Partial<WritePayload>) {
    setLoading(true)
    setText(null)
    setIdeas(null)
    try {
      const payload: WritePayload = {
        mode,
        theme,
        premise,
        instruction,
        manuscript,
        ...override,
      }
      const res = await callWrite(payload)
      if (res.ideas && res.ideas.length) setIdeas(res.ideas)
      else if (res.text) setText(res.text)
      else toast('No suggestion came back — try again.')
    } catch (e) {
      if (e instanceof WriteError && e.code === 'no_key') setAvailable(false)
      toast.error(e instanceof Error ? e.message : 'Could not generate')
    } finally {
      setLoading(false)
    }
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
        <p className="mt-2 rounded-lg bg-[color:var(--warn)]/12 px-3 py-2 text-xs text-[color:var(--warn)]">
          Add <code>GEMINI_API_KEY</code> to turn on the writing helper. Your own
          writing works with or without it.
        </p>
      )}
      {available !== false && !online && (
        <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          The helper needs a connection. You can keep writing offline.
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
                : 'Rewrite the story'}
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
