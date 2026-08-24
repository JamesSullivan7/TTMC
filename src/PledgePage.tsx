import { useEffect, useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import { BRAND, CHALLENGE_NAME, CHALLENGE_WINDOW, GOAL, fmt, shortName } from './config'
import { getTrainerKey } from './keys'

// The pre-season board for the gym TV. Before September there is nothing to
// show on a map, so the screen earns its place a different way: it makes
// signing up the thing everyone can see happening.
//
// Sorted newest first on purpose. Scan the code, pledge your meters, and your
// name is on the gym screen within seconds — which is the whole reason anyone
// bothers while they are standing there.
//
// Everything on the wide layout is sized in vw, so the board scales to
// whatever screen it lands on rather than being tuned to one window and
// falling apart on the next. Below 900px it switches to a stacked layout,
// because people open the link on their phones even though this is for a TV.

const PAGE_MS = 9000
const PER_COLUMN = 14

// ── The gauge ───────────────────────────────────────────────────────────────
// The track used to be #161616 on a #050505 board: 1.13:1. Across a gym on a
// panel that crushes its own blacks that is not a dark track, it is nothing —
// and the unfilled part is the half of the story that says how far there is
// to go. So it carries the map's own road-ahead treatment instead: dashes,
// drifting the way the journey goes. Same colour, same 5:7 rhythm and the
// same cadence as the dashed route in MapView, so the pre-season board and
// the map that replaces it on the 1st speak the same language.
//
// TRACK_EDGE is the first dial to reach for: it is the hairline that makes
// the tube read as a shape at distance. DASH_SECONDS slows the drift.
const TRACK = '#141419' // the road not yet driven
const TRACK_EDGE = '#2e2e38' // hairline, so the tube is a shape and not a smudge
const DASH = 'rgba(255,255,255,0.32)' // MapView's road-ahead stroke, exactly
const DASH_SECONDS = 0.8 // one dash period; the map moves 24 units in 1.6s

// The dash geometry is 5:7 on both layouts — the map's strokeDasharray="5 7" —
// but the board is sized in vw and the phone in rem, so the scale follows the
// layout it is in rather than one number being wrong on one of them.
const DASH_TV = { on: 0.5, off: 0.7, unit: 'vw' }
const DASH_PHONE = { on: 0.28, off: 0.39, unit: 'rem' }

type DashScale = typeof DASH_TV

// The unlit part of the track. The layer is deliberately larger than the
// track on the axis of travel: it slides exactly one dash period, and the
// track's overflow-hidden clips the overhang, so the loop has no seam.
function RoadAhead({ axis, scale }: { axis: 'up' | 'right'; scale: DashScale }) {
  const { on, off, unit } = scale
  const period = `${on + off}${unit}`
  const bleed = axis === 'up'
    ? { top: `-${period}`, bottom: `-${period}`, left: 0, right: 0 }
    : { left: `-${period}`, right: `-${period}`, top: 0, bottom: 0 }

  return (
    <div
      className={axis === 'up' ? 'road-ahead-up' : 'road-ahead-right'}
      style={{
        position: 'absolute',
        ...bleed,
        pointerEvents: 'none',
        background: `repeating-linear-gradient(${axis === 'up' ? 'to top' : 'to right'}, transparent 0, transparent ${off}${unit}, ${DASH} ${off}${unit}, ${DASH} ${on + off}${unit})`,
        // Read by the keyframes, so the slide distance and the dash period
        // cannot drift apart.
        ['--dash-period' as string]: period,
        ['--dash-dur' as string]: `${DASH_SECONDS}s`,
      } as React.CSSProperties}
    />
  )
}

function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

function useBoardData() {
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
    return () => {
      cancelled = true
    }
  }, [joinUrl])

  const totalPledged = people.reduce((s, p) => s + p.pledgeMeters, 0)
  return {
    roster,
    people,
    qr,
    totalPledged,
    remaining: Math.max(0, GOAL - totalPledged),
    pct: Math.min(100, (totalPledged / GOAL) * 100),
  }
}

type Person = {
  id: string
  name: string
  firstName: string
  lastName: string
  pledgeMeters: number
}

