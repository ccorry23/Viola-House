# Viola House — Session Handoff

_Last updated: 2026-09-11_

## What this is
**Viola House** — a picture-book studio web app for Craig's wife: write a story →
split into pages → AI-illustrate → export print-ready KDP PDFs.

- **Live:** https://viola-house.vercel.app (public, no login unless cloud sync is enabled)
- **Code:** `C:\dev\storybook` · GitHub: https://github.com/ccorry23/Viola-House
- **Stack:** Next.js 16 + TS + Tailwind v4 + Dexie/IndexedDB (local-first) + pdf-lib/fontkit + Google Gemini (images + text)
- **Dev:** `npm run dev` (PowerShell).
- **Deploy:** the GitHub repo is now **connected to Vercel** (project `viola-house`,
  production branch `main`), so **merging a PR to `main` auto-deploys to production** —
  no CLI needed. Production domain: `storybook-one-xi.vercel.app`. (Manual fallback
  still works: `npx vercel --prod` from a logged-in clone, account ccorry23.)

## ▶ RIGHT NOW — the one thing to finish
The book **"I Didn't Win Today"** (author: Craig Corry) is uploaded and sitting in
**KDP's Print Previewer**. The final visual polish (seamless text fade) was just deployed.

To ship it:
1. Open the app; if the "✨ A new version is ready" banner shows, tap it (or Ctrl+Shift+R).
2. **Publish → Generate print files** → download BOTH PDFs fresh (delete old downloads first).
3. In KDP, re-upload the new Interior + Cover PDFs.
4. Print Previewer → check pages (untick "Guides") → **Approve**.

## Just added (this session)
- **Hardcover option** (Publish tab → *Binding*: Paperback / Hardcover). Stored
  per book as `book.binding` (+ optional `book.hardcoverSpineIn`). KDP hardcover
  rules live in `lib/kdp/constants.ts` (`HARDCOVER_*`, `hardcoverBlockers`,
  `paddedPageCount`): **75–550 pages, 7″×10″ only** (of our sizes), white paper,
  case laminate. Cover file wraps **0.51″** past each outer trim (vs 0.125″ bleed)
  and text/barcode stay **0.4″** clear of the spine hinge; front art is now sized
  to the cover's own front panel inside `cover.ts`. Safeguards: requirements box
  up front; **hard stops** (wrong trim, >550 pages) disable the button and are
  re-checked in `exportBook`; books under 75 pages get padded with blanks only
  after the author ticks "I understand N blank pages will be added" (re-asked if
  the page count changes); Pages tab warns when a hardcover book is short. Spine
  width: we couldn't verify KDP's hardcover formula, so the author pastes it from
  KDP's cover calculator (estimate used until then; the full cover size is shown
  to cross-check). Files download as `…-hardcover-interior.pdf` / `-cover.pdf`.
  Verified with headless renders: 7×10 @76 pages → 15.52″×11.02″ cover, text
  clear of hinge + wrap; paperback geometry unchanged.
- **Back cover image is now FULL-BLEED with layered text** (`cover.ts`): when a
  back-cover image is set, it fills the whole back panel and the blurb is layered
  over it using the same treatment as the interior pages — a soft scrim baked into
  the art pixels (KDP-safe, opaque, adaptive light/dark) + halo text — instead of
  the old small vignette on a coloured panel. Blurb stays above the ~1.6" barcode
  strip; no image ⇒ plain coloured panel with centred blurb (unchanged). Cover
  builder now takes `backImageBlob` (raw Blob) and cover-fits + bakes it itself
  (reuses `upscaleToImage`/`computeBandStyle`/`bakeScrim`/`drawBandText`). Verified
  with a real headless cover render.
