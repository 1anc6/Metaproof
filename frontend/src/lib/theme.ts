import { setPref, usePrefs, type ThemePref } from './prefs'
import { useLayoutEffect, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

// The theme lives on <html data-theme>, which the CSS keys its colour tokens off. index.html sets
// it before first paint from the same stored preference, so there is no flash of the wrong theme.
const dark = window.matchMedia('(prefers-color-scheme: dark)')

const CANVAS = { light: '#efefed', dark: '#0d0e0e' } as const

export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  return pref === 'system' ? (dark.matches ? 'dark' : 'light') : pref
}

function apply(pref: ThemePref) {
  const theme = resolveTheme(pref)
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CANVAS[theme])
}

/**
 * Picks a theme, after the reference: the new theme grows over the old as a circle from the
 * control that was pressed (`from`), until it covers the screen. A View Transition holds a picture
 * of the old screen while the new one is drawn, and the new one is revealed through a growing
 * clip. Where the browser has no View Transitions, motion is reduced, or the screen would not
 * change (System while the OS already matches), the theme just changes.
 */
export function switchTheme(pref: ThemePref, from?: Element | null) {
  const change = () => {
    // draw the new theme now, inside the transition, not on React's next frame
    flushSync(() => setPref('theme', pref))
    apply(pref)
  }
  const same = document.documentElement.dataset.theme === resolveTheme(pref)
  if (same || !document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    change()
    return
  }
  const box = from?.getBoundingClientRect()
  const x = box ? box.left + box.width / 2 : innerWidth - 48
  const y = box ? box.top + box.height / 2 : 48
  // far enough to reach the screen's farthest corner
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  const shift = document.startViewTransition(change)
  shift.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 750, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' },
      )
    })
    .catch(() => {}) // skipped (another transition began): the theme has still changed
}

/** The theme on screen, light or dark, for drawing that has to pick its own ink (the orbs). */
export function useResolvedTheme(): 'light' | 'dark' {
  const { theme } = usePrefs()
  const systemDark = useSyncExternalStore(
    (l) => {
      dark.addEventListener('change', l)
      return () => dark.removeEventListener('change', l)
    },
    () => dark.matches,
  )
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
}

/** Keeps <html data-theme> in step with the preference and, on "system", with the OS. */
export function useThemeSync() {
  const { theme } = usePrefs()
  const systemDark = useSyncExternalStore(
    (l) => {
      dark.addEventListener('change', l)
      return () => dark.removeEventListener('change', l)
    },
    () => dark.matches,
  )
  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
  useLayoutEffect(() => apply(theme), [theme, resolved])
  return resolved
}