function Countdown({ start, big }: { start: Date; big: boolean }) {
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
      <div className="font-display uppercase leading-none" style={{ fontSize: big ? '2.5vw' : '1.5rem', color: BRAND.red }}>
        Under way
      </div>
    )
  }
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  const parts: [number, string][] =
    d > 0 ? [[d, 'days'], [h, 'hrs'], [m, 'min']] : [[h, 'hrs'], [m, 'min'], [s, 'sec']]

  return (
    <div className="flex items-end gap-5 justify-center">
      {parts.map(([val, unit]) => (
        <div key={unit} className="text-center">
          <div className="font-display leading-none tabular-nums" style={{ fontSize: big ? '3vw' : '2rem' }}>
            {String(val).padStart(2, '0')}
          </div>
          <div className="uppercase tracking-[0.3em] text-zinc-500 mt-1" style={{ fontSize: big ? '0.6vw' : '0.6rem' }}>
            {unit}
          </div>
        </div>
      ))}
    </div>
  )
}

function ScanCard({ qr, size, big }: { qr: string | null; size: string; big: boolean }) {
  return (
    <div
      className="text-center rounded-2xl"
      style={{ background: '#0d0d0d', border: `2px solid ${BRAND.darkRed}`, padding: big ? '1.4vw 2vw' : '1.25rem' }}
    >
      {qr ? (
        <img src={qr} alt="Scan to pledge your meters" className="rounded-lg mx-auto" style={{ width: size, height: size }} />
      ) : (
        <div className="rounded-lg mx-auto" style={{ width: size, height: size, background: '#161616' }} />
      )}
      <div
        className="font-display uppercase leading-tight"
        style={{ fontSize: big ? '1.5vw' : '1.35rem', marginTop: big ? '0.9vw' : '0.75rem' }}
      >
        Scan to pledge your meters
      </div>
      <div
        className="text-zinc-400 leading-relaxed mx-auto"
        style={{ fontSize: big ? '0.85vw' : '0.8rem', maxWidth: big ? '18vw' : '17rem', marginTop: big ? '0.5vw' : '0.5rem' }}
      >
        Point your phone camera here. Put in your name and how many meters you will do.
      </div>
    </div>
  )
}

function Brand({ big }: { big: boolean }) {
  const size = big ? '5vw' : '3.5rem'
  return (
    <div className="flex items-center" style={{ gap: big ? '1.2vw' : '0.85rem' }}>
      <img
        src="/logo-t.png"
        alt=""
        className="rounded-full shrink-0"
        style={{ width: size, height: size, border: `3px solid ${BRAND.darkRed}`, boxShadow: `0 0 24px ${BRAND.darkRed}55` }}
      />
      <div>
        <div className="font-black tracking-[0.4em] uppercase" style={{ fontSize: big ? '0.85vw' : '0.65rem', color: BRAND.red }}>
          Tulsa Training
        </div>
        <div className="font-display uppercase tracking-wide leading-none mt-1" style={{ fontSize: big ? '3.2vw' : '1.9rem' }}>
          {CHALLENGE_NAME}
        </div>
      </div>
    </div>
  )
}

function Explainer({ big }: { big: boolean }) {
  return (
    <div className="text-center">
      <div className="font-display uppercase leading-none" style={{ fontSize: big ? '1.9vw' : '1.3rem' }}>
        This September the whole gym drives one road together
      </div>
      <div className="text-zinc-400" style={{ fontSize: big ? '1vw' : '0.85rem', marginTop: big ? '0.6vw' : '0.6rem' }}>
        Tulsa <span style={{ color: BRAND.red }}>→</span> Los Angeles <span style={{ color: BRAND.red }}>→</span> New York{' '}
        <span style={{ color: BRAND.red }}>→</span> Tulsa · <span className="text-white font-bold">{fmt(GOAL)} meters</span> ·
        every meter you row, ski, bike or run moves us down the road
      </div>
    </div>
  )
}

