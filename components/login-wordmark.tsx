'use client'

import { motion } from 'framer-motion'
import { config } from '@/lib/config'

export function LoginWordmark() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
    >
      <motion.span
        className="text-muted-foreground/10 text-[clamp(6rem,18vw,18rem)] leading-none font-black tracking-tighter uppercase"
        initial={{ opacity: 0, y: 12, scale: 1.02 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          opacity: { duration: 0.55, ease: 'easeOut' },
          y: { type: 'spring', stiffness: 90, damping: 18 },
          scale: { type: 'spring', stiffness: 90, damping: 18 }
        }}
      >
        {config.appName}
      </motion.span>
    </div>
  )
}