- **Amazon A+ marketing image generator** (spec #2, v1) — `MarketingSlide` on the
  Publish tab + `lib/marketing/slide.ts` (canvas renderer). Produces a **1940×600**
  A+ "Image & Text Overlay" banner in two layouts (**text over picture** /
  **text beside picture**) from a chosen illustration (cover/page/upload) + a
  headline and up to 3 benefit lines. Live preview, **Download** (JPEG ~0.92,
  well under A+'s 3 MB), and an **"✨ Suggest from my story"** button (new
  `benefits` write mode — content-safe: no pricing/time-sensitive words per A+
  rules). Verified both layouts with a real headless render. Uses the "VH
  Fraunces"/"VH Nunito" @font-face families for canvas text.
  _Still open from the spec: 600×600 trio tiles (#2b), the back-cover-style
  marketing slide (#3), and the batch/zip export (#4). Destination is A+ Content's
  "From the Publisher" section — KDP has no self-serve image carousel._
- **AI "Write it for me" for the back cover** (new `backcover` write mode +
  `MARKETER_SYSTEM`): a button by the Publish-tab "Back cover description" box
  generates a warm hook plus a short **"Along the way, children learn to:"**
  bullet list (3 concrete lessons drawn only from the manuscript), and saves it
  to `book.blurb`. The back-cover renderer now **honours line breaks** (blank
  line = paragraph gap, one bullet per line), so the list prints as a list
  instead of a run-on paragraph. Verified the list layout with a real cover
  render; the AI call reuses the existing `/api/write` path (needs GEMINI_API_KEY,
  set in prod).
- **Designed print back cover** (`src/lib/pdf/cover.ts` + a `blurb` field on the
  Book): the back panel of the wrap PDF now prints the book's **description/blurb**
  (centered, wrapped, matched to the cover background) instead of being blank. The
  whole bottom strip (~1.6") is left clear for KDP's auto-added barcode. Entered
  via a **"Back cover description"** box on the Publish tab; the Listing Helper's
  generated Amazon description has a **"Use on back cover"** button that saves it
  into `book.blurb` (so it stops evaporating). Empty blurb = plain back cover
  (unchanged). Verified with a real headless cover render + mupdf raster.
- **Back cover image** (`book.backCoverImage` + `BackCoverImagePicker`): an
  optional illustration printed above the blurb — pick the cover art or any page
  image, or upload one. Flattened to an opaque JPEG at export (KDP-safe),
  contain-fit as a vignette; bottom stays clear for the barcode. Verified via a
  headless render with an image.
  _(First slice of the Back Cover + Marketing Assets spec. Still open: benefit /
  marketing slides + batch export — pending confirmation of the real Amazon upload
  path, since KDP has no self-serve image carousel; extra images go via A+ Content.)_
- **Edit page wording on the Pages tab** (`src/components/book/PagesPhase.tsx`):
  every page card has an "✏️ Edit text" button (works locked or unlocked) that
  opens an inline textarea. Saving rebuilds the manuscript from the page blocks
  (edited page swapped in, pages separated by blank lines) and recomputes the
  break offsets, then — when locked — refreshes the concrete Page records used by
  export, **preserving each page's illustration** (a wording tweak no longer drops
  the art). Verified the rebuild round-trips with no page merges/splits.
- **Top-of-page art inset** (`src/lib/pdf/upscale.ts` + `TOP_ART_INSET_IN` in
  `kdp/constants.ts`): every page and the cover now push illustration content
  down ~3/8" from the top trim, and the freed top strip is filled with colour
  bled up from the art's own top edge (a gentle ~4% vertical squash, so nothing
  — title or bottom byline — is cropped). Still full-bleed (no white border);
  applied at export time, so **re-exporting any existing book picks it up** (no
  regeneration needed). Tune the amount via `TOP_ART_INSET_IN`. Verified with a
  real headless export + mupdf raster (top marker moves down under a seamless
  colour bleed, bottom marker preserved, story-text band intact).
- **Print-safe framing in the image generator** (`src/lib/images/prompt.ts`): the
  page and cover prompts now tell the model to keep important content — faces, key
  objects, and any title/lettering — inside the central safe area (~middle 88%),
  clear of the edges that get trimmed, while still bleeding the art to the edges
  (no white borders — KDP requires full bleed). Interior prompts also ask for a
  calmer lower strip where the story text sits. Applies to all newly generated
  covers/pages going forward; it does not change already-generated art (regenerate
  a page/cover to apply it).
- **Body-font picker** (Publish tab): the author now chooses the story-text font
  from a curated set of four — **Nunito** (default, rounded sans), **Fraunces**
  (storybook serif), **Andika** (new-reader letterforms — single-story a/g), and
  **Comic Neue** (playful). Stored per book as `book.bodyFont`; titles/cover still
  use the Fraunces display font. Fonts are subset-embedded into both PDFs
  (verified: all four embed + rasterize cleanly via mupdf). New TTFs live in
  `public/fonts/` and an in-app preview swatch uses the same files.
- **Stronger story-text contrast** so white text stays readable in Amazon's
  Print Previewer (it renders pages dimmer/downsampled than a normal PDF viewer,
  which was washing out the thin outline): the outline behind the text is now a
  full, thicker two-ring stroke, and the scrim pool behind white text (on dark
  art) is a bit more opaque. The seamless top fade is unchanged — the scrim still
  ramps from 0 alpha at its top edge. Verified with a real headless export +
  mupdf raster, including an emulated dim/downsample of Amazon's previewer.
  **⇒ Re-export the book to pick these up** (same re-download/re-upload steps below).

## Recently fixed (why KDP was rejecting)
- **The real cause was file size:** the interior embedded each page as a lossless **PNG**
  at 300 DPI → ~368 MB for 28 pages, which KDP couldn't process. Fixed by embedding the
  illustrations as **JPEG** (q0.9) — same look, ~15–30 MB instead of 368 MB.
- **Text "box" → seamless fade:** the readable band behind the story text is now
  composited **into the picture's own pixels** (soft gradient, adapts light/dark to the art),
  so it melts into the illustration with no hard edge — while the file stays fully **opaque/flat**
  (no PDF transparency) and small. Verified on real exports with mupdf.
- Earlier: switched PDFs to a classic xref table (not compressed object streams) for
  broad print-pipeline compatibility.

## Other things that are DONE and live
- **AI illustration works** (Gemini quota bug resolved on Google's side). Cover-first flow:
  make the cover, then illustrate pages to match it.
- **Cast / character references:** name + reference image per recurring character, fed into
  every page so a character not on the cover stays consistent.
- **Per-image controls:** Keep / Suggest-a-change / Start-over, with side-by-side preview + Undo (pages AND cover).
- **Write-tab AI helper:** ideas / draft / continue / rewrite / **Review & Suggest** (constructive feedback on the manuscript).
- **Publish-tab "Amazon listing helper":** generates a product **Description**, 4 **Subtitle** options,
  and 7 strategic **Keywords** (with a "who it targets" note each) — all copy-paste-ready for KDP.
- **Author name field + two cover toggles** ("Show title on cover" / "Show author on cover") on the Publish tab.
- **Editable book title** — click the title in the top header on any tab to rename.
- **Set Page Count** (Pages tab): target a page count; balances the story keeping paragraphs together.
- **Export progress bar** on the Publish tab (export takes ~a minute).
- **Auto-update:** a "new version ready — refresh" banner appears when a new build is deployed
  (and auto-refreshes on return), so future updates reach the app without manual hard-refresh.
- **KDP walkthrough guide** at `/guide` (large-type, step-by-step, for a first-time elderly publisher).

## Open / not started
1. **Cross-device cloud sync (Supabase)** — fully BUILT (magic-link login + pull/merge, text/structure only),
   but **inert until a Supabase project is created** and its URL + anon key are added to Vercel.
   Craig hit the free-tier 2-project limit and needs to **upgrade Supabase** first; paused until then.
2. Books are **device-local** until (1) is enabled — a book started on the desktop won't appear on the phone.
3. Cover art from the AI can bake its own title text into the image; the app can't edit those pixels
   (that's why we added the "show title/author on cover" toggles).

## Handy operational notes
- Local dev server runs on **port 3006** (Craig's) — a 2nd instance auto-uses **3007**.
- The in-app browser preview on this machine can't screenshot/composite reliably; verify PDFs with
  **mupdf** (in `node_modules`, ESM `import * as mupdf from 'mupdf'`) — open, count pages, check bounds, rasterize.
- Full detailed history is in Claude's memory: `memory/storybook-kdp-app.md`.
