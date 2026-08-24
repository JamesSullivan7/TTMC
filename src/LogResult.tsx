import { useEffect } from 'react'
import { BRAND, MILESTONES, Milestone, fmt, fmtKm } from './config'
import { locationLabel } from './geo'
import { downloadShareCard } from './shareCard'

export type LogOutcome = {
  meters: number
  journeyMeters: number
  totalBefore: number
  totalAfter: number
}

// The moment right after someone logs: tell them exactly which stretch of road
// their meters covered. One person's 2,000 m is a rounding error against the
// goal, but it is always a real, nameable piece of the route — and that is the
// part worth showing them.
export default function LogResult({
  outcome,
  day,
  onDone,
}: {
  outcome: LogOutcome
  day: number
  onDone: () => void
}) {
  const { meters, journeyMeters, totalBefore, totalAfter } = outcome

  const from = locationLabel(totalBefore)
  const to = locationLabel(totalAfter)
  const crossed: Milestone[] = MILESTONES.filter((ms) => ms.m > totalBefore && ms.m <= totalAfter)
  const headline = crossed[crossed.length - 1] ?? null

  // Landmark crossings stay up long enough to outlast the TV celebration.
  useEffect(() => {
    const t = setTimeout(onDone, crossed.length > 0 ? 20_000 : 9_000)
    return () => clearTimeout(t)
  }, [onDone, crossed.length])

  // Moving into a new stretch of road reads as a journey; staying inside one
  // reads better as ground closed on the next stop.
  const movedOn = from.nextStop !== to.nextStop

  return (
    <div
      onClick={onDone}
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 cursor-pointer celeb-in"
      style={{ maxWidth: 'min(92vw, 30rem)' }}
    >
      <div
        className="rounded-2xl px-6 py-4 text-center"
        style={{
          background: '#0d0d0dfa',
          border: `1px solid ${headline ? BRAND.red : '#2a2a2a'}`,
          boxShadow: headline ? `0 0 34px ${BRAND.red}55` : '0 8px 30px rgba(0,0,0,0.7)',
        }}
      >
        <div className="text-[11px] font-black uppercase tracking-[0.35em]" style={{ color: BRAND.pink }}>
          Your {fmt(meters)} meters
        </div>

        {to.done ? (
          // No next stop once the road has run out — see the note on
          // locationLabel. This used to read "closer to Cross Country — complete".
          <div className="mt-2 text-lg font-bold leading-snug text-white">
            The gym is <span style={{ color: BRAND.red }}>home</span>. That is on top of the whole road.
          </div>
        ) : movedOn ? (
          <div className="mt-2 text-lg font-bold leading-snug text-white">
            {from.where} <span style={{ color: BRAND.red }}>→</span> {to.where}
          </div>
        ) : (
          <div className="mt-2 text-lg font-bold leading-snug text-white">
            {fmtKm(journeyMeters)} closer to <span style={{ color: BRAND.red }}>{to.nextStop}</span>
          </div>
        )}

        {!to.done && to.toNext > 0 && (
          <div className="mt-1 text-sm text-zinc-400">
            {fmtKm(to.toNext)} to {to.nextStop}
          </div>
        )}

        {headline && (
          <>
            <div
              className="mt-3 pt-3 text-sm font-bold text-white"
              style={{ borderTop: '1px solid #222' }}
            >
              You took us past{' '}
              <span style={{ color: BRAND.pink }}>{headline.name}</span>
              {crossed.length > 1 && (
                <span className="text-zinc-500 font-normal"> · and {crossed.length - 1} more</span>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                downloadShareCard(headline, day)
              }}
              className="mt-3 px-4 py-2 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all hover:opacity-80"
              style={{ background: BRAND.red, color: '#fff' }}
            >
              Save share card
            </button>
          </>
        )}
      </div>
    </div>
  )
}
