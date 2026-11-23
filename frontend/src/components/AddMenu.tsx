import { Camera, ClipboardPaste, Clock, Images, Plus, Search, Sparkles, Upload, type LucideIcon } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { DEMO_REPORT_PATH } from '../lib/demo'
import { useHistory } from '../lib/history'
import { ACCEPTED, handOver, imageFromClipboard } from '../lib/upload'

// A file field opens the camera on phones and tablets; elsewhere it would only pick a file again.
const touch = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const EASE = 'cubic-bezier(0.3, 0.7, 0.2, 1)'
const OPEN_MS = 560
const CLOSE_MS = 440

type Stage = 'closed' | 'open' | 'closing'
type Action = 'choose' | 'camera' | 'upload' | 'paste' | 'example' | 'latest' | 'search'

const ACTIONS: { key: Action; icon: LucideIcon; label: string; hint: string }[] = [
  { key: 'choose', icon: Images, label: 'Photo', hint: 'Choose a photo to analyze' },
  touch
    ? { key: 'camera', icon: Camera, label: 'Camera', hint: 'Take a photo to analyze' }
    : { key: 'upload', icon: Upload, label: 'Upload', hint: 'Drop or choose up to 10 images' },
  { key: 'paste', icon: ClipboardPaste, label: 'Paste', hint: 'Analyze an image from the clipboard' },
  { key: 'example', icon: Sparkles, label: 'Example', hint: 'See an example report' },
  { key: 'latest', icon: Clock, label: 'Latest', hint: 'Open your latest analysis' },
  { key: 'search', icon: Search, label: 'Search', hint: 'Search your history' },
]

/** A panel h tall cut to a pill `bar` tall at its foot, `side` in from each side and `lift` up. */
const pill = (h: number, bar: number, side: number, lift = 0) => `inset(${h - bar - lift}px ${side}px ${lift}px ${side}px round ${bar / 2}px)`
const whole = (r: number) => `inset(0px 0px 0px 0px round ${r}px)`

/**
 * The phone bar's +, after the floating tab bar reference: a round glass button beside the bar.
 * Pressed, it swells and its + turns to ×, while the bar blurs, draws in and rises into a panel of
 * six ways in, which comes into focus as it settles; closing runs the other way, the panel sinking
 * back into the bar. A photo picked here goes straight to New analysis, which starts it.
 *
 * `children` is the bar: the panel opens over it, as wide as it is, and the bar is out of reach
 * (inert) while the panel is up.
 */
