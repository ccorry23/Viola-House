'use client'

import Link from 'next/link'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

/**
 * "Publishing Day" — a large-type, step-by-step walkthrough of the manual
 * Amazon KDP steps that begin once Viola House has produced the two print
 * files. Built for a non-technical, older reader: one action per step, a
 * simplified (deliberately non-Amazon-styled) picture of each screen with a
 * gold callout, and a print button for a paper copy.
 */
export default function GuideContent() {
  return (
    <main className="mx-auto w-full max-w-[740px] px-5 pb-24 pt-8 sm:px-8">
      <Header />
      <Title />
      <HelpBand />
      <BeforeYouBegin />
      <Glossary />
      <Toc />

      <Part n="0" id="part0" title="Set Up Your Free Account" skip="Already published a book before? Skip to Part 1 →">
        <p className="pd-lede">
          This is a one-time thing. If someone already set up the Amazon KDP account, you can
          skip straight to Part 1.
        </p>
        <div className="pd-steps">
          <Step n={1} text={<>Open your web browser and go to <Code>kdp.amazon.com</Code></>}>
            <Mock url="kdp.amazon.com">
              <MLabel>Amazon KDP</MLabel>
              <MTitle>Self-publish your book, reach millions of readers</MTitle>
              <div className="pd-row">
                <Callout label="Click here"><MBtn>Sign in</MBtn></Callout>
                <MBtnOutline>Create your KDP account</MBtnOutline>
              </div>
            </Mock>
          </Step>
          <Step n={2} text="Sign in with the same email and password you use to shop on Amazon" note='No Amazon account yet? Click "Create your KDP account" instead and follow the prompts.' />
          <Step n={3} text="Fill in your name and address when Amazon asks for them" />
          <Step n={4} text="Answer a few short tax questions" note='Most people select "Individual" and "U.S. Person," then just follow the prompts. Answer honestly — there’s no wrong answer here.' />
          <Step n={5} text="Add a bank account (so Amazon knows where to send your money) and a credit card" note="This only needs to be done once, ever." />
        </div>
      </Part>

      <Part n="1" id="part1" title="Find Your Book's Two Files">
        <p className="pd-lede">Viola House already made these for you. You&apos;ll be uploading both in a few minutes.</p>
        <div className="pd-steps">
          <Step n={1} text="Open your Downloads folder and look for two files with your book's name" note={<>The file names will start with your book&apos;s title, one ending in <Code>-interior.pdf</Code> and one in <Code>-cover.pdf</Code>.</>}>
            <Mock url="📁 Downloads">
              <div className="pd-file">📄 the-sleepy-fox<strong>-interior.pdf</strong></div>
              <Callout as="div" label={null}>
                <div className="pd-file" style={{ marginBottom: 0 }}>📄 the-sleepy-fox<strong>-cover.pdf</strong></div>
              </Callout>
            </Mock>
          </Step>
          <Step n={2} text={<>Can&apos;t find them? Open Viola House, go to the <strong>Publish</strong> tab, and click &ldquo;↓ Interior PDF&rdquo; and &ldquo;↓ Cover PDF&rdquo; again</>} />
        </div>
      </Part>

      <Part n="2" id="part2" title="Open Your Amazon Bookshelf">
        <p className="pd-lede">This is the home page for all your books.</p>
        <div className="pd-steps">
          <Step n={1} text={<>Go to <Code>kdp.amazon.com</Code> and sign in</>} />
          <Step n={2} text='You&apos;ll land on a page called your "Bookshelf" — this lists all your books'>
            <Mock url="kdp.amazon.com/bookshelf">
              <div className="pd-headrow">
                <MTitle style={{ marginBottom: 0 }}>Bookshelf</MTitle>
                <Callout label="Click here next"><MBtn>+ Create</MBtn></Callout>
              </div>
            </Mock>
          </Step>
        </div>
      </Part>

      <Part n="3" id="part3" title="Start a New Paperback">
        <div className="pd-steps">
          <Step n={1} text='Click "+ Create" (or "Create a New Title")' />
          <Step n={2} text={<>Amazon will ask what kind of book — click <strong>Paperback</strong></>}>
            <Mock url="kdp.amazon.com/title">
              <MTitle>What kind of book are you publishing?</MTitle>
              <div className="pd-tiles">
                <div className="pd-tile">📱<br />Kindle eBook</div>
                <Callout as="div" label="Choose this one">
                  <div className="pd-tile pd-tile--picked">📖<br />Paperback</div>
                </Callout>
                <div className="pd-tile">📚<br />Hardcover</div>
              </div>
            </Mock>
          </Step>
        </div>
      </Part>

      <Part n="4" id="part4" title="Tell Amazon About Your Book">
        <p className="pd-lede">This is called the &ldquo;Paperback Details&rdquo; tab. Fill each box in, top to bottom.</p>
        <div className="pd-steps">
          <Step n={1} text='Language: leave it set to "English"' />
          <Step n={2} text="Book Title: type your book's exact title" note='Leave "Series" and "Edition Number" empty — most first books don’t need them.'>
            <Mock url="kdp.amazon.com/title/details">
              <Callout as="div" label={null}>
                <MField k="Book Title">The Sleepy Little Fox</MField>
              </Callout>
              <MField k="Series" style={{ marginBottom: 0 }}>— leave blank —</MField>
            </Mock>
          </Step>
          <Step n={3} text="Primary Author: type the author's first and last name" />
          <Step n={4} text="Description: write a few warm sentences about the story" note="This is what people read on Amazon before they decide to buy — a short, friendly summary is plenty." />
          <Step n={5} text='Publishing Rights: choose "This is not a public domain work, and I hold the necessary publishing rights"' />
          <Step n={6} text="Keywords: skip this box — it's optional" />
          <Step n={7} text={<>Categories: click &ldquo;Choose categories&rdquo; and pick something like &ldquo;Children&apos;s Books&rdquo;</>} />
          <Step n={8} text='Is this book for children? Select "No" for adult content' />
          <Step n={9} text='Scroll down and click "Save and Continue"' />
        </div>
      </Part>

      <Part n="5" id="part5" title="Add Your Two Files">
        <p className="pd-lede">This is called the &ldquo;Paperback Content&rdquo; tab — the most important part. Go slowly here.</p>
        <div className="pd-steps">
          <Step n={1} text='ISBN: click "Get a free KDP ISBN"' note="Skip this only if you already own your own ISBN." />
          <Step n={2} text="Print options: choose your ink, paper, trim size, and bleed">
            <Important>
              Because your book has color pictures on every page, set <strong>Ink and paper</strong> to a{' '}
              <strong>color</strong> option (not black &amp; white), and set <strong>Bleed</strong> to{' '}
              <strong>&ldquo;Bleed (images extend to the edge of the page).&rdquo;</strong> For{' '}
              <strong>Trim size</strong>, match the exact number Viola House showed you on the Publish tab.
            </Important>
            <Mock url="kdp.amazon.com/title/content">
              <MTitle>Print options</MTitle>
              <Callout as="div" label={null}>
                <MField k="Ink and paper">Premium color / white paper</MField>
              </Callout>
              <MField k="Trim size">8.5&Prime; × 8.5&Prime; — matches Viola House</MField>
              <Callout as="div" label={null}>
                <MField k="Bleed" style={{ marginBottom: 0 }}>Bleed (images extend to page edge)</MField>
              </Callout>
            </Mock>
          </Step>
          <Step n={3} text={<>Click &ldquo;Upload paperback manuscript&rdquo; and choose your <Code>-interior.pdf</Code> file</>} note="Wait for the green checkmark — that means it worked. This can take a minute or two; that's normal." />
          <Step n={4} text={<>Click &ldquo;Upload a print-ready cover&rdquo; and choose your <Code>-cover.pdf</Code> file</>}>
            <Mock url="kdp.amazon.com/title/content">
              <div className="pd-row" style={{ alignItems: 'stretch' }}>
                <div className="pd-field pd-field--upload">
                  📤<br /><strong>Manuscript</strong><br />
                  <span style={{ color: '#2e7d5b' }}>✓ the-sleepy-fox-interior.pdf</span>
                </div>
                <Callout as="div" label="Your -cover.pdf goes here" style={{ flex: 1 }}>
                  <div className="pd-field pd-field--upload" style={{ marginBottom: 0 }}>
                    📤<br /><strong>Cover</strong><br />Upload a print-ready PDF cover
                  </div>
                </Callout>
              </div>
            </Mock>
          </Step>
          <Step n={5} text='Click "Launch Previewer" and flip through every page' note="This shows exactly what the printed book will look like. Take your time — check the cover, then flip through the story pages." />
          <Step n={6} text='Happy with it? Click "Approve," then "Save and Continue"'>
            <Mock url="kdp.amazon.com/previewer">
              <MTitle>Previewer — Page 3 of 24</MTitle>
              <div className="pd-field pd-field--preview">📖 your storybook page appears here</div>
              <div className="pd-row">
                <Callout label="When it looks right"><MBtn>Approve</MBtn></Callout>
                <MBtnOutline>Back</MBtnOutline>
              </div>
            </Mock>
          </Step>
        </div>
      </Part>

      <Part n="6" id="part6" title="Set Your Price">
        <p className="pd-lede">This is called &ldquo;Paperback Rights &amp; Pricing.&rdquo;</p>
        <div className="pd-steps">
          <Step n={1} text='Territories: leave it set to "All territories (worldwide rights)"' />
          <Step n={2} text="List Price: Amazon will show you the lowest price allowed for your book" note="Type in a price at or above that minimum — many picture books sell between $9.99 and $14.99. Just under the “royalty” note, you’ll see roughly what you’ll earn per copy.">
            <Mock url="kdp.amazon.com/title/pricing">
              <Callout as="div" label={null}>
                <MField k="List Price (USD)">$12.99 · minimum allowed: $6.30</MField>
              </Callout>
              <MField k="Royalty (estimated)" style={{ marginBottom: 0 }}>You&apos;ll earn about $4.15 per copy sold</MField>
            </Mock>
          </Step>
          <Step n={3} text='Click "Save and Continue"' note='Need to stop here? Click "Save as Draft" instead — nothing is lost, and you can finish later.' />
        </div>
      </Part>

      <Part n="7" id="part7" title="Publish">
        <div className="pd-steps">
          <Step n={1} text="Amazon shows you one last summary page — look it over" />
          <Step n={2} text='Scroll down and click the big button: "Publish Your Paperback Book"'>
            <Mock url="kdp.amazon.com/title/publish">
              <div style={{ textAlign: 'center' }}>
                <MTitle>Ready to publish?</MTitle>
                <Callout label="The last click!" up>
                  <MBtn style={{ padding: '14px 28px', fontSize: 16 }}>Publish Your Paperback Book</MBtn>
                </Callout>
              </div>
            </Mock>
          </Step>
          <Step n={3} text="That's it — you're published! 🎉" note="What happens next: Amazon checks everything over, which usually takes 24–72 hours. You'll get an email when your book is live and can be found by searching its title on Amazon." />
        </div>
      </Part>

      <Part n="8" id="part8" title="After It Goes Live">
        <div className="pd-steps">
          <Step n={1} text="Find your book by searching its exact title on Amazon.com" />
          <Step n={2} text='Want to hold a printed copy? Go to your Bookshelf, click your book, then "Order author copies"' note="These print at cost — much cheaper than the retail price — so you can see and hold the real thing." />
          <Step n={3} text="Share the Amazon link with family and friends" />
        </div>
      </Part>

      <section className="mt-14 rounded-3xl border border-border bg-surface-2 px-6 py-10 text-center">
        <h2 className="font-display text-3xl font-bold">You did it. 🌸</h2>
        <p className="mx-auto mt-2 max-w-[46ch] text-lg text-muted">
          However long it took, you turned a story into a real book that anyone in the world can
          hold in their hands. That&apos;s worth being proud of.
        </p>
      </section>

      <HelpBand />

      <footer className="mt-8 text-center text-sm text-muted">
        These pages show simplified drawings to help you find your way around — the real Amazon
        screens look a little different, but the buttons and boxes will say the same words.
      </footer>

      <GuideStyles />
    </main>
  )
}

