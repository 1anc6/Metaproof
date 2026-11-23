import { Archive, CalendarClock, CircleAlert, Cpu, Database, Download, Gauge, HardDrive, MemoryStick, ScanSearch, Tag, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ServiceStatus } from '../lib/api'
import { formatWhen } from '../lib/format'
import { useServiceStatus, type StatusSample } from '../lib/hooks'
import { ServerBadge } from '../components/Shell'

/** How often the figures are re-read while this page is open. Memory is read fresh each time; the
 *  database figures come from the server's 10 s cache, so this costs the database nothing more. */
const REFRESH_MS = 5_000
const KEEP = 30 // response times kept for the chart: the last two and a half minutes

const mb = (n: number) => (n >= 100 ? String(Math.round(n)) : n.toFixed(1))
const share = (n: number, of: number) => (of > 0 ? Math.min(1, Math.max(0, n / of)) : 0)
const pct = (s: number) => `${s * 100 < 10 && s > 0 ? (s * 100).toFixed(1) : Math.round(s * 100)}%`
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many)

const DETECTOR: Record<ServiceStatus['detector'], [string, string]> = {
  loaded: ['Loaded', 'in memory, ready'],
  available: ['Available', 'loads with the next analysis'],
  missing: ['Missing', 'verdicts are made without it'],
}

/**
 * The analysis server's figures, after the reference's usage analytics: four figures along the
 * top (storage on ink), then today's capacity and how quickly the server answers, then the
 * server's details and its storage. Everything is read live from GET /api/status; nothing here is
 * per user or per file.
 */
export function Server() {
  const { status, failed, samples } = useServiceStatus(REFRESH_MS, KEEP)
  return (
    <div className="flex flex-col gap-4">
      <header className="mb-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Analysis server</p>
          <h1 className="display mt-3.5 text-[length:clamp(28px,9.2cqi,34px)] leading-[1.06] sm:text-[52px] sm:leading-[1.02]">Server usage</h1>
          <p className="mt-3 text-[14.5px] leading-[1.7] text-pretty text-muted sm:text-[13.5px] sm:leading-normal">Live figures from the API, read every 5 seconds while this page is open.</p>
        </div>
        <button
          type="button"
          disabled={!status}
          onClick={() => status && exportCsv(status, samples)}
          className="btn-ghost h-11 shrink-0 gap-2.5 self-start px-5 text-[14px] sm:self-auto"
        >
          <Download className="size-[18px]" strokeWidth={1.7} /> Export CSV
        </button>
      </header>

      {status ? (
        <>
          {failed && (
            <p className="flex items-center gap-2 text-[13px] text-muted" role="status">
              <CircleAlert className="size-4 text-edited" strokeWidth={1.9} aria-hidden />
              The server isn't answering, so these figures may be out of date.
            </p>
          )}
          <Figures status={status} />
          <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Capacity status={status} />
            <Response samples={samples} />
          </div>
          <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-2">
            <Details status={status} />
            <Storage status={status} />
          </div>
        </>
      ) : failed ? (
        <section className="panel flex flex-col items-start gap-3 rounded-[26px] p-6 sm:p-8">
          <ServerBadge chip />
          <h2 className="text-[22px] font-semibold tracking-[-0.02em]">The server isn't answering</h2>
          <p className="max-w-xl text-[14px] leading-relaxed text-muted">
            It runs on a free instance that sleeps when idle, and can take up to a minute to wake. This page keeps trying every 5 seconds.
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-4" aria-label="Loading server figures">
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 @5xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-[134px] !rounded-[20px]" />
            ))}
          </div>
          <div className="skeleton h-[260px] !rounded-[26px]" />
        </div>
      )}
    </div>
  )
}