function NamesColumn({ people, align }: { people: Person[]; align: 'left' | 'right' }) {
  return (
    <div className="flex flex-col justify-start gap-[0.35vw]">
      <div
        className="font-black uppercase tracking-[0.35em] mb-[0.4vw]"
        style={{ fontSize: '0.72vw', color: BRAND.pink, textAlign: align }}
      >
        Who is in
      </div>
      {people.map((p) => (
        <div key={p.id} className="flex items-baseline justify-between gap-[0.8vw]" style={{ borderBottom: '1px solid #141414' }}>
          <span className="font-bold truncate pb-[0.25vw]" style={{ fontSize: '1.05vw' }}>
            {shortName(p.firstName, p.lastName)}
          </span>
          <span className="font-black tabular-nums shrink-0 pb-[0.25vw]" style={{ fontSize: '1.05vw', color: BRAND.pink }}>
            {fmt(p.pledgeMeters)}
          </span>
        </div>
      ))}
    </div>
  )
}

function Stat({ value, label, tint, big }: { value: string; label: string; tint?: string; big: boolean }) {
  return (
    <div>
      <div className="font-display leading-none" style={{ fontSize: big ? '2.3vw' : '1.6rem', color: tint }}>
        {value}
      </div>
      <div className="uppercase tracking-[0.3em] text-zinc-500 mt-1" style={{ fontSize: big ? '0.62vw' : '0.55rem' }}>
        {label}
      </div>
    </div>
  )
}

