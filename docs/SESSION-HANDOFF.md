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
