import { cn } from '@/lib/cn'
import { BOOK_STATUS_LABEL, type BookStatus } from '@/lib/types'

const STYLES: Record<BookStatus, string> = {
  drafting: 'bg-surface-2 text-muted',
  illustrating: 'bg-accent-soft text-accent',
  ready: 'bg-[color:var(--ok)]/15 text-[color:var(--ok)]',
}

export function StatusBadge({
  status,
  className,
}: {
  status: BookStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        STYLES[status],
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {BOOK_STATUS_LABEL[status]}
    </span>
  )
}