/** Storage (on ink), memory, today's analyses and today's failures, after the reference's four. */
function Figures({ status: s }: { status: ServiceStatus }) {
  const memory = s.memory_mb
  return (
    <section aria-label="Figures" className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 @md:gap-4 @5xl:grid-cols-4">
      <Tile
        ink
        icon={Database}
        title="Storage used"
        value={
          <>
            {mb(s.database_mb)} <span className="text-faint">/</span> {s.storage_limit_mb}
            <span className="ml-1.5 text-[15px] text-faint">MB</span>
          </>
        }
        bar={share(s.database_mb, s.storage_limit_mb)}
        note={`${pct(share(s.database_mb, s.storage_limit_mb))} of the plan's limit`}
      />
      <Tile
        icon={MemoryStick}
        title="Memory"
        value={
          memory == null ? (
            '–'
          ) : (
            <>
              {Math.round(memory)}
              <span className="ml-1.5 text-[15px] text-faint">MB</span>
            </>
          )
        }
        note={memory == null ? 'only read on a Linux server' : `of ${s.memory_limit_mb} MB${s.memory_peak_mb != null ? `, peak ${Math.round(s.memory_peak_mb)} MB` : ''}`}
      />
      <Tile icon={ScanSearch} title="Analyses today" value={String(s.analyses_24h)} note={`of ${s.daily_cap} a day, in the last 24 hours`} />
      <Tile icon={TriangleAlert} title="Failed today" value={String(s.failed_24h)} note={s.failed_24h ? 'see the server logs' : 'none in the last 24 hours'} />
    </section>
  )
}

function Tile({ icon: Icon, title, value, note, bar, ink = false }: { icon: LucideIcon; title: string; value: ReactNode; note: string; bar?: number; ink?: boolean }) {
  return (
    <div className={`panel flex min-h-[134px] flex-col rounded-[20px] px-5 py-[18px] ${ink ? 'panel-ink' : 'panel-tile'}`}>
      <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.015em]">
        <Icon className="size-[18px] shrink-0" strokeWidth={1.6} aria-hidden />
        {title}
      </h2>
      <p className="num mt-4 text-[32px] leading-none whitespace-nowrap">{value}</p>
      {bar !== undefined && (
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-[var(--track-bg)]" aria-hidden>
          <div className="animate-grow h-full origin-left rounded-full bg-[var(--color-ink)]" style={{ width: `${Math.max(bar * 100, 1.5)}%` }} />
        </div>
      )}
      <p className="mt-auto pt-3 text-[11.5px] text-faint">{note}</p>
    </div>
  )
}

/** A card's title, an icon before it where the reference has one, and a small outlined chip. */
function CardHead({ id, title, icon: Icon, chip }: { id: string; title: string; icon?: LucideIcon; chip: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2 text-[16px] font-semibold tracking-[-0.015em]">
        {Icon && <Icon className="size-[18px] shrink-0" strokeWidth={1.6} aria-hidden />}
        {title}
      </h2>
      <span className="chip !h-6 shrink-0 !px-2.5 !text-[11px] text-muted">{chip}</span>
    </div>
  )
}

/**
 * Today against the daily cap, after the reference's credits by model: a ring split into the
 * analyses that finished, those that failed and those left, beside its legend, and the server's
 * memory now, at its peak and at the instance's limit as columns.
 */
