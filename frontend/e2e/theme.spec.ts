import { expect, test, type Page } from '@playwright/test'
import { mockApi, skipWelcome } from './mock-api'

test.beforeEach(async ({ page }) => {
  await mockApi(page)
  await skipWelcome(page)
})

const theme = (page: Page) => page.locator('html').getAttribute('data-theme')
// A pick changes the theme inside a View Transition, a frame after the click, so wait for it.
const themeIs = (page: Page, value: 'light' | 'dark') => expect(page.locator('html')).toHaveAttribute('data-theme', value)

test('follows the system theme until one is picked, then remembers it', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/settings') // the full theme switch lives in Settings
  expect(await theme(page)).toBe('dark')

  const switcher = page.getByRole('radiogroup', { name: 'Colour theme' }).first()
  await switcher.getByRole('radio', { name: 'Light' }).click()
  await themeIs(page, 'light')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#efefed')

  // Set before first paint on reload, even though the system is still dark.
  await page.reload()
  expect(await theme(page)).toBe('light')

  await switcher.getByRole('radio', { name: 'System' }).click()
  await themeIs(page, 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await themeIs(page, 'light')
})

test('the top bar toggles between light and dark', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await themeIs(page, 'dark')
  await page.getByRole('button', { name: 'Switch to light theme' }).click()
  await themeIs(page, 'light')
})

test('the new theme grows over the old as a circle from the button pressed, unless motion is reduced', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  // the reveal: a growing circle clipping the new screen, centred on the dark button
  const reveal = () =>
    page.evaluate(() =>
      document.getAnimations().flatMap((a) => {
        const effect = a.effect as KeyframeEffect | null
        if (effect?.pseudoElement !== '::view-transition-new(root)') return []
        return effect.getKeyframes().map((k) => String(k.clipPath))
      }),
    )
  const button = page.getByRole('button', { name: 'Dark theme' })
  const box = (await button.boundingBox())!
  await button.click()
  await expect.poll(reveal).toEqual([
    `circle(0px at ${box.x + box.width / 2}px ${box.y + box.height / 2}px)`,
    expect.stringMatching(/^circle\(\d+(\.\d+)?px at /),
  ])
  await themeIs(page, 'dark')
  await expect.poll(reveal).toEqual([]) // done

  // with reduced motion the theme just changes, with no transition at all
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(() => {
    const start = document.startViewTransition.bind(document)
    Object.assign(window, { transitions: 0 })
    document.startViewTransition = (update) => {
      Object.assign(window, { transitions: (window as unknown as { transitions: number }).transitions + 1 })
      return start(update)
    }
  })
  await page.getByRole('button', { name: 'Light theme' }).click()
  await themeIs(page, 'light')
  expect(await page.evaluate(() => (window as unknown as { transitions: number }).transitions)).toBe(0)
})
