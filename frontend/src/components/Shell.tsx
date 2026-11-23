import {
  ChevronRight,
  History,
  House,
  ImagePlus,
  Keyboard,
  Laptop,
  Lightbulb,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sun,
  X,
} from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Toaster } from 'sonner'
import type { OrbState } from 'thinking-orbs'
import { useHistory } from '../lib/history'
import { useServerStatus, type ServerState } from '../lib/hooks'
import { useLens } from '../lib/lens'
import { useMetalSettings } from '../lib/metal'
import { setPref, usePrefs } from '../lib/prefs'
import { useThemeSync } from '../lib/theme'
import { AddMenu } from './AddMenu'
import { LiveBadge, MetalBezel } from './Metal'
import { RouteBoundary } from './RouteBoundary'
import { SummariesProvider } from './SummariesProvider'
import { ThinkingOrb } from './ThinkingOrb'
import { Logo, Mark, ThemeToggle } from './ui'

const NAV = [
  { to: '/', label: 'Overview', icon: House, end: true, section: 'Workspace' },
  { to: '/new', label: 'New analysis', icon: ImagePlus, hint: 'N', section: 'Workspace' },
  { to: '/history', label: 'History', icon: History, section: 'Workspace' },
  { to: '/method', label: 'Method', icon: Lightbulb, section: 'Learn' },
  { to: '/settings', label: 'Settings', icon: Settings, section: 'Learn' },
]