// ---------------------------------------------------------------------------

function Header() {
  return (
    <div className="flex items-center gap-3 print:hidden">
      <Link href="/" className="text-sm font-semibold text-muted hover:text-foreground">
        ← Back
      </Link>
      <span className="ml-auto flex items-center gap-2">
        <FlowerMark />
        <span className="font-display text-lg font-semibold">Viola House</span>
      </span>
      <PrintButton />
    </div>
  )
}

function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-bold shadow-sm hover:bg-surface-2"
    >
      🖨️ Print this guide
    </button>
  )
}

function Title() {
  return (
    <div className="mt-6">
      <h1 className="font-display text-4xl font-bold leading-[1.1] sm:text-[42px]">Publishing Day</h1>
      <p className="mt-2 max-w-[58ch] text-xl leading-relaxed text-muted">
        Your book is written and illustrated, and Viola House has made your two print files. This
        is the last stretch — putting the book up for sale on Amazon.{' '}
        <strong className="text-foreground">
          Take it one step at a time. There&apos;s no rush, and no way to break anything.
        </strong>
      </p>
    </div>
  )
}

function HelpBand() {
  const [contact, setContact] = useState('')
  useEffect(() => {
    setContact(localStorage.getItem('viola-house-support-contact') ?? '')
  }, [])
  function onChange(v: string) {
    setContact(v)
    localStorage.setItem('viola-house-support-contact', v)
  }
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-accent-soft px-5 py-4">
      <span className="text-2xl" aria-hidden>☎️</span>
      <span className="text-lg">
        <span className="font-extrabold">Stuck on anything, at any point?</span>
        <br />
        Call or text{' '}
        <input
          value={contact}
          onChange={(e) => onChange(e.target.value)}
          placeholder="add a phone number"
          aria-label="Support contact"
          className="min-w-[220px] flex-1 border-0 border-b-2 border-dashed border-muted bg-transparent px-1 text-lg font-extrabold text-foreground placeholder:font-normal placeholder:text-muted focus:outline-none"
        />
      </span>
    </div>
  )
}

