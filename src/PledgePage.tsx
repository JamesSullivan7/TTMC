import { useEffect, useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import { BRAND, CHALLENGE_NAME, CHALLENGE_WINDOW, GOAL, fmt } from './config'
import { getTrainerKey } from './keys'

// The pre-season board for the gym TV. Before September there is nothing to
// show on a map, so the screen earns its place a different way: it turns
// signing up into the thing everyone can see happening.
//
// Sorted newest first on purpose. Scan the code, claim your meters, and your
// name is at the top of the gym screen within seconds — which is the whole
// reason anyone bothers to do it while they are standing there.

const PAGE_SIZE = 32
const PAGE_MS = 9000

function Countdown({ start }: { start: Date }) {
  // Its own state so the ticking clock does not re-render the roll of names
  // underneath it every second.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const ms = start.getTime() - now
  if (ms <= 0) {
    return (
      <div className="font-display uppercase leading-none" style={{ fontSize: 'clamp(2rem, 4.5vw, 4rem)', color: BRAND.red }}>
        Under way
      </div>
    )
  }
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)

  const parts: [number, string][] = d > 0 ? [[d, 'days'], [h, 'hrs'], [m, 'min']] : [[h, 'hrs'], [m, 'min'], [s, 'sec']]
  return (
    <div className="flex items-end gap-4 justify-end">
      {parts.map(([val, unit]) => (
        <div key={unit} className="text-right">
          <div className="font-display leading-none tabular-nums" style={{ fontSize: 'clamp(1.8rem, 3.4vw, 3.2rem)' }}>
            {String(val).padStart(2, '0')}
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mt-1">{unit}</div>
        </div>
      ))}
    </div>
  )
}

