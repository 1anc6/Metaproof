import { expect, test } from '@playwright/test'
import { job, JOB_ID, mockApi, seedHistory, SHA, skipWelcome } from './mock-api'

test.beforeEach(async ({ page }) => {
  await mockApi(page)
  await skipWelcome(page)
  await page.emulateMedia({ reducedMotion: 'reduce' }) // measure panels at rest, not mid-animation
})

test('logo reads "MetaProof"', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'MetaProof' }).first()).toBeVisible()
})

test("desktop: the sidebar runs the height of the glass window with the screens' names, and folds to its icons", async ({ page }) => {
  for (const width of [1280, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await page.locator('main section').first().waitFor()
    // inside the window's glass: 16px of room round the window, 16px of glass round the sidebar
    const rail = (await page.locator('aside .rail').boundingBox())!
    expect(rail.y).toBe(32)
    expect(rail.height).toBe(900 - 64)
    expect(rail.width).toBe(252)
  }
  await expect(page.getByRole('navigation', { name: 'Main' }).getByText('History')).toBeVisible()

  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect.poll(async () => (await page.locator('aside .rail').boundingBox())!.width).toBe(76)
  // remembered, and [ opens it again
  await page.reload()
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
  await page.locator('body').press('[')
  await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible()
  await expect.poll(async () => (await page.locator('aside .rail').boundingBox())!.width).toBe(252)
})

test('desktop: the first two cards fit the first screen whole, the page scrolls without a scrollbar, and the sidebar has one fold control at the top', async ({ page }) => {
  await seedHistory(page)
  for (const [width, height] of [
    [1279, 676],
    [1366, 657],
    [1920, 1000],
  ]) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    const hero = page.getByRole('region', { name: 'Analyze an image' })
    const latest = page.getByRole('region', { name: 'Latest analysis' })
    await latest.waitFor()
    for (const card of [hero, latest]) {
      const box = (await card.boundingBox())!
      expect(box.y + box.height, `${width}x${height}`).toBeLessThanOrEqual(height - 16)
      // nothing in the card is cut off to make it fit
      expect(await card.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1)
    }
  }
  // the window runs on down the page, which scrolls as a whole, with no scrollbar down its side
  expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(true)
  expect(await page.evaluate(() => innerWidth - document.documentElement.clientWidth)).toBe(0)
  // the sidebar is the screens and the server: the fold control sits by the name, open or folded
  const rail = (await page.locator('aside .rail').boundingBox())!
  for (const name of ['Collapse sidebar', 'Expand sidebar']) {
    const toggle = page.getByRole('button', { name })
    expect((await toggle.boundingBox())!.y - rail.y).toBeLessThan(110)
    await toggle.click()
  }
  await expect(page.locator('aside').getByRole('link', { name: /New analysis/ })).toHaveCount(1) // the screen, no second pill
  // no shortcut buttons, and the top bar keeps only the search and the theme
  await expect(page.getByRole('button', { name: 'Keyboard shortcuts' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Settings' })).toHaveCount(1)
})

test('phones and tablets: a floating tab bar of four screens as icons, with New analysis floating beside it', async ({ page }) => {
  for (const width of [360, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav.getByRole('link')).toHaveCount(4) // four screens; the + is a button that opens a menu
    // icons only: each screen keeps its name for screen readers and as a tooltip
    const current = nav.getByRole('link', { name: 'Overview' })
    await expect(current).toHaveAttribute('aria-current', 'page')
    await expect(current).toHaveAttribute('title', 'Overview')
    await expect(nav.getByRole('link', { name: 'Settings' })).toBeVisible()
    // the + floats to the right of the bar, as tall as it, and the pair sits centred with equal margins
    const bar = (await nav.locator('.dock-bar').boundingBox())!
    const plus = (await nav.getByRole('button', { name: 'New analysis' }).boundingBox())!
    expect(plus.x).toBeGreaterThan(bar.x + bar.width)
    expect(Math.round(plus.height)).toBe(Math.round(bar.height))
    expect(Math.abs(bar.x - (width - plus.x - plus.width))).toBeLessThanOrEqual(1)
    // the four share the bar equally, and each is big enough to hit with a thumb
    const widths: number[] = []
    for (const tab of await nav.locator('.tab').all()) {
      const box = (await tab.boundingBox())!
      widths.push(box.width)
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1)
  }
})

test('phones: no screen is wider than the phone, down to 320px', async ({ page }) => {
  await seedHistory(page)
  // an analysis under way: the screen that ran off the side of phones
  await page.route(`**/api/analyses/${JOB_ID}`, (route) =>
    route.fulfill({ json: { ...job, status: 'running', verdict: null, current_step: 'watermark' } }),
  )
  const screens: [string, string][] = [
    ['/', 'Your images'],
    ['/new', 'For the clearest verdict'],
    [`/analysis/${JOB_ID}`, 'Looking for invisible watermarks…'],
    [`/report/${SHA}`, 'Key findings'],
    ['/history', 'holiday.jpg'],
    ['/method', 'Six independent checks'],
    ['/settings', 'Privacy and data'],
  ]
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 800 })
    for (const [path, text] of screens) {
      await page.goto(path)
      await expect(page.getByText(text).first()).toBeVisible()
      const wide = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(wide, `${path} at ${width}px`).toBeLessThanOrEqual(width)
    }
  }
})