export function AddMenu({ bar, children }: { bar: RefObject<HTMLElement | null>; children: ReactNode }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const latest = useHistory()[0]
  const [stage, setStage] = useState<Stage>('closed')
  const [openedOn, setOpenedOn] = useState(pathname)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const items = useRef<HTMLDivElement>(null)
  const choose = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  // the bar's layers (its glass, and the tabs on it) while the panel is up, held there and undone
  // once it has sunk back. They move rather than the bar: a bar fading or blurring as a whole would
  // stop its glass frosting the page, which would then show through.
  const held = useRef<Animation[]>([])
  const hold = (...animations: (Animation | undefined)[]) => {
    held.current.forEach((a) => a.cancel())
    held.current = animations.filter((a) => a !== undefined)
  }

  const close = (refocus = false) => {
    setStage((s) => (s === 'open' ? 'closing' : s))
    if (refocus) button.current?.focus()
  }

  // Leaving the screen (N, or the back button) closes it.
  if (stage === 'open' && openedOn !== pathname) {
    setOpenedOn(pathname)
    setStage('closing')
  }

  useLayoutEffect(() => {
    const p = panel.current
    const b = bar.current
    const f = button.current
    b?.toggleAttribute('inert', stage !== 'closed')
    if (!p || !b || stage === 'closed') return
    const w = p.offsetWidth
    const h = p.offsetHeight
    const bh = b.offsetHeight
    const asBar = pill(h, bh, 0)
    const drawnIn = pill(h, bh - 8, w * 0.1, 4)
    const rising = `inset(${h * 0.42}px ${w * 0.06}px 0px ${w * 0.06}px round 34px)`

    const glass = b.querySelector<HTMLElement>(':scope > .dock-glass') ?? undefined
    const tabs = b.querySelector<HTMLElement>(':scope > .dock-items') ?? undefined
    // the bar drawn in, as a transform of the bar: the same pill as `drawnIn`
    const drawn = `scale(0.8, ${((bh - 8) / bh).toFixed(3)})`

    if (stage === 'open') {
      items.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
      if (still()) {
        hold(glass?.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: 'forwards' }), tabs?.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: 'forwards' }))
        return
      }
      // The bar draws in, its tabs blurring away, while the panel comes up over it in the same
      // shape; once the panel has it covered, the bar's glass goes, and the panel rises, swells a
      // little past its size and settles. The bar's glass stays under the panel while the two are
      // one shape, so nothing behind them shows through as the panel comes up.
      hold(
        glass?.animate(
          [
            { transform: 'none', opacity: 1 },
            { transform: drawn, opacity: 1, offset: 0.16 },
            { transform: drawn, opacity: 0, offset: 0.17 },
            { transform: drawn, opacity: 0 },
          ],
          { duration: OPEN_MS, easing: EASE, fill: 'forwards' },
        ),
        tabs?.animate(
          [
            { opacity: 1, filter: 'blur(0px)', transform: 'none' },
            { opacity: 0, filter: 'blur(8px)', transform: drawn, offset: 0.16 },
            { opacity: 0, filter: 'blur(8px)', transform: drawn },
          ],
          { duration: OPEN_MS, easing: EASE, fill: 'forwards' },
        ),
      )
      // (the swell is in the clip and the tiles, not a transform of the panel: Chrome stops a
      // transformed glass frosting what is behind it while it moves)
      p.animate(
        [
          { clipPath: asBar, opacity: 0 },
          { clipPath: drawnIn, opacity: 1, offset: 0.16 },
          { clipPath: rising, opacity: 1, offset: 0.4 },
          { clipPath: whole(30), opacity: 1 },
        ],
        { duration: OPEN_MS, easing: EASE },
      )
      items.current?.animate(
        [
          { opacity: 0, filter: 'blur(12px)', transform: 'translateY(12px) scale(0.92)' },
          { opacity: 0, filter: 'blur(12px)', transform: 'translateY(12px) scale(0.92)', offset: 0.24 },
          { opacity: 1, filter: 'blur(0px)', transform: 'scale(1.03)', offset: 0.7 },
          { opacity: 1, filter: 'blur(0px)', transform: 'none' },
        ],
        { duration: OPEN_MS, easing: EASE },
      )
      // the button swells as it is pressed and settles as ×
      f?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.14)', offset: 0.3 }, { transform: 'scale(0.97)', offset: 0.65 }, { transform: 'scale(1)' }], {
        duration: 460,
        easing: 'ease-out',
      })
      return
    }

    // Closing runs the other way: the panel sinks into the bar's shape drawn in, the bar's glass
    // comes back under it there, and as the two grow back to the bar the panel clears away to show
    // the tabs coming back into focus.
    const done = () => {
      hold()
      setStage('closed')
    }
    if (still()) {
      done()
      return
    }
    const SINK = 'cubic-bezier(0.4, 0, 0.2, 1)'
    items.current?.animate(
      [
        { opacity: 1, filter: 'blur(0px)', transform: 'none' },
        { opacity: 0, filter: 'blur(10px)', transform: 'translateY(8px) scale(0.92)', offset: 0.38 },
        { opacity: 0, filter: 'blur(10px)', transform: 'translateY(8px) scale(0.92)' },
      ],
      { duration: CLOSE_MS, fill: 'forwards' },
    )
    hold(
      glass?.animate(
        [
          { transform: drawn, opacity: 0 },
          { transform: drawn, opacity: 0, offset: 0.61 },
          { transform: drawn, opacity: 1, offset: 0.62 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: CLOSE_MS, easing: SINK, fill: 'forwards' },
      ),
      tabs?.animate(
        [
          { opacity: 0, filter: 'blur(8px)', transform: drawn },
          { opacity: 0, filter: 'blur(8px)', transform: drawn, offset: 0.62 },
          { opacity: 1, filter: 'blur(0px)', transform: 'scale(1.02, 0.98)', offset: 0.88 },
          { opacity: 1, filter: 'none', transform: 'none' },
        ],
        { duration: CLOSE_MS, easing: SINK, fill: 'forwards' },
      ),
    )
    f?.animate([{ transform: 'scale(0.92)' }, { transform: 'scale(1.05)', offset: 0.5 }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' })
    const sink = p.animate(
      [
        { clipPath: whole(30), opacity: 1 },
        { clipPath: rising, opacity: 1, offset: 0.36 },
        { clipPath: drawnIn, opacity: 1, offset: 0.62 },
        { clipPath: asBar, opacity: 0 },
      ],
      { duration: CLOSE_MS, easing: SINK, fill: 'forwards' },
    )
    sink.onfinish = done
    return () => {
      sink.onfinish = null
    }
  }, [stage, bar])

  const go = (file: File) => {
    handOver(file)
    navigate('/new')
  }
  const picked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // the same photo can be picked again
    if (file) go(file)
  }
  const act = async (key: Action) => {
    close()
    if (key === 'choose') choose.current?.click()
    else if (key === 'camera') camera.current?.click()
    else if (key === 'upload') navigate('/new')
    else if (key === 'example') navigate(DEMO_REPORT_PATH)
    else if (key === 'latest') {
      if (latest) navigate(`/analysis/${latest.jobId}`)
    } else if (key === 'search') navigate('/history', { state: { focus: true } })
    else {
      try {
        const file = await imageFromClipboard()
        if (file) go(file)
        else toast('There is no image on the clipboard.')
      } catch {
        toast('This browser did not let MetaProof read the clipboard. Choose a photo instead.')
      }
    }
  }

  return (
    <>
      <div className="relative max-w-[340px] min-w-0 flex-1 basis-0">
        {children}
        {stage !== 'closed' && (
          <>
            {/* a tap anywhere else closes it, without reaching what is underneath */}
            <div className="fixed inset-0" onPointerDown={() => close()} aria-hidden />
            <div
              ref={panel}
              id="add-menu"
              role="group"
              aria-label="New analysis"
              onKeyDown={(e) => e.key === 'Escape' && close(true)}
              onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && e.relatedTarget !== button.current && close()}
              className="dock-glass add-panel absolute inset-x-0 bottom-0 rounded-[30px] p-2.5"
            >
              <div ref={items} className="grid grid-cols-3 gap-2">
                {ACTIONS.map(({ key, icon: Icon, label, hint }) => {
                  const off = key === 'latest' && !latest
                  return (
                    <button key={key} type="button" title={off ? 'Nothing analyzed in this browser yet' : hint} disabled={off} onClick={() => act(key)} className="add-tile">
                      <Icon className="size-[22px]" strokeWidth={1.7} aria-hidden />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <button
        ref={button}
        type="button"
        aria-label="New analysis"
        title={stage === 'open' ? 'Close' : 'New analysis (N)'}
        aria-expanded={stage === 'open'}
        aria-controls="add-menu"
        onClick={() => {
          if (stage === 'closed') {
            setOpenedOn(pathname)
            setStage('open')
          } else if (stage === 'open') close(true)
        }}
        className="dock-glass add-fab relative z-10 grid size-16 shrink-0 place-items-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ring)]"
      >
        <Plus className="add-fab-icon size-[26px]" strokeWidth={1.9} aria-hidden />
      </button>

      <input ref={choose} type="file" accept={ACCEPTED.join(',')} onChange={picked} className="hidden" tabIndex={-1} aria-hidden />
      {touch && <input ref={camera} type="file" accept="image/*" capture="environment" onChange={picked} className="hidden" tabIndex={-1} aria-hidden />}
    </>
  )
}