function Capacity({ status: s }: { status: ServiceStatus }) {
  const failed = Math.min(s.failed_24h, s.analyses_24h)
  const finished = s.analyses_24h - failed
  const left = Math.max(0, s.daily_cap - s.analyses_24h)
  const parts = [
    { name: 'Finished', value: finished, color: 'var(--color-ink)' },
    { name: 'Failed', value: failed, color: 'color-mix(in srgb, var(--color-ink) 55%, transparent)' },
    { name: 'Left today', value: left, color: 'var(--meter-bg)' },
  ]
  const memory =
    s.memory_mb != null && s.memory_peak_mb != null
      ? [
          { name: 'Now', value: s.memory_mb },
          { name: 'Peak', value: s.memory_peak_mb },
          { name: 'Limit', value: s.memory_limit_mb },
        ]
      : null
  return (
    <section aria-labelledby="capacity-title" className="panel @container flex flex-col rounded-[26px] p-5 sm:p-6">
      <CardHead id="capacity-title" title="Capacity" chip="Last 24 hours" />
      <div className="mt-6 grid flex-1 grid-cols-1 items-center gap-8 @lg:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex items-center gap-5">
          <Donut parts={parts} total={s.daily_cap} figure={String(s.analyses_24h)} caption={`of ${s.daily_cap} today`} />
          <ul className="flex flex-col gap-2.5">
            {parts.map((p) => (
              <li key={p.name} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 text-[12.5px]">
                <span className="mt-[5px] size-2 rounded-full" style={{ background: p.color, boxShadow: 'inset 0 0 0 1px var(--color-line)' }} aria-hidden />
                <span className="flex flex-col leading-tight">
                  <span className="text-muted">{p.name}</span>
                  <span className="font-semibold tabular-nums">
                    {p.value} · {pct(share(p.value, s.daily_cap))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        {memory ? (
          <Columns label="Server memory, MB" items={memory} top={s.memory_limit_mb} unit="MB" />
        ) : (
          <p className="text-[13px] text-faint">Memory is only read on a Linux server.</p>
        )}
      </div>
    </section>
  )
}

/** A thick ring of parts, drawn clockwise from the top, with a white disc in its middle. */
function Donut({ parts, total, figure, caption }: { parts: { name: string; value: number; color: string }[]; total: number; figure: string; caption: string }) {
  const r = 38
  const lens = parts.map((p) => (total ? p.value / total : 0))
  const starts = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0))
  return (
    <div
      className="relative size-[132px] shrink-0"
      role="img"
      aria-label={`${figure} ${caption}: ${parts.map((p) => `${p.value} ${p.name.toLowerCase()}`).join(', ')}`}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--meter-bg)" strokeWidth="20" />
        {parts.map((p, i) =>
          lens[i] > 0 ? (
            <circle
              key={p.name}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={p.color}
              strokeWidth="20"
              pathLength={1}
              strokeDasharray={`${lens[i]} 1`}
              strokeDashoffset={-starts[i]}
              className="dial-arc"
            />
          ) : null,
        )}
      </svg>
      <span className="absolute inset-[26px] grid place-items-center rounded-full bg-[var(--card-bg)] text-center shadow-[var(--card-edge)]" aria-hidden>
        <span>
          <span className="num block text-[20px] leading-none font-semibold">{figure}</span>
          <span className="mt-1 block text-[10px] leading-tight text-faint">{caption}</span>
        </span>
      </span>
    </div>
  )
}

/** Columns with their figure above and their name below, after the reference's weekly columns. */
function Columns({ label, items, top, unit, shades = false }: { label: string; items: { name: string; value: number }[]; top: number; unit: string; shades?: boolean }) {
  return (
    <figure className="min-w-0">
      <div className="flex h-[150px] items-end justify-around gap-3 border-b border-[var(--color-line)]" role="img" aria-label={`${label}: ${items.map((i) => `${i.name} ${mb(i.value)} ${unit}`).join(', ')}`}>
        {items.map((it, i) => (
          <div key={it.name} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2" aria-hidden>
            <span className="text-[13px] font-semibold tabular-nums">{mb(it.value)}</span>
            <span
              className="animate-lift block w-full max-w-[52px] origin-bottom rounded-t-[8px] rounded-b-[3px]"
              style={{
                height: `max(${share(it.value, top) * 108}px, 4px)`,
                background: shades ? `color-mix(in srgb, var(--color-ink) ${100 - i * 28}%, transparent)` : 'var(--color-ink)',
                animationDelay: `${i * 60}ms`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-around gap-3" aria-hidden>
        {items.map((it) => (
          <span key={it.name} className="min-w-0 flex-1 text-center text-[12px] text-muted">
            {it.name}
          </span>
        ))}
      </div>
      <figcaption className="mt-3 text-[11.5px] text-faint">{label}</figcaption>
    </figure>
  )
}

/** Round the axis up to a clean top with four steps. */
function axis(max: number) {
  const step = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].find((s) => Math.ceil(max / s) <= 4) ?? 10_000
  const top = Math.max(step * 4, Math.ceil(max / step) * step)
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) }
}

const clock = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })

/**
 * How long the server takes to answer, read by read, after the reference's tokens by week: a line
 * over a shaded area on a dashed grid, the times along the foot and the fastest, middle and
 * slowest read under it. It fills in while the page is open.
 */
function Response({ samples }: { samples: StatusSample[] }) {
  const n = samples.length
  const sorted = samples.map((s) => s.ms).sort((a, b) => a - b)
  const median = n ? sorted[Math.floor((n - 1) / 2)] : 0
  const { top, ticks } = axis(n ? sorted[n - 1] : 100)
  const H = 150
  const pts = samples.map((s, i) => ({ x: n === 1 ? 50 : (i / (n - 1)) * 100, y: H - (s.ms / top) * H }))
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
  // the reads marked with a dot and a time: the first, the last and two between, each once
  const marks = [...new Set(n > 1 ? [0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1] : [0])]
  return (
    <section aria-labelledby="response-title" className="panel flex flex-col rounded-[26px] p-5 sm:p-6">
      <CardHead id="response-title" title="Response time" icon={Gauge} chip="Live" />
      <div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3" aria-hidden>
        <div className="relative w-9 text-right text-[11px] text-faint tabular-nums" style={{ height: H }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2 leading-none" style={{ bottom: `${(t / top) * 100}%` }}>
              {t}
            </span>
          ))}
        </div>
        <div className="relative" style={{ height: H }}>
          <svg className="absolute inset-0 size-full overflow-visible">
            {ticks.map((t) => (
              <line key={t} x1="0" x2="100%" y1={`${100 - (t / top) * 100}%`} y2={`${100 - (t / top) * 100}%`} stroke="var(--grid-dot)" strokeWidth={1} strokeDasharray="3 4" />
            ))}
          </svg>
          {n > 0 && (
            <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
              {n > 1 && <path d={`${line} L100,${H} L0,${H} Z`} fill="color-mix(in srgb, var(--color-ink) 9%, transparent)" />}
              <path d={n > 1 ? line : `M0,${pts[0].y} L100,${pts[0].y}`} fill="none" stroke="var(--trail-line)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          )}
          {marks.map((i) => {
            const p = pts[i]
            if (!p) return null
            return (
              <span
                key={samples[i].at}
                className="absolute size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--knob-fill)]"
                style={{ left: `${p.x}%`, top: p.y, boxShadow: 'inset 0 0 0 2px var(--trail-line)' }}
              />
            )
          })}
        </div>
        <span />
        {/* four times need about 320px; narrower, only the first and the last are shown */}
        <div className="@container relative mt-2 h-4 text-[11px] text-faint">
          {marks.map((i) =>
            samples[i] ? (
              <span key={samples[i].at} className={`absolute whitespace-nowrap ${i === 0 ? 'left-0' : i === n - 1 ? 'right-0' : '-translate-x-1/2 @max-[20rem]:hidden'}`} style={i === 0 || i === n - 1 ? undefined : { left: `${pts[i].x}%` }}>
                {clock(samples[i].at)}
              </span>
            ) : null,
          )}
        </div>
      </div>
      <p className="mt-auto pt-5 text-[12.5px] text-muted" aria-live="polite">
        {n === 0
          ? 'Timing the first read…'
          : `${Math.round(sorted[0])} · ${Math.round(median)} · ${Math.round(sorted[n - 1])} ms fastest, middle and slowest of ${n} ${plural(n, 'read')}`}
      </p>
    </section>
  )
}

/** The server's details as a list, after the reference's member usage: an icon on a disc, a name,
 *  and the value on the right with a word under it. */
function Details({ status: s }: { status: ServiceStatus }) {
  const [detector, detectorNote] = DETECTOR[s.detector]
  const rows: { icon: LucideIcon; name: string; value: string; note: string }[] = [
    { icon: Cpu, name: 'AI detector', value: detector, note: detectorNote },
    { icon: Tag, name: 'Pipeline version', value: s.pipeline_version, note: 'checks and rules' },
    { icon: Archive, name: 'Reports kept for', value: `${s.retention_days} ${plural(s.retention_days, 'day')}`, note: 'after the last analysis' },
    { icon: CalendarClock, name: 'Last analysis', value: s.last_analysis_at ? formatWhen(s.last_analysis_at) : 'None yet', note: 'on this server' },
  ]
  return (
    <section aria-labelledby="details-title" className="panel rounded-[26px] p-5 sm:p-6">
      <CardHead id="details-title" title="Server details" chip={`v${s.pipeline_version}`} />
      <ul className="mt-4 flex flex-col">
        {rows.map(({ icon: Icon, name, value, note }) => (
          <li key={name} className="flex items-center gap-3 border-b border-[var(--color-line)] py-3 last:border-b-0">
            <span className="rail-card grid size-9 shrink-0 place-items-center rounded-full text-ink">
              <Icon className="size-4" strokeWidth={1.6} aria-hidden />
            </span>
            <span className="min-w-0 flex-1 text-[13.5px]">{name}</span>
            <span className="flex flex-col items-end text-right leading-tight">
              <span className="text-[13.5px] font-semibold">{value}</span>
              <span className="text-[11.5px] text-faint">{note}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The database against the plan, after the reference's most used prompts: used, where a warning
 *  is logged, and the limit, as columns in falling shades. */
function Storage({ status: s }: { status: ServiceStatus }) {
  return (
    <section aria-labelledby="storage-title" className="panel flex flex-col rounded-[26px] p-5 sm:p-6">
      <CardHead id="storage-title" title="Storage" icon={HardDrive} chip="Database" />
      <div className="mt-5 flex-1">
        <Columns
          shades
          label={`Database size in MB. Reports are deleted ${s.retention_days} ${plural(s.retention_days, 'day')} after an image was last analyzed.`}
          items={[
            { name: 'Used', value: s.database_mb },
            { name: 'Warning at', value: s.storage_warn_mb },
            { name: 'Limit', value: s.storage_limit_mb },
          ]}
          top={s.storage_limit_mb}
          unit="MB"
        />
      </div>
    </section>
  )
}

/** The figures and this visit's response times as CSV, for a spreadsheet. */
function exportCsv(s: ServiceStatus, samples: StatusSample[]) {
  const rows: (string | number | null | undefined)[][] = [
    ['figure', 'value', 'unit'],
    ['database', s.database_mb, 'MB'],
    ['storage warning at', s.storage_warn_mb, 'MB'],
    ['storage limit', s.storage_limit_mb, 'MB'],
    ['memory', s.memory_mb, 'MB'],
    ['memory peak', s.memory_peak_mb, 'MB'],
    ['memory limit', s.memory_limit_mb, 'MB'],
    ['analyses in the last 24 hours', s.analyses_24h, ''],
    ['failed in the last 24 hours', s.failed_24h, ''],
    ['daily cap', s.daily_cap, ''],
    ['reports kept for', s.retention_days, 'days'],
    ['last analysis', s.last_analysis_at, ''],
    ['pipeline version', s.pipeline_version, ''],
    ['AI detector', s.detector, ''],
    [],
    ['read at', 'response time', 'unit'],
    ...samples.map((r) => [new Date(r.at).toISOString(), Math.round(r.ms), 'ms']),
  ]
  const cell = (v: string | number | null | undefined) => {
    const t = v == null ? '' : String(v)
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const csv = rows.map((r) => r.map(cell).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: 'metaproof-server.csv' })
  a.click()
  URL.revokeObjectURL(url)
}
