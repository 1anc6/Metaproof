import { useCallback, useRef, type ReactNode, type RefObject } from 'react'
import { BEND, MetalBadge, MetalFx, useMetalBend, type MetalFxReflectionTarget } from 'metal-fx'
import { useMetalStill } from '../lib/metal'

// The library playground's own starting point: 90% metal at a 1.6× shader scale.
const STRENGTH = 0.9
const SCALE = 1.6

/**
 * A ring of liquid metal round one button or face, from libraries.dev/metal (metal-fx). The pointer
 * dents it as it passes, and the elements in `reflect` catch its light. The host keeps its own
 * shadows and focus outline. `rootRef` reaches the wrapper, for moving button and ring together.
 *
 * `bezel` stands the ring that many px out from the button, round a sliver of the glass behind it:
 * the metal's chrome reads against the glass, and on a light button a ring at its own edge reads
 * as a grey outline. A negative margin keeps the button's place in the layout.
 */
export function MetalRing({
  variant = 'button',
  bezel = 0,
  reflect,
  rootRef,
  className,
  children,
}: {
  variant?: 'button' | 'circle'
  bezel?: number
  reflect?: MetalFxReflectionTarget[]
  rootRef?: RefObject<HTMLDivElement | null>
  className?: string
  children: ReactNode
}) {
  const still = useMetalStill()
  const own = useRef<HTMLDivElement | null>(null)
  useMetalBend(own, () => BEND)
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      own.current = el
      if (rootRef) rootRef.current = el
    },
    [rootRef],
  )
  // the scale is the pill's; a circle keeps its own proportion to it
  const scale = (variant === 'circle' ? 1.3 / 1.6 : 1) * SCALE
  return (
    <MetalFx
      ref={ref}
      variant={variant}
      preset="chromatic"
      theme="dark"
      strength={STRENGTH}
      shaderScale={scale}
      paused={still}
      innerShadow
      normalizeHostStyles={false}
      reflectionTargets={reflect}
      className={className}
      style={bezel ? { margin: -bezel } : undefined}
    >
      {bezel ? (
        <span className="flex min-w-0 flex-1 rounded-full" style={{ padding: bezel }}>
          {children}
        </span>
      ) : (
        children
      )}
    </MetalFx>
  )
}

/**
 * A ring of liquid metal behind a button or picture, `inset` px out from its edge, rather than
 * wrapped round it. metal-fx paints a whole sheet of metal and leaves the thing it wraps to cover
 * the middle; it also hides that thing until its renderer is ready (and, under `npm run dev`, for
 * good on metal mounted after other metal). So the sheet goes behind as a sibling: place this
 * first in a positioned parent and the content after it, positioned too, so the content covers
 * the sheet and the metal shows only as a ring round it, and the content shows even when the
 * metal can't.
 */
export function MetalBezel({ variant = 'button', inset = 0 }: { variant?: 'button' | 'circle'; inset?: number }) {
  return (
    <span aria-hidden className="pointer-events-none absolute flex" style={{ inset: -inset }}>
      <MetalRing variant={variant} className="flex flex-1">
        <span className="block flex-1 rounded-full" />
      </MetalRing>
    </span>
  )
}

/**
 * "LIVE" on a pill of liquid metal: the library's MetalBadge, the "New" badge on libraries.dev/metal.
 * Its colour and pause come from the shared settings (lib/metal.ts). The pill is for the eye;
 * `label` says the same in words for screen readers (null where words already sit beside it).
 *
 * In development only, React's double-mount leaves metal that appears after other metal blank (the
 * library draws nothing for it); production builds, which mount once, show it. So a badge missing
 * under `npm run dev` beside the phone's + is that, not a fault here.
 */
export function LiveBadge({
  label,
  reflect,
  scale = 1,
  className = '',
}: {
  label: string | null
  reflect?: MetalFxReflectionTarget[]
  scale?: number
  className?: string
}) {
  useMetalStill()
  return (
    <span className={`metal-badge inline-flex shrink-0 ${className}`}>
      <span aria-hidden className="inline-flex">
        <MetalBadge theme="dark" scale={scale} strength={STRENGTH} shaderScale={SCALE} reflectionTargets={reflect}>
          LIVE
        </MetalBadge>
      </span>
      {label && <span className="sr-only">{label}</span>}
    </span>
  )
}
