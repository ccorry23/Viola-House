'use client'

/**
 * Home-page hero for Viola House. Rebuilt from the approved Claude Design
 * mockup, themed with the app's tokens (viola-violet accent). The flower is a
 * recreated inline-SVG mark standing in for a final logo image.
 */
export function Hero({ onStartNew }: { onStartNew: () => void }) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Soft decorative florals — gentle, right side, desktop only. */}
      <DecorFlorals />

      <div className="relative mx-auto grid w-full max-w-5xl items-center gap-8 px-5 py-14 sm:px-8 sm:py-20 md:grid-cols-[1.15fr_0.85fr]">
        <div>
          <ViolaBadge />

          <span className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
            <span aria-hidden>📚</span> Picture-book studio
          </span>

          <h1 className="mt-4 font-display text-5xl font-bold leading-[1.03] tracking-tight text-foreground sm:text-6xl">
            Turn your stories into real picture books.
          </h1>

          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
            Write the story, illustrate every page, and export print-ready files
            for Amazon KDP — all in one cozy place.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={onStartNew}
              className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-fg shadow-sm transition hover:brightness-105"
            >
              Start a new book
            </button>
            <a
              href="#library"
              className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-2"
            >
              Open my library
            </a>
          </div>
        </div>

        {/* Right: a large, soft flower motif on desktop. */}
        <div className="hidden justify-self-center md:block">
          <ViolaFlower className="h-56 w-56 opacity-90 drop-shadow-sm" />
        </div>
      </div>
    </section>
  )
}

function ViolaBadge() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface shadow-sm">
        <ViolaFlower className="h-10 w-10" />
      </span>
      <span className="font-display text-xl font-semibold text-foreground">
        Viola House
      </span>
    </div>
  )
}

/** A stylized viola/pansy: violet petals with a gold heart. */
function ViolaFlower({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden role="img">
      {/* upper back petals */}
      <ellipse cx="33" cy="37" rx="19" ry="23" fill="#9a7ab5" />
      <ellipse cx="67" cy="37" rx="19" ry="23" fill="#9a7ab5" />
      {/* side petals */}
      <ellipse cx="27" cy="58" rx="19" ry="21" fill="var(--accent)" />
      <ellipse cx="73" cy="58" rx="19" ry="21" fill="var(--accent)" />
      {/* front lower petal */}
      <ellipse cx="50" cy="64" rx="21" ry="19" fill="#664785" />
      {/* heart */}
      <circle cx="50" cy="50" r="8.5" fill="var(--gold)" />
    </svg>
  )
}

function DecorFlorals() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 md:block"
    >
      <svg
        viewBox="0 0 400 500"
        className="h-full w-full text-accent"
        preserveAspectRatio="xMidYMid slice"
      >
        <g fill="none" stroke="currentColor" strokeWidth="2" opacity="0.1">
          <path d="M320 40 C300 140 360 240 300 360 C270 430 320 470 300 500" />
          <path d="M320 120 C270 130 240 100 210 110" />
          <path d="M310 210 C360 210 390 180 410 190" />
          <path d="M300 300 C250 300 220 270 190 280" />
        </g>
        <g fill="currentColor" opacity="0.08">
          <circle cx="210" cy="108" r="16" />
          <circle cx="410" cy="188" r="18" />
          <circle cx="190" cy="278" r="14" />
          <circle cx="300" cy="370" r="20" />
        </g>
      </svg>
    </div>
  )
}
