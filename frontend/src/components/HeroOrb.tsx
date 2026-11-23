import { useEffect, useRef } from 'react'
import { MODE_DRAWS, resolvePreset, scaleCounts, scaleRadii, type OrbState } from 'thinking-orbs'
import { useResolvedTheme } from '../lib/theme'
import { MetalBezel } from './Metal'

// The library's orbs come at 20, 32 and 64px. The hero's is far larger, so it paints the library's
// own frames on a canvas of its own at the hero's size, with more and larger dots than the 64px
// design so it reads as the same orb up close.
const COUNT = 2.4
const RADII = 1.3

/**
 * The overview's centrepiece, where the reference stands its chrome sculpture: a thinking orb
 * several times its usual size, in a disc of glass with a bezel of liquid metal, over a soft
 * shadow on the panel. Its motion says what MetaProof is doing (`state`). It holds still for
 * reduced motion and stops drawing while it is offscreen or the tab is hidden.
 */
export function HeroOrb({ state, size = 280, className = '' }: { state: OrbState; size?: number; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const dark = useResolvedTheme() === 'dark'

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const inner = Math.round(size * 0.78)
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    el.width = el.height = Math.round(inner * dpr)
    const { mode, speed, opts } = resolvePreset(state, 64)
    const tuned = scaleRadii(scaleCounts(opts, COUNT), RADII)
    const draw = MODE_DRAWS[mode]
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let onScreen = true
    const paint = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, inner, inner)
      draw(ctx, inner, (now / 1000) * speed, dark, tuned)
    }
    const loop = (now: number) => {
      paint(now)
      raf = requestAnimationFrame(loop)
    }
    const run = () => {
      cancelAnimationFrame(raf)
      if (still || !onScreen || document.visibilityState !== 'visible') paint(4000)
      else raf = requestAnimationFrame(loop)
    }
    const seen = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      run()
    })
    seen.observe(el)
    document.addEventListener('visibilitychange', run)
    run()
    return () => {
      cancelAnimationFrame(raf)
      seen.disconnect()
      document.removeEventListener('visibilitychange', run)
    }
  }, [state, size, dark])

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }} aria-hidden>
      {/* the shadow it casts on the panel */}
      <span
        className="absolute left-1/2 -translate-x-1/2 rounded-[50%] blur-[18px]"
        style={{ bottom: -size * 0.1, width: size * 0.62, height: size * 0.12, background: 'var(--hero-shadow)' }}
      />
      <MetalBezel variant="circle" inset={4} />
      <span className="absolute inset-0 grid place-items-center rounded-full" style={{ background: 'var(--hero-disc)', boxShadow: 'var(--orb-rim)' }}>
        <canvas ref={canvas} style={{ width: size * 0.78, height: size * 0.78 }} />
      </span>
    </div>
  )
}
