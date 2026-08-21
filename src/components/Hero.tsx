'use client'

/**
 * Home-page hero for Viola House — ported 1:1 from the approved Claude Design
 * file `viola-house-hero.html` (project 20b8e7bc-8dc6-4040-86ed-4b1ddd876f23).
 * Per that file's handoff guardrails: reproduce faithfully, no invented SVG
 * scenes/mascots, no substituted logo, no extra UI. Uses the app's existing
 * CSS custom properties (globals.css) rather than a second token set — the
 * approved palette is a near-exact match already.
 *
 * Real supplied assets required at /public: hero.jpg, viola-house-logo.png.
 */
export function Hero({ onStartNew }: { onStartNew: () => void }) {
  return (
    <section className="hero-root relative isolate overflow-hidden">
      {/* Faint full-page logo watermark, scoped to the hero (not global body,
          since this app has other pages the standalone design didn't). */}
      <div className="hero-watermark" aria-hidden />

      {/* Brand mark, top-left of the hero — the design's own logo lockup. */}
      <a
        href="/"
        aria-label="Viola House home"
        className="absolute left-4 top-4 z-10 block leading-none sm:left-8 sm:top-8"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/viola-house-logo.png"
          alt="Viola House logo — a violet pansy with a fountain-pen nib stem above an open book"
          className="block h-14 w-auto sm:h-20"
        />
      </a>

      <div className="hero-grid relative mx-auto grid w-full max-w-[1150px] items-center gap-10 px-6 py-14 sm:py-20 md:grid-cols-2 md:gap-16">
        <div className="hero-copy max-w-[34rem]">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3.5 py-1.5 text-[13px] font-bold uppercase tracking-wider text-accent">
            📚 Picture-book studio
          </span>

          <h1 className="mt-5 text-balance font-display text-[clamp(2.4rem,5vw,3.6rem)] font-semibold leading-[1.08] tracking-tight text-foreground">
            Turn your stories into real picture books.
          </h1>

          <p className="mt-4 text-pretty text-[clamp(1.05rem,1.6vw,1.22rem)] leading-relaxed text-muted">
            Write the story, illustrate every page, and export print-ready
            files for Amazon KDP — all in one cozy place.
          </p>

          <div className="mt-8 flex flex-wrap gap-3.5">
            <button
              onClick={onStartNew}
              className="hero-btn-primary rounded-full px-6 py-3.5 text-base font-bold"
            >
              Start a new book
            </button>
            <a
              href="#library"
              className="hero-btn-ghost rounded-full border-[1.5px] border-border px-6 py-3.5 text-base font-bold text-foreground"
            >
              Open my library
            </a>
          </div>
        </div>

        <div className="hero-visual relative flex justify-center">
          <div className="hero-blob" aria-hidden />
          <div className="book-frame relative z-[1] w-full max-w-[460px] rounded-[24px] border border-border bg-surface p-3.5 shadow-[var(--hero-shadow-card)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hero.jpg"
              alt="A children's picture book resting open, showing a warm hand-illustrated spread from Viola House."
              className="block aspect-[4/5] w-full rounded-[14px] object-cover"
            />
            <div className="book-frame-corners pointer-events-none absolute inset-3.5" aria-hidden>
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .hero-root {
          background-image: radial-gradient(
            rgba(122, 111, 96, 0.045) 1px,
            transparent 1px
          );
          background-size: 22px 22px;
        }
        .hero-watermark {
          position: absolute;
          inset: 0;
          z-index: 0;
          background-image: url('/viola-house-logo.png');
          background-repeat: no-repeat;
          background-position: center;
          background-size: min(90vw, 720px) auto;
          opacity: 0.1;
          pointer-events: none;
        }
        @media (prefers-color-scheme: dark) {
          .hero-watermark {
            opacity: 0.15;
          }
        }
        :global(:root[data-theme='dark']) .hero-watermark {
          opacity: 0.15;
        }
        :global(:root[data-theme='light']) .hero-watermark {
          opacity: 0.1;
        }

        .hero-btn-primary {
          background: var(--accent);
          color: var(--accent-fg);
          box-shadow: 0 10px 30px -12px rgba(43, 33, 24, 0.18);
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease;
        }
        .hero-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 34px -12px color-mix(in srgb, var(--accent) 55%, transparent);
        }
        .hero-btn-ghost {
          background: transparent;
          transition:
            background-color 0.18s ease,
            border-color 0.18s ease,
            color 0.18s ease;
        }
        .hero-btn-ghost:hover {
          background: var(--surface-2);
          border-color: var(--accent);
          color: var(--accent);
        }

        .hero-blob {
          position: absolute;
          inset: -8% -6% -12% -6%;
          background: var(--accent-soft);
          border-radius: 46% 54% 58% 42% / 52% 44% 56% 48%;
          filter: blur(2px);
          opacity: 0.7;
          z-index: 0;
        }

        :global(:root) {
          --hero-shadow-card:
            0 24px 60px -18px rgba(43, 33, 24, 0.28),
            0 4px 14px -6px rgba(43, 33, 24, 0.14);
        }
        @media (prefers-color-scheme: dark) {
          :global(:root:not([data-theme='light'])) {
            --hero-shadow-card:
              0 28px 64px -18px rgba(0, 0, 0, 0.6),
              0 4px 14px -6px rgba(0, 0, 0, 0.4);
          }
        }
        :global(:root[data-theme='dark']) {
          --hero-shadow-card:
            0 28px 64px -18px rgba(0, 0, 0, 0.6),
            0 4px 14px -6px rgba(0, 0, 0, 0.4);
        }

        .book-frame {
          transform: rotate(-2.2deg);
          transition: transform 0.35s ease;
        }
        .book-frame:hover {
          transform: rotate(0deg);
        }
        .book-frame-corners span {
          position: absolute;
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: var(--accent);
          opacity: 0.75;
        }
        .book-frame-corners span:nth-child(1) {
          top: 0;
          left: 0;
        }
        .book-frame-corners span:nth-child(2) {
          top: 0;
          right: 0;
        }
        .book-frame-corners span:nth-child(3) {
          bottom: 0;
          left: 0;
        }
        .book-frame-corners span:nth-child(4) {
          bottom: 0;
          right: 0;
        }
        .book-frame::after {
          content: '';
          position: absolute;
          inset: 22px;
          border-radius: 14px;
          pointer-events: none;
          z-index: 2;
          opacity: 0.55;
          background:
            linear-gradient(var(--accent), var(--accent)) top left / 28px 2.5px
              no-repeat,
            linear-gradient(var(--accent), var(--accent)) top left / 2.5px 28px
              no-repeat,
            linear-gradient(var(--accent), var(--accent)) top right / 28px
              2.5px no-repeat,
            linear-gradient(var(--accent), var(--accent)) top right / 2.5px
              28px no-repeat,
            linear-gradient(var(--accent), var(--accent)) bottom left / 28px
              2.5px no-repeat,
            linear-gradient(var(--accent), var(--accent)) bottom left / 2.5px
              28px no-repeat,
            linear-gradient(var(--accent), var(--accent)) bottom right / 28px
              2.5px no-repeat,
            linear-gradient(var(--accent), var(--accent)) bottom right / 2.5px
              28px no-repeat;
        }

        @media (max-width: 767px) {
          .hero-grid {
            padding-top: clamp(5.5rem, 18vw, 7rem);
            text-align: center;
          }
          .hero-copy {
            margin: 0 auto;
            max-width: 38rem;
          }
          .hero-visual {
            order: 2;
          }
          .book-frame {
            max-width: 380px;
          }
        }
      `}</style>
    </section>
  )
}
