import { useEffect, useState } from 'react'
import { api, type JobSummary, type ServiceStatus } from './api'
import type { HistoryEntry } from './history'
import { devFixture } from './devData'

export type ServerState = 'checking' | 'waking' | 'online' | 'offline'

/** One read of GET /api/status: when it answered and how long the answer took. */
export type StatusSample = { at: number; ms: number }

/**
 * Live figures from GET /api/status, re-read every `refreshMs` while the tab is visible and at once
 * when it comes back into view. Each read is timed, and the last `keep` timings are kept, for a
 * chart of how quickly the server answers. `failed` is set when the last read got no answer, so
 * the figures before it may be out of date.
 */
export function useServiceStatus(refreshMs: number, keep = 24) {
  const [status, setStatus] = useState<ServiceStatus | null>(null)
  const [failed, setFailed] = useState(false)
  const [samples, setSamples] = useState<StatusSample[]>([])
  useEffect(() => {
    let cancelled = false
    let busy = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = () => {
      clearTimeout(timer)
      if (busy || document.hidden) return // a hidden tab waits for visibilitychange
      busy = true
      const start = performance.now()
      api
        .status()
        .then((s) => {
          if (cancelled) return
          const sample = { at: Date.now(), ms: performance.now() - start }
          setStatus(s)
          setFailed(false)
          setSamples((list) => [...list, sample].slice(-keep))
        })
        .catch(() => !cancelled && setFailed(true))
        .finally(() => {
          busy = false
          if (!cancelled) timer = setTimeout(load, refreshMs)
        })
    }
    load()
    document.addEventListener('visibilitychange', load)
    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', load)
    }
  }, [refreshMs, keep])
  return { status, failed, samples }
}

/** The free Render instance sleeps when idle; tell the user instead of looking broken. */
export function useServerStatus(): ServerState {
  const [state, setState] = useState<ServerState>('checking')
  useEffect(() => {
    let cancelled = false
    const slow = setTimeout(() => !cancelled && setState('waking'), 2500)
    api
      .health()
      .then(() => !cancelled && setState('online'))
      .catch(() => !cancelled && setState('offline'))
      .finally(() => clearTimeout(slow))
    return () => {
      cancelled = true
      clearTimeout(slow)
    }
  }, [])
  return state
}

/** Verdicts for the jobs this browser remembers, keyed by job id. */
export function useSummaries(entries: HistoryEntry[]) {
  const ids = entries.map((e) => e.jobId).join(',')
  const [data, setData] = useState<Record<string, JobSummary>>({})
  const [loading, setLoading] = useState(entries.length > 0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (devFixture()) return // dev worst-case data: verdicts come from the fixture below
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = () => {
      api
        .jobs(ids ? ids.split(',') : [])
        .then((rows) => {
          if (cancelled) return
          setData(Object.fromEntries(rows.map((r) => [r.job_id, r])))
          setError(null)
          // Keep refreshing while anything is still being analyzed.
          if (rows.some((r) => r.status === 'queued' || r.status === 'running')) {
            timer = setTimeout(load, 2000)
          }
        })
        .catch((e: Error) => !cancelled && setError(e.message))
        .finally(() => !cancelled && setLoading(false))
    }
    load()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [ids])

  const fixture = devFixture()
  if (fixture) return { data: fixture.summaries, loading: false, error: null }
  return { data, loading, error }
}
