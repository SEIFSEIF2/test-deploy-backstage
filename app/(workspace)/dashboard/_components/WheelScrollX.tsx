'use client'

import { useEffect, useRef, type ReactNode } from 'react'

// Mouse wheels only emit vertical deltas; trackpads emit real deltaX.
// Translate vertical wheel into horizontal panning of this container so
// mice can scroll the board too. The translation yields to any child that
// can still scroll vertically in the wheel direction (task columns), so
// their native behavior is untouched. Needs a native non-passive listener:
// React's synthetic onWheel is passive and can't preventDefault.
export default function WheelScrollX({
  className,
  children
}: {
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.deltaX !== 0 || e.deltaY === 0 || e.shiftKey) return
      if (el.scrollWidth <= el.clientWidth) return
      for (
        let n = e.target as HTMLElement | null;
        n && n !== el;
        n = n.parentElement
      ) {
        if (n.scrollHeight > n.clientHeight + 1) {
          const canDown = n.scrollTop + n.clientHeight < n.scrollHeight - 1
          const canUp = n.scrollTop > 0
          if ((e.deltaY > 0 && canDown) || (e.deltaY < 0 && canUp)) return
        }
      }
      el.scrollLeft += e.deltaY
      e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
