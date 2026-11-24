import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { startLiquid, type Liquid } from '../lib/liquid'

/**
 * The overview's centrepiece, where the reference stands its chrome sculpture: a soft form of satin
 * silver, drawn live (lib/liquid.ts), that slowly changes shape and turns as the studio's lights
 * slide over it, floating gently over its shadow on the glass. While verdicts load it moves faster.
 * It holds still for reduced motion, and where WebGL can't draw it the still render
 * (public/hero-form.webp) stands in.
 */
export function HeroForm({ busy = false, className = '' }: { busy?: boolean; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const liquid = useRef<Liquid | null>(null)
  const [still, setStill] = useState(false)

  useLayoutEffect(() => {
    const el = canvas.current
    if (!el) return
    const live = startLiquid(el, () => setStill(true))
    if (!live) {
      setStill(true)
      return
    }
    liquid.current = live
    return () => {
      live.stop()
      liquid.current = null
    }
  }, [])
  useEffect(() => liquid.current?.setBusy(busy), [busy])

  return (
    <div className={`hero-form relative ${className}`} data-busy={busy} data-live={!still} aria-hidden>
      <span className="hero-form-shadow" />
      {still ? (
        <img src="/hero-form.webp" alt="" width={675} height={574} decoding="async" draggable={false} className="hero-form-img relative block h-auto w-full select-none" />
      ) : (
        // the canvas runs past the form's box on every side, so its lobes have room to swell
        <span className="relative block aspect-[675/574] w-full">
          <canvas ref={canvas} className="hero-form-img absolute top-[-15%] left-[-15%] h-[130%] w-[130%]" />
        </span>
      )}
    </div>
  )
}
