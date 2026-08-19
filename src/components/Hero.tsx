'use client'

/**
 * Home-page hero for Viola House, matching the approved Claude Design mockup:
 * left = brand + headline + CTAs, right = a framed "picture book" card resting
 * on a soft violet blob, over faint book/quill/floral line-art. Themed with the
 * app's tokens (viola-violet accent). The card art is a placeholder illustration
 * — swap `HeroCard`'s inner scene for a real image when one is provided.
 */
export function Hero({ onStartNew }: { onStartNew: () => void }) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <BackgroundArt />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-14 sm:px-8 sm:py-20 md:grid-cols-[1.05fr_0.95fr]">
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
              className="rounded-full bg-accent px-6 py-3 text-base font-semibold text-accent-fg shadow-sm transition hover:brightness-105"
            >
              Start a new book
            </button>
            <a
              href="#library"
              className="rounded-full border border-border px-6 py-3 text-base font-semibold text-foreground transition hover:bg-surface-2"
            >
              Open my library
            </a>
          </div>
        </div>

        <HeroCard />
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

/** The framed picture-book card on its soft violet blob. */
function HeroCard() {
  return (
    <div className="relative flex min-h-[320px] items-center justify-center">
      {/* soft violet glow behind the card */}
      <div className="absolute h-[380px] w-[380px] rounded-full bg-accent-soft opacity-80 blur-2xl" />
      <div className="relative w-[300px] max-w-full rotate-2 overflow-hidden rounded-[28px] border border-border bg-surface shadow-2xl sm:w-[340px]">
        {/* Placeholder picture-book page — replace with a real image if desired. */}
        <BookPage />
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-display text-sm font-semibold text-foreground">
            Your next story
          </span>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
            Viola House
          </span>
        </div>
      </div>
    </div>
  )
}

/** A warm illustrated picture-book page (placeholder art). */
function BookPage() {
  return (
    <svg viewBox="0 0 340 300" className="block w-full" role="img" aria-label="A warm hand-illustrated picture-book spread">
      <defs>
        <linearGradient id="vh-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#efe7f6" />
          <stop offset="100%" stopColor="#fbf3e9" />
        </linearGradient>
      </defs>
      <rect width="340" height="300" fill="url(#vh-sky)" />
      {/* sun */}
      <circle cx="270" cy="66" r="30" fill="var(--gold)" opacity="0.9" />
      {/* clouds */}
      <g fill="#ffffff" opacity="0.85">
        <ellipse cx="70" cy="60" rx="34" ry="16" />
        <ellipse cx="100" cy="66" rx="26" ry="14" />
      </g>
      {/* far hills */}
      <path d="M0 210 Q90 160 180 205 T340 200 V300 H0 Z" fill="#c9b6dd" />
      {/* near hills */}
      <path d="M0 250 Q110 205 210 250 T340 245 V300 H0 Z" fill="var(--accent)" opacity="0.9" />
      {/* little tree */}
      <g>
        <rect x="60" y="214" width="7" height="26" rx="3" fill="#7a5a3a" />
        <circle cx="63.5" cy="206" r="18" fill="#6f8f5f" />
      </g>
      {/* tiny house */}
      <g>
        <rect x="240" y="214" width="34" height="26" rx="3" fill="#f6ede0" />
        <path d="M236 214 L257 196 L278 214 Z" fill="#b06a6a" />
        <rect x="252" y="224" width="10" height="16" fill="var(--accent)" />
      </g>
    </svg>
  )
}

/** A stylized viola/pansy: violet petals with a gold heart. */
function ViolaFlower({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden role="img">
      <ellipse cx="33" cy="37" rx="19" ry="23" fill="#9a7ab5" />
      <ellipse cx="67" cy="37" rx="19" ry="23" fill="#9a7ab5" />
      <ellipse cx="27" cy="58" rx="19" ry="21" fill="var(--accent)" />
      <ellipse cx="73" cy="58" rx="19" ry="21" fill="var(--accent)" />
      <ellipse cx="50" cy="64" rx="21" ry="19" fill="#664785" />
      <circle cx="50" cy="50" r="8.5" fill="var(--gold)" />
    </svg>
  )
}

/** Faint decorative line-art behind the hero: open book, quill, floral stems. */
function BackgroundArt() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <svg
        viewBox="0 0 1200 620"
        className="h-full w-full text-accent"
        preserveAspectRatio="xMidYMid slice"
      >
        <g fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.08" strokeLinecap="round">
          {/* open book, bottom center */}
          <path d="M470 540 Q600 500 600 540 Q600 500 730 540 L730 600 Q600 560 470 600 Z" />
          <path d="M600 540 L600 600" />
          <path d="M500 556 Q560 540 590 552 M610 552 Q640 540 700 556" />
          <path d="M500 574 Q560 558 590 570 M610 570 Q640 558 700 574" />
          {/* quill */}
          <path d="M600 500 C650 430 720 400 760 360 C740 420 700 470 630 512" />
          <path d="M665 452 L700 468 M650 478 L688 492" />
          {/* floral stems, right */}
          <path d="M980 60 C960 180 1020 280 970 400" />
          <path d="M980 120 C1030 110 1060 80 1090 90" />
          <path d="M975 220 C930 215 905 190 880 200" />
        </g>
        <g fill="currentColor" opacity="0.06">
          <circle cx="1090" cy="88" r="16" />
          <circle cx="880" cy="198" r="13" />
          <circle cx="150" cy="150" r="120" />
          <circle cx="1080" cy="470" r="90" />
        </g>
      </svg>
    </div>
  )
}
