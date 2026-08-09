'use client'

import { useEffect, useMemo, useRef } from 'react'

/**
 * Returns a debounced version of `fn`. The latest `fn` is always used, and any
 * pending call is flushed/cleared on unmount.
 */
export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delayMs: number
) {
  const fnRef = useRef(fn)
  fnRef.current = fn
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debounced = useMemo(() => {
    return (...args: A) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => fnRef.current(...args), delayMs)
    }
  }, [delayMs])

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return debounced
}
