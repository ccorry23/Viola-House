import Link from 'next/link'
import { OnlineIndicator } from './OnlineIndicator'

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span aria-hidden>📚</span>
          <span>Storybook</span>
        </Link>
        <OnlineIndicator />
      </div>
    </header>
  )
}