export default function PledgePage() {
  const { roster, people, qr, totalPledged, remaining, pct } = useBoardData()
  const narrow = useIsNarrow()

  // Two gutters either side of the hero, filled left column first. Names get a
  // tall column instead of a short wide strip, which puts 28 on screen at once
  // rather than 20 — and with 182 people, how many are visible at any moment
  // is the number that matters.
  const perPage = PER_COLUMN * 2
  const pageCount = Math.max(1, Math.ceil(people.length / perPage))
  const [page, setPage] = useState(0)
  useEffect(() => {
    if (pageCount <= 1) return
    const t = setInterval(() => setPage((p) => (p + 1) % pageCount), PAGE_MS)
    return () => clearInterval(t)
  }, [pageCount])
  // Somebody pledging can shrink the page count under our feet.
  useEffect(() => {
    if (page >= pageCount) setPage(0)
  }, [page, pageCount])

  const shown = people.slice(page * perPage, page * perPage + perPage)

  // ── Phone ────────────────────────────────────────────────────────────────
  if (narrow) {
    return (
      <div className="min-h-screen bg-[#050505] text-white px-5 py-6">
        <div className="max-w-md mx-auto">
          <Brand big={false} />
          {CHALLENGE_WINDOW && (
            <div className="mt-6 text-center">
              <div className="uppercase tracking-[0.35em] mb-2 text-[0.6rem]" style={{ color: BRAND.pink }}>
                Starts {CHALLENGE_WINDOW.start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </div>
              <Countdown start={CHALLENGE_WINDOW.start} big={false} />
            </div>
          )}

          <div className="mt-6 pt-5" style={{ borderTop: '1px solid #171717' }}>
            <Explainer big={false} />
          </div>

          <div className="mt-7 text-center">
            <div className="font-black uppercase tracking-[0.35em] text-[0.65rem]" style={{ color: BRAND.pink }}>
              Pledged so far
            </div>
            <div className="font-display leading-none tabular-nums mt-1" style={{ fontSize: 'clamp(2.8rem, 16vw, 4rem)' }}>
              {fmt(totalPledged)}
            </div>
            <div className="text-zinc-400 text-sm mt-1">
              of <span className="text-white font-bold">{fmt(GOAL)}</span> meters
            </div>
          </div>

          <div
            className="relative h-3 rounded-full mt-5 overflow-hidden"
            style={{ background: TRACK, boxShadow: `inset 0 0 0 1px ${TRACK_EDGE}` }}
          >
            <RoadAhead axis="right" scale={DASH_PHONE} />
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000"
              style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${BRAND.darkRed}, ${BRAND.red}, ${BRAND.pink})` }}
            />
          </div>

          <div className="flex justify-center gap-10 mt-5">
            <Stat value={fmt(remaining)} label="still to pledge" tint={BRAND.red} big={false} />
            <Stat value={String(people.length)} label={people.length === 1 ? 'person in' : 'people in'} big={false} />
          </div>

          <div className="mt-8 flex justify-center">
            <ScanCard qr={qr} size="13rem" big={false} />
          </div>

          <div className="mt-8 font-black uppercase tracking-[0.3em] text-[0.65rem]" style={{ color: BRAND.pink }}>
            Who is in · {people.length}
          </div>
          <div className="mt-3">
            {people.length === 0 ? (
              <div className="text-zinc-600 text-sm">Nobody has pledged yet. Be the first — scan the code.</div>
            ) : (
              people.map((p) => (
                <div
                  key={p.id}
                  className="flex items-baseline justify-between gap-3 py-2"
                  style={{ borderBottom: '1px solid #141414' }}
                >
                  <span className="font-bold truncate">{shortName(p.firstName, p.lastName)}</span>
                  <span className="font-black tabular-nums shrink-0" style={{ color: BRAND.pink }}>
                    {fmt(p.pledgeMeters)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── The gym TV ───────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col overflow-hidden px-[2.5vw] py-[1.4vw]">
      <div className="flex items-center justify-center gap-[3vw] w-full shrink-0">
        <Brand big />
        {CHALLENGE_WINDOW && (
          <div className="text-center">
            <div className="uppercase tracking-[0.35em] mb-[0.4vw]" style={{ fontSize: '0.72vw', color: BRAND.pink }}>
              Starts {CHALLENGE_WINDOW.start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </div>
            <Countdown start={CHALLENGE_WINDOW.start} big />
          </div>
        )}
      </div>

      <div className="mt-[1.1vw] w-full shrink-0" style={{ borderTop: '1px solid #171717', paddingTop: '1.1vw' }}>
        <Explainer big />
      </div>

      <div className="flex-1 min-h-0 flex items-start gap-[2.5vw] mt-[1.6vw]">
        <div style={{ width: '19vw' }}>
          {roster && shown.length > 0 && <NamesColumn people={shown.slice(0, PER_COLUMN)} align="left" />}
        </div>

        <div className="flex-1 flex items-center justify-center gap-[3vw] self-center">
          <div className="flex flex-col items-center" style={{ height: '19vw' }}>
            <div className="font-black tabular-nums mb-[0.5vw]" style={{ fontSize: '0.7vw', color: BRAND.pink }}>
              {pct > 0 && pct < 1 ? '<1' : Math.round(pct)}%
            </div>
            <div
              className="relative rounded-full overflow-hidden flex-1"
              style={{ width: '2.2vw', background: TRACK, boxShadow: `inset 0 0 0 1px ${TRACK_EDGE}` }}
            >
              <RoadAhead axis="up" scale={DASH_TV} />
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

          <div className="text-center">
            <div className="font-black uppercase tracking-[0.35em]" style={{ fontSize: '0.8vw', color: BRAND.pink }}>
              Pledged so far
            </div>
            <div className="font-display leading-none tabular-nums mt-[0.3vw]" style={{ fontSize: '6.5vw' }}>
              {fmt(totalPledged)}
            </div>
            <div className="text-zinc-400 mt-[0.3vw]" style={{ fontSize: '1vw' }}>
              of <span className="text-white font-bold">{fmt(GOAL)}</span> meters
            </div>
            <div className="flex items-baseline justify-center gap-[2.5vw] mt-[1vw]">
              <Stat value={fmt(remaining)} label="still to pledge" tint={BRAND.red} big />
              <Stat value={String(people.length)} label={people.length === 1 ? 'person in' : 'people in'} big />
            </div>
          </div>

          <ScanCard qr={qr} size="11vw" big />
        </div>

        <div style={{ width: '19vw' }}>
          {roster && shown.length > PER_COLUMN && <NamesColumn people={shown.slice(PER_COLUMN)} align="right" />}
        </div>
      </div>

      {roster && people.length === 0 && (
        <div className="text-zinc-600 text-center pb-[1vw]" style={{ fontSize: '1.1vw' }}>
          Nobody has pledged yet. Be the first — scan the code.
        </div>
      )}
      {pageCount > 1 && (
        <div className="flex gap-1.5 justify-center pb-[0.5vw] shrink-0">
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
  )
}
