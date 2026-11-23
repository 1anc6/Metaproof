import { usePrefs, type ThemePref } from './prefs'
import { useLayoutEffect, useSyncExternalStore } from 'react'

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
