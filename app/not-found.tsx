import Link from 'next/link'
import { Button } from '@/components/ui/button'

// Server component on purpose: the root not-found boundary is bundled
// into every route's baseline, so an animation library here would ship
// on every page of the app. CSS animations (tw-animate-css) are free.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="animate-in fade-in slide-in-from-top-4 relative duration-500 select-none">
        <span className="text-muted-foreground/10 text-[12rem] leading-none font-black tracking-tighter">
          404
        </span>
        <div className="animate-in fade-in zoom-in-90 fill-mode-backwards absolute inset-0 flex items-center justify-center delay-200 duration-500">
          <span className="text-foreground text-5xl font-bold">404</span>
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards mt-2 space-y-3 text-center delay-300 duration-500">
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="text-muted-foreground text-sm">
          The page you are looking for does not exist or has been moved
        </p>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards mt-8 delay-500 duration-500">
        <Button asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