export default function PledgePage() {
  const roster = useQuery(api.people.listPeople)
  // Roster entries imported from the member list sit at 0 until their owner
  // pledges. Nobody goes on the TV having committed to nothing.
  const people = useMemo(() => (roster ?? []).filter((p) => p.pledgeMeters > 0), [roster])
  const trainerKey = getTrainerKey()
  // Only used to fold the log token into the QR, so one scan sets a phone up
  // to both pledge now and log meters in September. The board works fine
  // without it — pledging needs no token.
  const logToken = useQuery(api.worldTour.getLogToken, trainerKey ? { key: trainerKey } : 'skip')

  const [qr, setQr] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  const joinUrl = useMemo(() => {
    const base = `${window.location.origin}/join`
    return logToken ? `${base}?t=${encodeURIComponent(logToken)}` : base
  }, [logToken])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const QR = await import('qrcode')
        const url = await QR.toDataURL(joinUrl, {
          width: 900,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#050505', light: '#ffffff' },
        })
        if (!cancelled) setQr(url)
      } catch {
        /* the board is still useful without it */
      }
    })()
    return () => { cancelled = true }
  }, [joinUrl])

  const totalPledged = people.reduce((s, p) => s + p.pledgeMeters, 0)
  const remaining = Math.max(0, GOAL - totalPledged)
  const pct = Math.min(100, (totalPledged / GOAL) * 100)
  const pageCount = Math.max(1, Math.ceil(people.length / PAGE_SIZE))

  useEffect(() => {
    if (pageCount <= 1) return
    const t = setInterval(() => setPage((p) => (p + 1) % pageCount), PAGE_MS)
    return () => clearInterval(t)
  }, [pageCount])

  const shown = people.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="relative shrink-0" style={{ borderBottom: '1px solid #171717' }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 140% at 50% 0%, rgba(217,59,88,0.16) 0%, transparent 70%)' }}
        />
        <div className="relative flex items-center justify-between px-8 py-3">
          <div className="flex items-center gap-4">
            <img
              src="/logo-t.png"
              alt=""
              className="w-24 h-24 rounded-full"
              style={{ border: `3px solid ${BRAND.darkRed}`, boxShadow: `0 0 24px ${BRAND.darkRed}55` }}
            />
            <div>
              <div className="text-sm font-black tracking-[0.4em] uppercase" style={{ color: BRAND.red }}>
                Tulsa Training
              </div>
              <div className="font-display text-4xl uppercase tracking-wide leading-none mt-0.5">{CHALLENGE_NAME}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.35em] mb-1.5" style={{ color: BRAND.pink }}>
              {CHALLENGE_WINDOW
                ? `Starts ${CHALLENGE_WINDOW.start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
                : 'Starting soon'}
            </div>
            {CHALLENGE_WINDOW && <Countdown start={CHALLENGE_WINDOW.start} />}
          </div>
        </div>
      </div>

      {/* Say what this is. Somebody walking past has never heard of any of it,
          and a screen that needs a trainer standing next to it explaining the
          QR code is a screen that does not work. */}
      <div
        className="shrink-0 px-8 py-3 text-center"
        style={{ borderBottom: '1px solid #141414', background: '#0a0a0d' }}
      >
        <div className="font-display uppercase leading-none" style={{ fontSize: 'clamp(1.2rem, 2.2vw, 1.9rem)' }}>
          This September the whole gym drives one road together
        </div>
        <div className="mt-2 text-base text-zinc-400">
          Tulsa <span style={{ color: BRAND.red }}>→</span> Los Angeles{' '}
          <span style={{ color: BRAND.red }}>→</span> New York{' '}
          <span style={{ color: BRAND.red }}>→</span> Tulsa ·{' '}
          <span className="text-white font-bold">{fmt(GOAL)} meters</span> · every meter you row,
          ski, bike or run moves us down the road
        </div>
      </div>

      {/* Pledged so far, and the code to join it */}
      <div className="flex items-stretch gap-8 px-8 py-4 shrink-0">
        {/* The pledge total as a column that fills from the bottom. It reads
            as a level rising rather than a task completing, which is the right
            feeling for something people are still being asked to join. */}
        <div className="shrink-0 flex flex-col items-center">
          <div className="text-[10px] font-black tabular-nums mb-2" style={{ color: BRAND.pink }}>
            {pct < 1 && pct > 0 ? '<1' : Math.round(pct)}%
          </div>
          <div className="relative w-10 flex-1 rounded-full overflow-hidden" style={{ background: '#161616' }}>
            <div
              className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-1000"
              style={{
                height: `${pct}%`,
                background: `linear-gradient(0deg, ${BRAND.darkRed}, ${BRAND.red}, ${BRAND.pink})`,
                boxShadow: `0 0 22px ${BRAND.red}77`,
              }}
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-xs font-black uppercase tracking-[0.35em]" style={{ color: BRAND.pink }}>
            Pledged so far
          </div>
          <div className="font-display leading-none tabular-nums mt-1" style={{ fontSize: 'clamp(3rem, 6.5vw, 6rem)' }}>
            {fmt(totalPledged)}
          </div>
          <div className="text-zinc-400 text-base mt-1">
            of <span className="text-white font-bold">{fmt(GOAL)}</span> meters
          </div>

          <div className="mt-4 flex items-baseline gap-6">
            {remaining > 0 ? (
              <>
                <div>
                  <div className="font-display uppercase leading-none" style={{ fontSize: 'clamp(1.6rem, 3.4vw, 3rem)', color: BRAND.red }}>
                    {fmt(remaining)}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mt-1">still to pledge</div>
                </div>
                <div>
                  <div className="font-display uppercase leading-none" style={{ fontSize: 'clamp(1.6rem, 3.4vw, 3rem)' }}>
                    {people.length}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mt-1">
                    {people.length === 1 ? 'person in' : 'people in'}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <div className="font-display uppercase leading-none" style={{ fontSize: 'clamp(1.8rem, 4vw, 3.4rem)', color: '#10B981' }}>
                  The whole road is pledged
                </div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mt-1.5">
                  {people.length} people · anything more is a head start
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scan to join */}
        <div className="shrink-0 text-center rounded-2xl px-6 py-4 flex flex-col justify-center" style={{ background: '#0d0d0d', border: `2px solid ${BRAND.darkRed}` }}>
          {qr ? (
            <img src={qr} alt="Scan to pledge your meters" className="w-44 h-44 rounded-lg mx-auto" />
          ) : (
            <div className="w-44 h-44 rounded-lg mx-auto" style={{ background: '#161616' }} />
          )}
          <div className="font-display uppercase text-xl mt-3 leading-tight max-w-[14rem] mx-auto">
            Scan to pledge your meters
          </div>
          <div className="text-xs text-zinc-400 mt-2 max-w-[14rem] mx-auto leading-relaxed">
            Point your phone camera here. Put in your name and how many meters you will do.
          </div>
        </div>
      </div>

      {/* Who is in */}
      <div className="flex-1 min-h-0 px-8 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-xs font-black uppercase tracking-[0.35em]" style={{ color: BRAND.pink }}>
            Who is in
          </div>
          {pageCount > 1 && (
            <div className="flex gap-1.5">
              {Array.from({ length: pageCount }).map((_, i) => (
                <div
                  key={i}
                  className="h-1 rounded-full transition-all duration-500"
                  style={{ width: i === page ? 22 : 8, background: i === page ? BRAND.red : '#2a2a2a' }}
                />
              ))}
            </div>
          )}
        </div>

        {roster && people.length === 0 ? (
          <div className="text-zinc-600 text-lg">
            Nobody has pledged yet. Be the first — scan the code.
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-x-8 gap-y-2.5">
            {shown.map((p) => (
              <div key={p.id} className="flex items-baseline justify-between gap-3" style={{ borderBottom: '1px solid #141414' }}>
                <span className="text-lg font-bold truncate pb-1.5">{p.name}</span>
                <span className="text-lg font-black tabular-nums shrink-0 pb-1.5" style={{ color: BRAND.pink }}>
                  {fmt(p.pledgeMeters)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