/** The current screen's place in `items`, or -1. An analysis belongs to the history it was opened from. */
function current(items: { to: string }[], pathname: string) {
  return items.findIndex(({ to }) =>
    to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`) || (to === '/history' && pathname.startsWith('/analysis/')),
  )
}

const desktop = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)') : null
function useDesktop() {
  return useSyncExternalStore(
    (l) => {
      desktop?.addEventListener('change', l)
      return () => desktop?.removeEventListener('change', l)
    },
    () => desktop?.matches ?? false,
  )
}

/** A field that can take the "/" shortcut: the history list's own search while it is open, else the top bar's. */
const searchField = () =>
  [document.getElementById('history-search'), document.getElementById('global-search'), document.getElementById('overview-search')].find((el) => el?.offsetParent) ?? null

/**
 * The frame of every screen, after the Atelier dashboard reference: a pale grey room lies under
 * everything, with a faint pane of glass in front of it. On a desktop a sidebar card floats down
 * the left, and a top bar with the screen's place, a search and the theme runs over the page.
 * Phones and tablets get a slim top bar and a floating tab bar along the bottom with a polished +
 * for a new analysis.
 */
export function Shell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const theme = useThemeSync()
  const isDesktop = useDesktop()
  const { railOpen } = usePrefs()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const [shortcuts, setShortcuts] = useState(false)

  // Keyboard shortcuts, unless the keystroke is meant for a text field: N starts a new analysis,
  // / searches the history, [ opens or closes the rail, ? lists the shortcuts, Escape closes that list.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement
      if (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
      if (e.key === 'Escape') setShortcuts(false)
      else if (e.key === '?') setShortcuts((open) => !open)
      else if (e.key === '[') setPref('railOpen', !railOpen)
      else if (e.key === '/') {
        e.preventDefault()
        setShortcuts(false)
        const field = searchField()
        if (field) field.focus()
        else navigate('/history', { state: { focus: true } })
      } else if (e.key.toLowerCase() === 'n') {
        setShortcuts(false)
        navigate('/new')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, railOpen])

  useSheen()
  useMetalSettings(theme)

  return (
    <SummariesProvider>
      <div className="min-h-dvh lg:p-4 print:p-0">
        <Room className="backdrop" />
        <a href="#main" className="btn-primary no-print fixed top-3 left-3 z-[60] -translate-y-20 focus-visible:translate-y-0">
          Skip to content
        </a>
        <div className="relative lg:grid lg:min-h-[calc(100dvh-32px)] lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-7 lg:rounded-[40px] lg:p-4 print:block print:p-0">
          <div className="frame-glass" aria-hidden>
            <div className="frame-clip">
              <Room className="backdrop frame-room" />
              <Room className="backdrop frame-room frame-room-frost" />
            </div>
          </div>
          {/* One navigation at a time, so its server check and its links exist once. */}
          {isDesktop && <Rail open={railOpen} onShortcuts={() => setShortcuts((open) => !open)} />}
          <div className="min-w-0 lg:pr-4">
            {isDesktop ? <DeskBar theme={theme} onShortcuts={() => setShortcuts((open) => !open)} /> : <TopBar theme={theme} />}
            <main
              id="main"
              tabIndex={-1}
              className="@container mx-auto w-full max-w-[1280px] px-4 pt-2 pb-[calc(112px+env(safe-area-inset-bottom))] outline-none sm:px-6 lg:px-0 lg:pt-0 lg:pb-6"
            >
              <RouteBoundary pathname={pathname}>
                <Outlet />
              </RouteBoundary>
            </main>
          </div>
        </div>
        {!isDesktop && <Dock />}
        {shortcuts && <Shortcuts onClose={() => setShortcuts(false)} />}
        {/* Bottom centre, clear of the phone bar. */}
        <Toaster theme="dark" position="bottom-center" offset={{ bottom: isDesktop ? 32 : 100 }} mobileOffset={{ bottom: 100 }} />
      </div>
    </SummariesProvider>
  )
}

/** The room's light: four soft spans over its gradient (`.backdrop` in index.css). */
function Room({ className }: { className: string }) {
  return (
    <div className={className} aria-hidden>
      <span />
      <span />
      <span />
      <span />
    </div>
  )
}

/**
 * The light on the glass: the glass card under a mouse pointer gets a soft highlight that follows
 * it (the card's --mx and --my). Not on touch screens, and not when motion is reduced.
 */
function useSheen() {
  useEffect(() => {
    if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let lit: HTMLElement | null = null
    let frame = 0
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const card = (e.target as Element | null)?.closest?.<HTMLElement>('.panel') ?? null
        if (lit && lit !== card) {
          lit.style.removeProperty('--mx')
          lit.style.removeProperty('--my')
        }
        lit = card
        if (!card) return
        const box = card.getBoundingClientRect()
        card.style.setProperty('--mx', `${e.clientX - box.left}px`)
        card.style.setProperty('--my', `${e.clientY - box.top}px`)
      })
    }
    document.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('pointermove', onMove)
    }
  }, [])
}

// While the server is being reached or is waking up, an orb at text size stands in for the dot.
const SERVER_LABEL: Record<ServerState, { text: string; dot: string; orb?: OrbState }> = {
  checking: { text: 'Connecting', dot: 'bg-dot-neutral', orb: 'connecting' },
  waking: { text: 'Waking server…', dot: 'bg-dot-edited', orb: 'breathing' },
  online: { text: 'API online', dot: 'bg-dot-authentic' },
  offline: { text: 'API offline', dot: 'bg-dot-ai' },
}

/** The server's state as a dot `size` across, or an orb centred over the dot's place, so the
 *  words beside it stay put when the server comes online. */
function ServerMark({ state, size }: { state: ServerState; size: string }) {
  const s = SERVER_LABEL[state]
  return (
    <span className={`relative shrink-0 ${size}`} aria-hidden>
      {s.orb ? (
        <ThinkingOrb state={s.orb} size={20} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      ) : (
        <span className={`block size-full rounded-full ${s.dot}`} />
      )}
    </span>
  )
}

/**
 * Live, the server's state is LIVE on a pill of liquid metal; until then an orb or a dot and its
 * words, on a glass chip when `chip`. `compact`: only the orb or dot below 380px, where the words
 * don't fit beside the name.
 */
export function ServerBadge({ compact = false, chip = false }: { compact?: boolean; chip?: boolean }) {
  const state = useServerStatus()
  const s = SERVER_LABEL[state]
  if (state === 'online')
    return (
      <span title={s.text} className="flex">
        <LiveBadge label={s.text} scale={chip ? 1.15 : 1} />
      </span>
    )
  const badge = (
    <span className="flex items-center gap-2 text-[13px] text-muted" title={s.text}>
      <ServerMark state={state} size="size-2" />
      <span className={compact ? 'whitespace-nowrap max-[379px]:sr-only' : 'whitespace-nowrap'}>{s.text}</span>
    </span>
  )
  return chip ? <span className="chip h-10 px-3.5 max-[379px]:w-10 max-[379px]:justify-center max-[379px]:px-0">{badge}</span> : badge
}

/**
 * The sidebar, after the reference's: the name at the top, a card for this browser's history, the
 * one action as an ink pill in a ring of liquid metal, the screens in two sections under a lens of
 * glass, and at the foot the server's state on a card of its own, LIVE in metal once it answers.
 * Folded, only the icons show; their names stay in the page for screen readers.
 */
function Rail({ open, onShortcuts }: { open: boolean; onShortcuts: () => void }) {
  const nav = useRef<HTMLElement>(null)
  const lens = useRef<HTMLSpanElement>(null)
  const { pathname } = useLocation()
  useLens(nav, lens, current(NAV, pathname), 'y')
  const kept = useHistory().length
  const Toggle = open ? PanelLeftClose : PanelLeftOpen
  const toggle = open ? 'Collapse sidebar' : 'Expand sidebar'
  return (
    <aside className="no-print sticky top-8 h-[calc(100dvh-64px)] self-start">
      <div className="rail flex h-full flex-col overflow-hidden rounded-[22px] p-3" data-open={open}>
        <div className="flex h-11 items-center justify-between">
          <Link to="/" aria-label="MetaProof" title={open ? undefined : 'MetaProof, overview'} className="flex items-center gap-2.5 rounded-full px-[13px] text-ink">
            <Mark className="size-[26px] shrink-0" />
            <span translate="no" className="rail-label text-[17px] font-semibold tracking-[-0.03em] whitespace-nowrap">
              MetaProof
            </span>
          </Link>
          {open && (
            <button type="button" onClick={() => setPref('railOpen', false)} aria-label={toggle} title={`${toggle} ([)`} className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-[var(--color-hover)] hover:text-ink">
              <Toggle className="size-[18px]" strokeWidth={1.6} aria-hidden />
            </button>
          )}
        </div>

        {/* where the reference keeps its workspace: this browser, which holds the history */}
        <Link
          to="/history"
          title={open ? undefined : `History: ${kept} kept in this browser`}
          className="row-raise mt-4 flex h-[52px] shrink-0 items-center gap-3 overflow-hidden rounded-[14px] px-2.5 whitespace-nowrap shadow-[var(--btn-edge)]"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[var(--btn-bg)] text-ink shadow-[var(--btn-edge)]">
            <Laptop className="size-4" strokeWidth={1.7} aria-hidden />
          </span>
          <span className="rail-label flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-[13px] font-medium text-ink">This browser</span>
            <span className="text-meta text-faint">
              {kept} {kept === 1 ? 'analysis' : 'analyses'} kept here
            </span>
          </span>
          <ChevronRight className="rail-label size-4 shrink-0 text-faint" strokeWidth={1.8} aria-hidden />
        </Link>

        <div className="relative mt-3 flex">
          <MetalBezel inset={3} />
          <Link to="/new" title="New analysis (N)" className="btn-primary relative h-11 w-full min-w-0 !justify-start gap-2.5 overflow-hidden !px-[17px] text-[14px]">
            <Plus className="size-[18px] shrink-0" strokeWidth={2.2} aria-hidden />
            <span className="rail-label flex-1 text-left">New analysis</span>
            <kbd className="rail-label grid h-6 min-w-6 place-items-center rounded-md bg-[color-mix(in_srgb,var(--pill-ink)_14%,transparent)] px-1.5 text-[11.5px] font-semibold" aria-hidden>
              N
            </kbd>
          </Link>
        </div>

        <nav ref={nav} aria-label="Main" className="relative mt-2 flex flex-col gap-0.5">
          <span ref={lens} className="lens rounded-[14px]" data-axis="y" aria-hidden>
            <span />
          </span>
          {NAV.map((item, i) => (
            <Fragment key={item.to}>
              {item.section !== NAV[i - 1]?.section && (
                <p className="rail-section eyebrow" aria-hidden>
                  <span className="rail-label">{item.section}</span>
                </p>
              )}
              <RailLink {...item} open={open} count={item.to === '/history' ? kept : undefined} />
            </Fragment>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 pt-4">
          <ServerCard open={open} />
          {open ? (
            <button type="button" onClick={onShortcuts} className="rail-item">
              <span className="rail-icon">
                <Keyboard className="size-[18px]" strokeWidth={1.6} aria-hidden />
              </span>
              <span className="rail-label flex-1 text-left">Shortcuts</span>
              <kbd className="kbd rail-label" aria-hidden>
                ?
              </kbd>
            </button>
          ) : (
            <button type="button" onClick={() => setPref('railOpen', true)} aria-label={toggle} title={`${toggle} ([)`} className="rail-item">
              <span className="rail-icon">
                <Toggle className="size-[18px]" strokeWidth={1.6} aria-hidden />
              </span>
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}

function RailLink({ to, label, icon: Icon, end, hint, open, count }: (typeof NAV)[number] & { open: boolean; count?: number }) {
  // An analysis belongs to the history it was opened from.
  const inHistory = useLocation().pathname.startsWith('/analysis/') && to === '/history'
  return (
    <NavLink
      to={to}
      end={end}
      data-lens-item
      title={open ? (hint ? `${label} (${hint})` : undefined) : hint ? `${label} (${hint})` : label}
      className={({ isActive }) => `rail-item ${isActive || inHistory ? 'is-on' : ''}`}
    >
      <span className="rail-icon">
        <Icon className="size-[18px]" strokeWidth={1.6} aria-hidden />
      </span>
      <span className="rail-label min-w-0 flex-1">{label}</span>
      {hint && (
        <kbd className="kbd rail-label" aria-hidden>
          {hint}
        </kbd>
      )}
      {!!count && (
        <span className="rail-label text-meta text-faint tabular-nums" aria-hidden>
          {count}
        </span>
      )}
    </NavLink>
  )
}

/** The server's state on a card at the foot of the sidebar, where the reference shows its credits:
 *  LIVE in metal once it answers, an orb while it is reached or wakes, a dot when it is down. */
function ServerCard({ open }: { open: boolean }) {
  const state = useServerStatus()
  const s = SERVER_LABEL[state]
  return (
    <div
      className={`flex h-[60px] shrink-0 items-center gap-3 overflow-hidden rounded-[16px] whitespace-nowrap ${open ? 'px-3 shadow-[var(--btn-edge)]' : 'justify-center'}`}
      style={open ? { background: 'var(--row-bg)' } : undefined}
      title={open ? undefined : s.text}
    >
      {state === 'online' ? (
        <LiveBadge label={open ? null : s.text} className={open ? '' : '-mx-[10px]'} />
      ) : (
        <span className="grid size-7 shrink-0 place-items-center">
          <ServerMark state={state} size="size-2.5" />
        </span>
      )}
      <span className="rail-label flex min-w-0 flex-col leading-tight">
        <span className="text-[13px] font-medium text-ink">{s.text}</span>
        <span className="text-meta text-faint">Analysis server</span>
      </span>
    </div>
  )
}

/** Which screen is open, as the reference's "Workspace / Dashboard". */
function crumbs(pathname: string): string[] {
  if (pathname.startsWith('/analysis/')) return ['History', 'Analysis']
  if (pathname.startsWith('/report/')) return ['Report']
  const at = current(NAV, pathname)
  return [at >= 0 ? NAV[at].label : 'Not found']
}

/**
 * The desktop's top bar, after the reference's: where you are on the left; a search of the
 * history, light or dark, and the shortcuts on the right, over a hairline that runs the page's width.
 */
function DeskBar({ theme, onShortcuts }: { theme: 'light' | 'dark'; onShortcuts: () => void }) {
  const { pathname } = useLocation()
  const trail = crumbs(pathname)
  return (
    <header className="no-print mb-7 flex h-[72px] items-center justify-between gap-4 border-b border-line">
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex items-center gap-2 text-[13px] whitespace-nowrap">
          <li className="text-faint">
            <Link to="/" className="rounded hover:text-ink">
              MetaProof
            </Link>
          </li>
          {trail.map((c, i) => (
            <Fragment key={c}>
              <li className="text-faint" aria-hidden>
                /
              </li>
              <li className={i === trail.length - 1 ? 'font-medium text-ink' : 'text-faint'} aria-current={i === trail.length - 1 ? 'page' : undefined}>
                {c}
              </li>
            </Fragment>
          ))}
        </ol>
      </nav>
      <div className="flex items-center gap-2.5">
        <TopSearch />
        <div className="track flex gap-0.5 rounded-full p-1" role="group" aria-label="Colour theme">
          {(['light', 'dark'] as const).map((t) => {
            const Icon = t === 'light' ? Sun : Moon
            return (
              <button
                key={t}
                type="button"
                aria-pressed={theme === t}
                aria-label={`${t === 'light' ? 'Light' : 'Dark'} theme`}
                title={`${t === 'light' ? 'Light' : 'Dark'} theme`}
                onClick={() => setPref('theme', t)}
                className={`grid size-8 place-items-center rounded-full transition ${theme === t ? 'selected' : 'text-faint hover:text-ink'}`}
              >
                <Icon className="size-4" strokeWidth={1.7} aria-hidden />
              </button>
            )
          })}
        </div>
        <button type="button" onClick={onShortcuts} className="btn-primary !size-10 !p-0" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
          <Keyboard className="size-[18px]" strokeWidth={1.7} aria-hidden />
        </button>
      </div>
    </header>
  )
}

/** Search by file name: Enter opens History with the words in its search box. Filenames stay in
 *  this browser, so they travel in the router's state and never in the address. */
function TopSearch() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        navigate('/history', { state: { q: q.trim() } })
      }}
    >
      <label className="flex h-10 w-[240px] items-center gap-2.5 rounded-full pr-1.5 pl-3.5 text-faint transition-colors focus-within:bg-[var(--btn-bg)] focus-within:shadow-[var(--btn-edge)] hover:bg-[var(--btn-bg)] xl:w-[280px]">
        <Search className="size-4 shrink-0" strokeWidth={1.8} aria-hidden />
        <input
          id="global-search"
          name="q"
          type="search"
          aria-label="Search history"
          autoComplete="off"
          spellCheck={false}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your history…"
          className="min-w-0 flex-1 self-stretch bg-transparent text-[13.5px] text-ink outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd className="kbd" aria-hidden>
          /
        </kbd>
      </label>
    </form>
  )
}

/** Phones and tablets: the name on the left; the server's state and the theme on the right. */
function TopBar({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <header className="no-print relative z-30 px-4 pt-[env(safe-area-inset-top)] sm:px-6 lg:hidden">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3">
        <Link to="/" className="rounded-full">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <ServerBadge compact chip />
          <ThemeToggle resolved={theme} />
        </div>
      </div>
    </header>
  )
}

/** After a tap, let go of focus so the keyboard focus ring doesn't linger (some Android browsers
 *  keep it); a keyboard activation has `detail` 0 and keeps it. */
const releaseAfterTap = (e: React.MouseEvent<HTMLElement>) => {
  if (e.detail > 0) e.currentTarget.blur()
}

/**
 * The navigation on phones and tablets, after the floating tab bar and iOS references: a glass
 * capsule of four screens where the current one opens out to its name, under a lens of glass that
 * travels between them (press and drag along the bar to carry it, as on iOS), and beside it the
 * polished + in its ring of metal, which opens into a menu for a new analysis.
 */
function Dock() {
  const tabs = NAV.filter((n) => n.to !== '/new')
  const navigate = useNavigate()
  const active = current(tabs, useLocation().pathname)
  const bar = useRef<HTMLDivElement>(null)
  const lensEl = useRef<HTMLSpanElement>(null)
  const lens = useLens(bar, lensEl, active)
  // A press lifts the lens; moving the finger carries it, and letting go opens the tab under it.
  const press = useRef<{ id: number; x: number; carried: boolean } | null>(null)
  const swallowClick = useRef(false)

  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2.5 pr-[max(16px,env(safe-area-inset-right))] pb-[max(12px,env(safe-area-inset-bottom))] pl-[max(16px,env(safe-area-inset-left))] min-[400px]:gap-3 lg:hidden"
      aria-label="Main"
    >
      <div
        ref={bar}
        className="glass dock-bar relative flex h-16 w-full max-w-[360px] min-w-0 touch-none items-center gap-1 rounded-full p-1.5"
        onPointerDown={(e) => {
          if (e.button !== 0) return
          swallowClick.current = false
          press.current = { id: e.pointerId, x: e.clientX, carried: false }
          lens.lift()
        }}
        onPointerMove={(e) => {
          const p = press.current
          if (!p || p.id !== e.pointerId) return
          if (!p.carried) {
            if (Math.abs(e.clientX - p.x) < 8) return
            p.carried = true
            e.currentTarget.setPointerCapture(e.pointerId)
          }
          lens.follow(e.clientX)
        }}
        onPointerUp={(e) => {
          const p = press.current
          press.current = null
          if (!p || p.id !== e.pointerId) return
          if (!p.carried) {
            // a tap: the link navigates; a tap on the current screen just sets the lens down
            if (!(e.target as Element).closest?.('[data-lens-item]:not(.is-on)')) lens.home()
            return
          }
          swallowClick.current = true
          const over = lens.drop()
          if (over >= 0 && over !== active) navigate(tabs[over].to)
          else lens.home()
        }}
        onPointerCancel={() => {
          press.current = null
          lens.home()
        }}
        onClickCapture={(e) => {
          if (!swallowClick.current) return
          swallowClick.current = false
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <span ref={lensEl} className="lens rounded-full" data-axis="x" aria-hidden>
          <span />
        </span>
        {tabs.map((item, i) => (
          <Tab key={item.to} {...item} on={i === active} />
        ))}
      </div>
      {/* the bar beside the + catches a glint of its metal ring */}
      <AddMenu reflect={bar} />
    </nav>
  )
}

/**
 * One screen in the bar. The current one grows to make room for its name; the others shrink to
 * their icon, which keeps its name for screen readers and as a tooltip. The lens supplies the pill.
 */
function Tab({ to, label, icon: Icon, end, on }: (typeof NAV)[number] & { on: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={releaseAfterTap}
      title={label}
      data-lens-item
      draggable={false}
      className={`tab group relative flex h-full min-w-11 basis-0 items-center justify-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] ${
        on ? 'is-on grow-[2.5]' : 'grow'
      }`}
    >
      <span className="relative flex min-w-0 items-center">
        <Icon className="tab-icon size-[22px] shrink-0" strokeWidth={1.7} aria-hidden />
        <span className="tab-label overflow-hidden text-[14.5px] font-semibold whitespace-nowrap">{label}</span>
      </span>
    </NavLink>
  )
}

const SHORTCUTS = [
  ['N', 'New analysis'],
  ['/', 'Search your history'],
  ['[', 'Open or close the sidebar'],
  ['?', 'Show or hide this list'],
  ['Esc', 'Close this list'],
] as const

/** The keyboard shortcuts, as a small dialog. Opened with ?. */
function Shortcuts({ onClose }: { onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    close.current?.focus()
    return () => before?.focus()
  }, [])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--scrim)] p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(e) => e.stopPropagation()}
        className="glass animate-pop w-full max-w-sm rounded-[26px] p-5 sm:p-6"
      >
        <div className="relative flex items-center justify-between">
          <h2 id="shortcuts-title" className="text-[20px] font-semibold tracking-[-0.01em]">
            Keyboard shortcuts
          </h2>
          <button ref={close} type="button" onClick={onClose} className="icon-btn size-9" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <dl className="relative mt-3 flex flex-col">
          {SHORTCUTS.map(([key, what]) => (
            <div key={key} className="flex items-center justify-between py-2.5">
              <dt className="text-[15px] text-muted">{what}</dt>
              <dd>
                <kbd className="kbd h-7 min-w-7 text-[13px] text-ink">{key}</kbd>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