function BeforeYouBegin() {
  const items = [
    <>You&apos;re on a <strong>computer</strong> (not a phone or tablet) — this is much easier on a bigger screen.</>,
    <>Your book&apos;s two files are saved somewhere you can find them — usually a folder called <strong>Downloads</strong>. One file ends in <Code>-interior.pdf</Code>, the other in <Code>-cover.pdf</Code>.</>,
    <>You know your <strong>Amazon email and password</strong> (the same one you use to shop).</>,
    <>You have about <strong>20–30 minutes</strong>. Amazon saves your progress every time you click &ldquo;Save and Continue&rdquo; — you can always stop and come back.</>,
  ]
  return (
    <Panel title="Before You Begin" sub="Check these off first — it'll make everything below go smoothly.">
      <ul className="grid gap-3">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-1 h-6 w-6 flex-none rounded-[7px] border-2 border-accent" />
            <span className="text-lg">{it}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function Glossary() {
  const terms: [string, ReactNode][] = [
    ['KDP', 'Amazon’s name for the self-publishing website. Short for "Kindle Direct Publishing."'],
    ['Manuscript', <>The inside pages of the book — this is your <Code>-interior.pdf</Code> file.</>],
    ['Trim size', 'The outside dimensions of the printed book. Viola House already told you this number — you’ll match it in Part 5.'],
    ['ISBN', 'A book’s official ID number, like a fingerprint. Amazon will give you one for free.'],
    ['Proof / Previewer', 'Amazon’s way of showing you what the printed book will actually look like before it goes on sale.'],
    ['Royalty', 'The money you earn each time someone buys a copy.'],
  ]
  return (
    <Panel title="A Few Words You'll See" sub="Nothing to memorize — just glance back here if a word looks unfamiliar.">
      <dl className="grid gap-4">
        {terms.map(([term, def]) => (
          <div key={term}>
            <dt className="font-display text-lg font-bold">{term}</dt>
            <dd className="mt-0.5 text-muted">{def}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

function Panel({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <section className="mt-6 rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-7">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <p className="mt-1 mb-4 text-muted">{sub}</p>
      {children}
    </section>
  )
}

const TOC: { n: string; id: string; label: string; skip?: boolean }[] = [
  { n: '0', id: 'part0', label: 'Set up your free account', skip: true },
  { n: '1', id: 'part1', label: "Find your book's two files" },
  { n: '2', id: 'part2', label: 'Open your Amazon Bookshelf' },
  { n: '3', id: 'part3', label: 'Start a new paperback' },
  { n: '4', id: 'part4', label: 'Tell Amazon about your book' },
  { n: '5', id: 'part5', label: 'Add your two files' },
  { n: '6', id: 'part6', label: 'Set your price' },
  { n: '7', id: 'part7', label: 'Publish' },
  { n: '8', id: 'part8', label: 'After it goes live' },
]

function Toc() {
  return (
    <nav className="mt-6 grid gap-2 print:hidden" aria-label="Table of contents">
      {TOC.map((t) => (
        <a
          key={t.id}
          href={`#${t.id}`}
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 font-bold hover:bg-accent-soft"
        >
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent font-display text-sm font-bold text-accent-fg">
            {t.n}
          </span>
          <span>{t.label}</span>
          {t.skip && (
            <span className="ml-auto rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
              skip if done
            </span>
          )}
        </a>
      ))}
    </nav>
  )
}

function Part({
  n,
  id,
  title,
  skip,
  children,
}: {
  n: string
  id: string
  title: string
  skip?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="mt-14 scroll-mt-5">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-accent font-display text-2xl font-bold text-accent-fg shadow-sm">
          {n}
        </span>
        <h2 className="font-display text-[28px] font-bold">{title}</h2>
      </div>
      {skip && (
        <span className="mt-2 inline-block rounded-full bg-[color:var(--gold)]/15 px-3.5 py-1 text-sm font-extrabold text-[color:var(--gold)]">
          {skip}
        </span>
      )}
      {children}
    </section>
  )
}

function Step({
  n,
  text,
  note,
  children,
}: {
  n: number
  text: ReactNode
  note?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-start gap-3.5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full border-2 border-accent font-display text-sm font-bold text-accent">
          {n}
        </span>
        <span className="pt-0.5 text-xl font-bold">{text}</span>
      </div>
      {note && <p className="ml-[46px] mt-2.5 text-lg text-muted">{note}</p>}
      {children}
    </div>
  )
}

function Important({ children }: { children: ReactNode }) {
  return (
    <div className="ml-[46px] mt-3.5 flex gap-2.5 rounded-2xl border border-[color:var(--gold)] bg-[color:var(--gold)]/12 p-4 text-lg font-bold text-[color:var(--gold)]">
      <span className="flex-none font-display font-extrabold">Important —</span>
      <span className="text-foreground/90">{children}</span>
    </div>
  )
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-sans font-extrabold">
      {children}
    </code>
  )
}

function FlowerMark() {
  return (
    <svg viewBox="0 0 100 100" width="24" height="24" aria-hidden role="img">
      <ellipse cx="33" cy="37" rx="19" ry="23" fill="#9a7ab5" />
      <ellipse cx="67" cy="37" rx="19" ry="23" fill="#9a7ab5" />
      <ellipse cx="27" cy="58" rx="19" ry="21" fill="var(--accent)" />
      <ellipse cx="73" cy="58" rx="19" ry="21" fill="var(--accent)" />
      <ellipse cx="50" cy="64" rx="21" ry="19" fill="#664785" />
      <circle cx="50" cy="50" r="8.5" fill="var(--gold)" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Browser "mockups" — deliberately simplified, neutral-colored drawings of
// KDP screens (not real Amazon screenshots or trade dress). They depict a
// real light-mode website, so their inner colors stay fixed regardless of
// the app's own light/dark theme — like a photo would.

function Mock({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="pd-mock-wrap">
      <div className="pd-mock">
        <div className="pd-mock-bar">
          <span className="pd-dot" /><span className="pd-dot" /><span className="pd-dot" />
          <span className="pd-mock-url">{url}</span>
        </div>
        <div className="pd-mock-body">{children}</div>
      </div>
    </div>
  )
}

function MLabel({ children }: { children: ReactNode }) {
  return <div className="pd-mock-label">{children}</div>
}
function MTitle({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="pd-mock-title" style={style}>{children}</div>
}
function MField({
  k,
  children,
  style,
}: {
  k: string
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div className="pd-field" style={style}>
      <span className="pd-field-k">{k}</span>
      {children}
    </div>
  )
}
function MBtn({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span className="pd-btn" style={style}>{children}</span>
}
function MBtnOutline({ children }: { children: ReactNode }) {
  return <span className="pd-btn-outline">{children}</span>
}

function Callout({
  label,
  children,
  up,
  as = 'span',
  style,
}: {
  label: ReactNode
  children: ReactNode
  up?: boolean
  as?: 'span' | 'div'
  style?: CSSProperties
}) {
  const Tag = as
  return (
    <Tag className="pd-callout" style={style}>
      {children}
      <span className="pd-callout-ring" />
      {label && <span className={`pd-callout-chip${up ? ' pd-up' : ''}`}>{label}</span>}
    </Tag>
  )
}

function GuideStyles() {
  return (
    <style jsx global>{`
      .pd-lede { margin-top: 14px; font-size: 19px; color: var(--muted); }
      .pd-steps { margin-top: 22px; display: grid; gap: 20px; }

      .pd-mock-wrap { margin: 16px 0 4px 46px; }
      .pd-mock {
        border: 1px solid #dde1e6; border-radius: 12px; overflow: hidden;
        background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 8px 20px -10px rgba(0,0,0,0.18);
      }
      .pd-mock-bar {
        background: #eef0f3; border-bottom: 1px solid #dde1e6;
        display: flex; align-items: center; gap: 8px; padding: 9px 12px;
      }
      .pd-dot { width: 9px; height: 9px; border-radius: 50%; background: #dde1e6; }
      .pd-mock-url {
        margin-left: 8px; background: #ffffff; border: 1px solid #dde1e6; border-radius: 999px;
        padding: 4px 12px; font-size: 12px; color: #6b7480; font-weight: 700;
      }
      .pd-mock-body { padding: 18px; color: #202632; position: relative; }
      .pd-mock-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7480; margin-bottom: 4px; }
      .pd-mock-title { font-family: var(--font-display), Georgia, serif; font-weight: 700; font-size: 17px; margin-bottom: 12px; }
      .pd-headrow { display: flex; justify-content: space-between; align-items: center; }

      .pd-field { background: #f6f7f9; border: 1px solid #dde1e6; border-radius: 8px; padding: 9px 12px; font-size: 14px; color: #6b7480; margin-bottom: 10px; }
      .pd-field-k { display: block; font-size: 11px; font-weight: 800; color: #202632; margin-bottom: 3px; }
      .pd-field--upload { flex: 1; text-align: center; padding: 22px 10px; }
      .pd-field--preview { text-align: center; padding: 36px 10px; color: #6b7480; }

      .pd-btn { display: inline-block; background: #3b4656; color: #fff; font-weight: 800; font-size: 14px; border-radius: 8px; padding: 9px 18px; }
      .pd-btn-outline { display: inline-block; background: transparent; color: #202632; font-weight: 800; font-size: 14px; border: 1.5px solid #dde1e6; border-radius: 8px; padding: 9px 18px; }
      .pd-row { display: flex; gap: 10px; flex-wrap: wrap; }
      .pd-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
      .pd-tile { border: 1.5px solid #dde1e6; border-radius: 10px; padding: 16px 10px; text-align: center; font-size: 13px; font-weight: 800; color: #202632; }
      .pd-tile--picked { border-color: #202632; background: #f6f7f9; }
      .pd-file { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid #dde1e6; border-radius: 8px; font-size: 13px; font-weight: 700; margin-bottom: 8px; color: #202632; }

      .pd-callout { position: relative; display: inline-block; }
      .pd-callout-ring { position: absolute; inset: -5px; border: 3px solid var(--gold); border-radius: 12px; pointer-events: none; }
      .pd-callout-chip {
        position: absolute; top: 100%; left: 0; margin-top: 8px; background: var(--gold); color: #2a1c04;
        font-weight: 800; font-size: 12.5px; padding: 4px 10px; border-radius: 999px; white-space: nowrap; z-index: 2;
      }
      .pd-callout-chip.pd-up { top: auto; bottom: 100%; margin-top: 0; margin-bottom: 8px; }

      @media (max-width: 560px) {
        .pd-mock-wrap { margin-left: 0; }
        .pd-tiles { grid-template-columns: 1fr; }
      }

      @media print {
        body { background: #fff !important; color: #201a12 !important; }
        .pd-mock { box-shadow: none; }
        section[id^="part"] { break-before: page; }
        section[id="part0"] { break-before: avoid; }
      }
    `}</style>
  )
}
