'use client'

import { useOnline } from '@/lib/hooks/useOnline'
import { cn } from '@/lib/cn'

/**
 * Shows whether the app currently has a connection. Writing works either way;
 * illustration and export need to be online. This makes that state obvious.
 */
export function OnlineIndicator() {
  const online = useOnline()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        online
          ? 'bg-[color:var(--ok)]/12 text-[color:var(--ok)]'
          : 'bg-surface-2 text-muted'
      )}
      title={
        online
          ? 'Online — you can illustrate and export.'
          : 'Offline — you can keep writing; illustrating and exporting need a connection.'
      }
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          online ? 'bg-[color:var(--ok)]' : 'bg-muted'
        )}
      />
      {online ? 'Online' : 'Offline'}
    </span>
  )
}
