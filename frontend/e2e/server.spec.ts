import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { mockApi, skipWelcome } from './mock-api'

test.beforeEach(async ({ page }) => {
  await skipWelcome(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test("the sidebar opens the server's usage, read live from the API", async ({ page }) => {
  await mockApi(page, { status: { analyses_24h: 14, failed_24h: 2 } })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Server' }).click()
  await expect(page).toHaveURL(/\/server$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Server usage' })).toBeVisible()

  const figures = page.getByRole('region', { name: 'Figures' })
  await expect(figures.getByText('1.8% of the plan\'s limit')).toBeVisible() // 9.2 of 512 MB
  await expect(figures.getByText('of 512 MB, peak 432 MB')).toBeVisible()
  await expect(figures.getByText('of 500 a day, in the last 24 hours')).toBeVisible()
  await expect(figures.getByText('see the server logs')).toBeVisible()

  const capacity = page.getByRole('region', { name: 'Capacity' })
  await expect(capacity.getByRole('img', { name: '14 of 500 today: 12 finished, 2 failed, 486 left today' })).toBeVisible()
  await expect(capacity.getByRole('img', { name: 'Server memory, MB: Now 262 MB, Peak 432 MB, Limit 512 MB' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Response time' }).getByText(/ms fastest, middle and slowest of \d+ reads?$/)).toBeVisible()

  const details = page.getByRole('region', { name: 'Server details' })
  await expect(details.getByText('v0.4.0')).toBeVisible()
  await expect(details.getByText('Loaded', { exact: true })).toBeVisible()
  await expect(details.getByText('1 day', { exact: true })).toBeVisible()
})

test('Export CSV saves the figures and the response times', async ({ page }) => {
  await mockApi(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/server')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()])
  expect(download.suggestedFilename()).toBe('metaproof-server.csv')
  const csv = await readFile((await download.path())!, 'utf8')
  expect(csv).toContain('figure,value,unit\ndatabase,9.2,MB\n')
  expect(csv).toContain('pipeline version,0.4.0,')
  expect(csv).toMatch(/read at,response time,unit\n\d{4}-\d\d-\d\dT[^,]+,\d+,ms/)
})

test("says so plainly when the server can't be reached", async ({ page }) => {
  await mockApi(page, { status: 'down' })
  await page.goto('/server')
  await expect(page.getByRole('heading', { name: "The server isn't answering" })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeDisabled()
})

test('phones reach the server page from Settings, and nothing is wider than the screen', async ({ page }) => {
  await mockApi(page)
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/settings')
  await page.getByRole('link', { name: 'Server usage' }).click()
  await expect(page).toHaveURL(/\/server$/)
  await expect(page.getByRole('region', { name: 'Storage' })).toBeAttached()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
})
