# Storybook — Picture Book Studio

A personal, single-user tool for writing, illustrating, and exporting children's
picture books ready for **Amazon KDP** paperback publishing.

The flow: **Write → Pages → Illustrate → Publish**. You write the story, split it
into pages, illustrate each page (AI, your own uploaded art, or a mix), then
export two print-ready PDFs (interior + full-wrap cover) sized to KDP specs and
hand them off to KDP (the final upload is manual — KDP has no public API).

### Writing helper (optional)

On the Write tab, an **✨ AI helper** can brainstorm ideas, write a first draft,
continue where you left off, or rewrite/simplify — but everything it produces
lands in a panel first, so it **never changes your words** unless you click
Insert or Replace. It uses the same Gemini key as illustration. Your own writing
works with or without a key.

### Human, AI, or hybrid illustration

On the Illustrate tab you can, per page:

- **Generate with AI** (Gemini), guided by a locked style + character reference;
- **Upload your own art** — works offline, no key needed, exports identically; or
- mix the two across pages.

You can also **"start the tone"** by uploading a hand-drawn character/sample as the
style reference — the AI then matches that look on the pages it illustrates.

## Stack

Next.js 16 (App Router, TypeScript, Turbopack) · Tailwind CSS v4 · Dexie
(IndexedDB) · pdf-lib + @pdf-lib/fontkit · Google Gemini image API · deployed on
Vercel.

## Local-first architecture

Your books live in the browser's **IndexedDB** (via Dexie) — this is the source
of truth, so **writing, page-splitting, and export all work with no internet**.
The app is an installable PWA; a service worker (production only) caches the app
shell for offline use.

Two things need a connection:

- **Illustration** — calls the image API (server route `/api/illustrate`).
- **KDP upload** — an external link to your KDP Bookshelf.

Supabase cloud sync is **optional** (off by default) — see below.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. No accounts, no backend needed.

### Enable illustrations (required for AI art)

Get a Google AI Studio key at https://aistudio.google.com/apikey and add it to
`.env.local`:

```
IMAGE_PROVIDER=gemini
GEMINI_API_KEY=your-key-here
```

Restart the dev server. Without a key, everything else still works — pages
without art export as clean text-only pages.

The image provider is **pluggable** (`src/lib/images/provider.ts`): to swap in a
cheaper or higher-res model later, add an implementation and wire it into
`getImageProvider()` — nothing else changes.

### Optional: cloud backup / multi-device (Supabase)

Leave the Supabase vars blank for pure local use. To turn on cloud sync + a login
gate, create a Supabase project, run `supabase/migrations/001_init.sql`, and fill
in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY`. Cloud sync covers book text + metadata; page images
stay local (large and regenerable).

## KDP export details

- **Interior PDF**: every page sized to trim + full bleed (0.125" added to top,
  bottom, and outside edge), full-page art with the story text overlaid in a
  readable band inside the safe margin, embedded fonts, images upscaled to
  ~300 DPI, auto title + copyright pages, padded to KDP's 24-page minimum (even).
- **Cover PDF**: full wrap (back + spine + front) with spine width computed from
  the final page count (white paper = 0.002252"/page) and 0.125" bleed all around.

Verified output for 8.5×8.5: interior pages 8.625 × 8.75 in, cover 17.304 × 8.75 in.

## Deploy (Vercel)

Push to a Git repo and import into Vercel. Set `GEMINI_API_KEY` (and the Supabase
vars if using cloud) in the Vercel project's environment variables. The default
build works as-is.

## Project map

- `src/lib/db/dexie.ts` — local IndexedDB store (source of truth)
- `src/lib/pages/split.ts` — sentence-based page-splitting heuristic
- `src/lib/images/*` — pluggable illustration provider (Gemini default) + client
- `src/lib/pdf/*` — client-side KDP PDF builders (interior, cover, fonts, upscale)
- `src/lib/kdp/constants.ts` — trim sizes + KDP bleed/spine math
- `src/components/book/*` — the Write / Pages / Illustrate / Publish phases
- `supabase/migrations/` — optional cloud schema