test('phones: choosing a tab makes it the current screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Main' })
  await nav.getByRole('link', { name: 'History' }).click()
  await expect(page).toHaveURL(/\/history$/)
  await expect(nav.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current', 'page')
})

test('desktop: the navigation sits in the sidebar, and nothing floats over the page', async ({ page }) => {
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 700 })
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav).toHaveCount(1) // the phone bar is gone at this width
    await expect(nav.getByRole('link')).toHaveCount(6)
    expect((await nav.boundingBox())!.x).toBeLessThan(300)
    await expect(nav.getByRole('link', { name: 'New analysis' })).toBeVisible()
    // the app opens on the overview, not a landing page
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('searchbox', { name: 'Search history' })).toBeInViewport()
  }
})

test('phones: the hero card shows whole above the tab bar on landing', async ({ page }) => {
  await seedHistory(page)
  for (const [width, height] of [
    [360, 660],
    [368, 701],
    [390, 750],
    [412, 780],
  ]) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    const card = page.getByRole('region', { name: 'Analyze an image' })
    const hero = (await card.boundingBox())!
    const bar = (await page.locator('.dock-bar').boundingBox())!
    expect(hero.y + hero.height, `${width}x${height}`).toBeLessThanOrEqual(bar.y - 8)
    await expect(card.getByRole('link', { name: /Flagged/ })).toBeInViewport({ ratio: 1 })
  }
})

test('phones: the overview opens with the period, a new analysis, the way in and the latest verdict above the fold', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('group', { name: 'Period' })).toBeInViewport()
  await expect(page.locator('main header').getByRole('link', { name: 'New analysis' })).toBeInViewport()
  await expect(page.getByRole('link', { name: 'Analyze an image' })).toBeInViewport()
  await expect(page.getByRole('region', { name: 'Latest analysis' })).toBeInViewport()
})

test('phones: every screen opens under the top bar, a hairline beneath it, with the search, light or dark and the server', async ({ page }) => {
  await seedHistory(page)
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of ['/', '/new', '/history', '/method', '/settings', '/server', `/report/${SHA}`]) {
    await page.goto(path)
    const bar = page.getByRole('banner')
    await expect(bar.getByRole('link', { name: 'MetaProof' })).toBeVisible()
    await expect(bar.getByRole('button', { name: 'Search history' })).toBeVisible()
    await expect(bar.getByRole('group', { name: 'Colour theme' })).toBeVisible()
    await expect(bar.getByTitle('API online')).toBeVisible()
    const line = await bar.locator('> div').evaluate((el) => {
      const style = getComputedStyle(el)
      return [style.borderBottomWidth, style.borderBottomStyle]
    })
    expect(line, path).toEqual(['1px', 'solid'])
    // the page starts with room under the line, at the same margins as the bar
    const under = (await bar.boundingBox())!
    const first = (await page.locator('main > *').first().boundingBox())!
    expect(first.y - (under.y + under.height), path).toBeGreaterThanOrEqual(20)
    expect(first.x, path).toBe(20)
  }
  // on a screen without the history's search, the bar's opens History ready to type
  await page.goto('/')
  await page.getByRole('banner').getByRole('button', { name: 'Search history' }).click()
  await expect(page).toHaveURL(/\/history$/)
  await expect(page.getByRole('searchbox', { name: 'Search by filename' })).toBeFocused()
})

