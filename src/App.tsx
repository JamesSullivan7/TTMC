import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import MapView from './MapView'
import Celebration from './Celebration'
import { EntryForm, RecentEntries } from './EntryPanel'
import { downloadShareCard } from './shareCard'
import { clearTrainerKey, getTrainerKey, setTrainerKey } from './keys'
import {
  ACTS,
  actAt,
  crossedMilestones,
  GOAL,
  MACHINES,
  MACHINE_COLORS,
  MILESTONES,
  Milestone,
  BRAND,
  MARATHON,
  fmt,
  fmtKm,
  challengeDay,
  paceTarget,
  daysToStart,
  CHALLENGE_NAME,
  CHALLENGE_WINDOW,
} from './config'
import { locationLabel } from './geo'

const REPLAY_MS = 50_000
const REPLAY_TICK = 120

// Smoothly animate a number toward its target — makes the big counter "tick up".
function useAnimatedNumber(target: number, ms = 1400) {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)
  const rafRef = useRef(0)
  useEffect(() => {
    const from = fromRef.current
    if (from === target) return
    // rAF is frozen in hidden tabs — don't animate, just show the value.
    if (document.hidden) {
      setDisplay(target)
      fromRef.current = target
      return
    }
    const start = performance.now()
    cancelAnimationFrame(rafRef.current)
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - t, 3)
      const val = from + (target - from) * eased
      setDisplay(val)
      fromRef.current = val
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    // Failsafe: whatever happens to the animation, land on the exact target.
    const snap = setTimeout(() => {
      setDisplay(target)
      fromRef.current = target
    }, ms + 250)
    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(snap)
    }
  }, [target, ms])
  return display
}

const BAR_LABELS: { m: number; label: string }[] = [
  { m: 0, label: 'Tulsa' },
  { m: 549_000, label: 'Amarillo' },
  { m: 2_269_000, label: 'LA' },
  { m: 3_816_000, label: 'Denver' },
  { m: 5_294_000, label: 'Chicago' },
  { m: 6_438_000, label: 'NYC' },
  { m: 7_883_000, label: 'St. Louis' },
  { m: 8_473_348, label: 'Tulsa' },
]

const ACT_NUMERALS = ['I', 'II', 'III']

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type DailyRow = { key: string; journey: number; byMachine: Record<string, number> }

function RecapOverlay({
  row,
  cumBefore,
  dayNum,
  onDone,
}: {
  row: DailyRow
  cumBefore: number
  dayNum: number
  onDone: () => void
}) {
  const from = locationLabel(cumBefore)
  const to = locationLabel(cumBefore + row.journey)
  const bestMachine = Object.entries(row.byMachine).sort((a, b) => b[1] - a[1])[0]
  const rootRef = useRef<HTMLDivElement>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  useEffect(() => {
    const t = setTimeout(onDone, 20_000)
    return () => clearTimeout(t)
  }, [onDone])
  // Native listener — same reliability fix as Celebration dismissal.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const h = () => onDoneRef.current()
    el.addEventListener('click', h)
    return () => el.removeEventListener('click', h)
  }, [])

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-40 flex items-center justify-center celeb-fade cursor-pointer"
      style={{ background: 'radial-gradient(ellipse at center, rgba(20,20,24,0.96) 0%, rgba(5,5,5,0.99) 80%)' }}
    >
      <div className="relative text-center px-8 celeb-in max-w-4xl">
        <img
          src="/logo-t.png"
          alt=""
          className="w-14 h-14 mx-auto mb-4 rounded-full"
          style={{ border: `2px solid ${BRAND.red}`, boxShadow: `0 0 14px ${BRAND.red}66` }}
        />
        <div className="text-sm font-bold tracking-[0.5em] uppercase mb-3" style={{ color: BRAND.pink }}>
          {dayNum > 0 ? `Day ${dayNum} recap` : 'Yesterday'}
        </div>
        <div className="font-display uppercase leading-none text-white" style={{ fontSize: 'clamp(2.5rem, 7vw, 5rem)' }}>
          {fmt(row.journey)} meters
        </div>
        <div className="mt-5 text-lg text-zinc-300">
          {from.where.replace('Past ', 'Woke up past ')} <span style={{ color: BRAND.red }}>→</span>{' '}
          {to.where.toLowerCase().replace('past', 'went to sleep past')}
        </div>
        {bestMachine && (
          <div className="mt-4 inline-block px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: '#161616', border: '1px solid #2a2a2a' }}>
            Workhorse of the day:{' '}
            <span style={{ color: MACHINE_COLORS[bestMachine[0] as (typeof MACHINES)[number]] ?? '#fff' }}>
              {bestMachine[0]}
            </span>{' '}
            · {fmtKm(bestMachine[1])}
          </div>
        )}
        <div className="mt-8 text-xs uppercase tracking-widest text-zinc-500">Click to dismiss</div>
      </div>
    </div>
  )
}

// `castMode` is the /tv route: the display layout, locked. No trainer login,
// no entry form, no way out — so a tab being cast to the gym TV cannot end up
// showing an entry form and a Reset button to the whole room, and comes back
// correctly on its own if the tab reloads. It does not ask for fullscreen,
// because casting a tab sends the page content without browser chrome anyway,
// and a page cannot enter fullscreen without a click to authorise it.
export default function App({ castMode = false }: { castMode?: boolean }) {
  const summary = useQuery(api.worldTour.getSummary)
  const verifyTrainer = useMutation(api.worldTour.verifyTrainer)
  const daily = useQuery(api.worldTour.getDaily)
  const [tvMode, setTvMode] = useState(castMode)
  const [kiosk, setKiosk] = useState(
    () => !castMode && localStorage.getItem('tt-kiosk') === '1' && getTrainerKey() !== ''
  )
  const [celebQueue, setCelebQueue] = useState<Milestone[]>([])
  const [showRecap, setShowRecap] = useState(false)
  const [replayValue, setReplayValue] = useState<number | null>(null)
  const prevTotal = useRef<number | null>(null)
  const replayTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const total = summary?.totalJourney ?? 0
  const replaying = replayValue !== null
  const shownTotal = replaying ? replayValue! : total
  const animatedTotal = useAnimatedNumber(total)

  // Detect crossed milestones → queue celebrations + fly the camera.
  useEffect(() => {
    if (summary === undefined) return
    if (prevTotal.current === null) {
      prevTotal.current = total
      return
    }
    const prev = prevTotal.current
    if (total > prev) {
      const crossed = crossedMilestones(prev, total)
      if (crossed.length > 0) setCelebQueue((q) => [...q, ...crossed])
    }
    prevTotal.current = total
  }, [total, summary])

  // Morning auto-recap: once per day, before 11 AM, when yesterday had meters.
  const yesterdayKey = localDayKey(new Date(now.getTime() - 86_400_000))
  const todayKey = localDayKey(now)
  const yesterdayRow = daily?.find((d) => d.key === yesterdayKey) ?? null
  const cumBeforeYesterday = (daily ?? [])
    .filter((d) => d.key < yesterdayKey)
    .reduce((s, d) => s + d.journey, 0)

  // Today measured against the gym's own best day. With no deadline this is
  // the only urgency left, and it is collective — nobody is ranked against
  // anybody, the room is racing its own history.
  const todayMeters = daily?.find((d) => d.key === todayKey)?.journey ?? 0
  const bestPreviousDay = (daily ?? [])
    .filter((d) => d.key !== todayKey)
    .reduce((best, d) => Math.max(best, d.journey), 0)
  const beatingBest = todayMeters > 0 && bestPreviousDay > 0 && todayMeters > bestPreviousDay
  useEffect(() => {
    if (!yesterdayRow || replaying) return
    const hour = now.getHours()
    if (hour >= 5 && hour < 11 && localStorage.getItem('tt-recap') !== todayKey) {
      localStorage.setItem('tt-recap', todayKey)
      setShowRecap(true)
    }
  }, [yesterdayRow, todayKey, now, replaying])

  // Fullscreen sync for TV mode
  useEffect(() => {
    const onFs = () => {
      if (castMode) return
      if (!document.fullscreenElement) setTvMode(false)
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  function enterTvMode() {
    setTvMode(true)
    document.documentElement.requestFullscreen?.().catch(() => {})
  }
  function exitTvMode() {
    if (castMode) return // /tv has nothing to exit to
    setTvMode(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }

  // The key is checked by the server, not compared against a bundled constant,
  // so a wrong key cannot be discovered by reading the site's source.
  async function trainerLogin() {
    const entered = window.prompt('Trainer PIN:')
    if (entered === null) return
    const key = entered.trim()
    try {
      await verifyTrainer({ key })
      setTrainerKey(key)
      localStorage.setItem('tt-kiosk', '1')
      setKiosk(true)
    } catch {
      window.alert('That PIN was not accepted.')
    }
  }
  function trainerLock() {
    clearTrainerKey()
    localStorage.removeItem('tt-kiosk')
    setKiosk(false)
  }

  function startReplay() {
    if (total <= 0 || replaying) return
    setCelebQueue([])
    setShowRecap(false)
    const steps = Math.ceil(REPLAY_MS / REPLAY_TICK)
    const inc = total / steps
    let v = 0
    setReplayValue(0)
    replayTimer.current = setInterval(() => {
      v += inc
      if (v >= total) {
        if (replayTimer.current) clearInterval(replayTimer.current)
        setReplayValue(total)
        setTimeout(() => setReplayValue(null), 3000)
      } else {
        setReplayValue(v)
      }
    }, REPLAY_TICK)
  }
  function stopReplay() {
    if (replayTimer.current) clearInterval(replayTimer.current)
    setReplayValue(null)
  }
  useEffect(() => () => {
    if (replayTimer.current) clearInterval(replayTimer.current)
  }, [])

  const day = challengeDay(now)
  const toStart = daysToStart(now)
  const pace = paceTarget(now)
  const paceDiff = pace === null ? null : total - pace
  const pct = Math.min(100, (shownTotal / GOAL) * 100)
  const loc = locationLabel(shownTotal)
  const celeb = celebQueue[0] ?? null

  // Projected arrival: rate from the challenge start, or from the first entry
  // when there is no date window.
  let projected: Date | null = null
  if (total > 0 && total < GOAL && summary?.firstEntryAt) {
    // With a date window, rate is measured from the official start. Without
    // one, from the first entry ever logged.
    const rateBasis =
      CHALLENGE_WINDOW && day > 0 ? CHALLENGE_WINDOW.start.getTime() : summary.firstEntryAt
    const elapsed = now.getTime() - rateBasis
    if (elapsed > 60_000) {
      const rate = total / elapsed // meters per ms
      projected = new Date(now.getTime() + (GOAL - total) / rate)
    }
  }

  const { act, index: actIndex, pct: actPct } = actAt(shownTotal)
  const unlocked = MILESTONES.filter((ms) => ms.m <= total)
  const nextMilestone = MILESTONES.find((ms) => ms.m > total)
  const feed = unlocked.slice(-6).reverse()

  if (summary === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <img
          src="/logo-t.png"
          alt=""
          className="w-20 h-20 rounded-full pulse-dot"
          style={{ border: `2px solid ${BRAND.red}` }}
        />
      </div>
    )
  }

  return (
    // A television crops the edges of what it is sent - overscan, a habit
    // inherited from CRTs that TCL and Roku sets still default to and do not
    // always let you turn off. Content flush to the edge is simply not on the
    // wall. Broadcast calls the surviving region title-safe; this is a smaller
    // version of that inset, applied only when the layout is on a TV, because
    // on a laptop it would just be wasted margin.
    <div
      className="min-h-screen text-white bg-[#050505]"
      style={tvMode ? { padding: '2.2vh 2.8vw', overflow: 'hidden' } : undefined}
    >
      {celeb && !replaying && (
        <Celebration milestone={celeb} day={day} onDone={() => setCelebQueue((q) => q.slice(1))} />
      )}
      {showRecap && yesterdayRow && !celeb && !replaying && (
        <RecapOverlay
          row={yesterdayRow}
          cumBefore={cumBeforeYesterday}
          dayNum={challengeDay(new Date(now.getTime() - 86_400_000))}
          onDone={() => setShowRecap(false)}
        />
      )}

      {/* ── Header ── */}
      {!tvMode && (
        <div className="relative" style={{ borderBottom: '1px solid #171717', zIndex: 20 }}>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 70% 100% at 50% 0%, rgba(217,59,88,0.13) 0%, transparent 70%)' }}
          />
          <div className="relative max-w-screen-2xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/logo-t.png"
                alt=""
                className="w-12 h-12 rounded-full"
                style={{ border: `1.5px solid ${BRAND.darkRed}` }}
              />
              <div>
                <div className="text-xs font-bold tracking-[0.3em] uppercase" style={{ color: BRAND.red }}>
                  Tulsa Training
                </div>
                <div className="font-display text-2xl uppercase tracking-wide leading-none">{CHALLENGE_NAME}</div>
              </div>
              <button
                onClick={enterTvMode}
                className="ml-2 px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all hover:opacity-80"
                style={{ background: '#141414', border: `1px solid ${BRAND.darkRed}`, color: BRAND.pink }}
              >
                TV mode
              </button>
              {kiosk ? (
                <>
                  <button
                    onClick={trainerLock}
                    className="px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
                    style={{ background: '#141414', border: '1px solid #2a2a2a' }}
                  >
                    Lock
                  </button>
                </>
              ) : (
                <button
                  onClick={trainerLogin}
                  className="px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
                  style={{ background: '#141414', border: '1px solid #2a2a2a' }}
                >
                  Trainer login
                </button>
              )}
            </div>
            {kiosk && <EntryForm />}
          </div>
        </div>
      )}

      {/* ── Map hero ── */}
      <div
        className="relative w-full"
        style={{ height: tvMode ? '67vh' : '58vh', background: '#050505' }}
        onDoubleClick={tvMode && !castMode ? exitTvMode : undefined}
      >
        <MapView totalMeters={shownTotal} paceMeters={replaying ? 0 : pace ?? 0} />

        {/* Countdown — only inside the final week before the start date.
            No date window set means no countdown at all. */}
        {toStart !== null && toStart <= 7 && !replaying && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center pointer-events-none">
            <div className="text-sm font-bold tracking-[0.5em] uppercase mb-2" style={{ color: BRAND.pink }}>
              {CHALLENGE_NAME} begins{' '}
              {CHALLENGE_WINDOW?.start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </div>
            <div className="font-display uppercase leading-none" style={{ fontSize: 'clamp(3rem, 8vw, 6.5rem)', textShadow: '0 2px 30px rgba(0,0,0,0.9)' }}>
              T-minus {toStart} {toStart === 1 ? 'day' : 'days'}
            </div>
          </div>
        )}

        {/* Replay badge */}
        {replaying && (
          <div className="absolute inset-x-0 top-3 text-center pointer-events-none">
            <span className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.35em]" style={{ background: '#141414ee', border: `1px solid ${BRAND.red}`, color: BRAND.pink }}>
              Replaying the journey
            </span>
          </div>
        )}

        {/* Top-left: the big number */}
        <div className="absolute top-4 left-5 pointer-events-none">
          <div className="text-xs font-bold tracking-[0.35em] uppercase mb-1" style={{ color: BRAND.pink }}>
            {tvMode ? `Tulsa Training — ${CHALLENGE_NAME}` : CHALLENGE_NAME}
          </div>
          <div className="font-display leading-none tabular-nums" style={{ fontSize: tvMode ? '5.5rem' : '3.8rem', textShadow: '0 2px 20px rgba(0,0,0,0.8)' }}>
            {fmt(replaying ? shownTotal : animatedTotal)}
          </div>
          <div className="text-zinc-400 text-sm mt-1" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>
            of <span className="text-white font-bold">{fmt(GOAL)}</span> meters —{' '}
            <span className="font-black" style={{ color: BRAND.red }}>
              {pct.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Top-right: day + pace + projection */}
        {!replaying && (
          <div className="absolute top-4 right-5 text-right pointer-events-none">
            {CHALLENGE_WINDOW && (
              <div className="font-display text-3xl uppercase leading-none" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.8)' }}>
                {day === 0
                  ? 'Pre-season'
                  : day <= CHALLENGE_WINDOW.days
                    ? `Day ${day} of ${CHALLENGE_WINDOW.days}`
                    : 'Overtime'}
              </div>
            )}
            {todayMeters > 0 && (
              <div className={CHALLENGE_WINDOW ? 'mt-2' : ''}>
                <div className="text-xs uppercase tracking-widest" style={{ color: BRAND.pink }}>
                  Today
                </div>
                <div
                  className="font-display uppercase leading-none tabular-nums"
                  style={{ fontSize: tvMode ? '3rem' : '2.2rem', textShadow: '0 2px 20px rgba(0,0,0,0.8)' }}
                >
                  {fmt(todayMeters)}
                </div>
                {bestPreviousDay > 0 && (
                  <div
                    className="mt-1 inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider"
                    style={
                      beatingBest
                        ? { background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid #10B98144' }
                        : { background: '#141414cc', color: '#a1a1aa', border: '1px solid #2a2a2a' }
                    }
                  >
                    {beatingBest ? 'Best day yet' : `${fmtKm(bestPreviousDay - todayMeters)} off our best`}
                  </div>
                )}
              </div>
            )}
            {paceDiff !== null && day > 0 && (
              <div
                className="mt-2 inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider"
                style={{
                  background: paceDiff >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                  color: paceDiff >= 0 ? '#10B981' : '#F59E0B',
                  border: `1px solid ${paceDiff >= 0 ? '#10B98144' : '#F59E0B44'}`,
                }}
              >
                {paceDiff >= 0 ? `${fmtKm(paceDiff)} ahead of pace` : `${fmtKm(-paceDiff)} behind pace`}
              </div>
            )}
            {projected && (
              <div className="mt-2 text-xs text-zinc-400" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>
                Projected arrival:{' '}
                <span className="text-white font-bold">
                  {projected.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            )}
            {total >= GOAL && (
              <div className="mt-2 text-sm font-black uppercase tracking-widest" style={{ color: BRAND.pink }}>
                {CHALLENGE_NAME} — complete
              </div>
            )}
          </div>
        )}

        {/* Bottom-left: where we are, and — much bigger — what we are chasing.
            "4,000 meters to Santa Fe" is the one number a trainer can turn into
            an ask on the gym floor, so it gets the weight. */}
        <div className="absolute bottom-4 left-5 pointer-events-none">
          <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Current position</div>
          <div className="text-base font-bold" style={{ textShadow: '0 1px 10px rgba(0,0,0,0.9)' }}>
            <span className="pulse-dot inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: BRAND.red }} />
            {loc.where}
          </div>
          {loc.toNext > 0 && (
            <div className="mt-3">
              <div className="text-xs uppercase tracking-widest mb-0.5" style={{ color: BRAND.pink }}>
                Next stop
              </div>
              <div
                className="font-display uppercase leading-none"
                style={{ fontSize: tvMode ? '3.2rem' : '2.2rem', textShadow: '0 2px 20px rgba(0,0,0,0.9)' }}
              >
                {loc.nextStop}
              </div>
              <div className="text-sm font-bold text-zinc-300 mt-1" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>
                <span className="tabular-nums text-white">{fmtKm(loc.toNext)}</span> to go
              </div>
            </div>
          )}
        </div>

        {/* Bottom-right: counters + actions */}
        <div className="absolute bottom-4 right-5 text-right">
          <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1 pointer-events-none">So far that's</div>
          <div className="text-sm text-zinc-300 pointer-events-none" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>
            <span className="font-black text-white tabular-nums">{fmt(Math.floor(shownTotal / MARATHON))}</span> marathons
          </div>
          <div className="mt-2 flex gap-2 justify-end">
            {yesterdayRow && !replaying && (
              <button
                onClick={() => setShowRecap(true)}
                className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors"
                style={{ background: '#141414cc', border: '1px solid #2a2a2a' }}
              >
                Daily recap
              </button>
            )}
            {total > 0 && (
              <button
                onClick={replaying ? stopReplay : startReplay}
                className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors"
                style={
                  replaying
                    ? { background: BRAND.red, color: '#fff', border: `1px solid ${BRAND.red}` }
                    : { background: '#141414cc', border: '1px solid #2a2a2a', color: '#a1a1aa' }
                }
              >
                {replaying ? 'Stop replay' : 'Replay the journey'}
              </button>
            )}
          </div>
        </div>

        {tvMode && !castMode && (
          <button
            onClick={exitTvMode}
            className="absolute top-4 right-1/2 translate-x-1/2 text-zinc-700 text-xs uppercase tracking-widest hover:text-zinc-400"
          >
            exit
          </button>
        )}
      </div>

      {/* ── Act strip ── the loop is three journeys, and each one ends
           somewhere that feels like an arrival. ── */}
      <div className="max-w-screen-2xl mx-auto px-5 pt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: BRAND.pink }}>
          Act {ACT_NUMERALS[actIndex] ?? ''}
        </span>
        <span className="font-display text-xl uppercase leading-none">{act.name}</span>
        <span className="text-xs text-zinc-500">{act.blurb}</span>
        <span className="ml-auto text-xs text-zinc-400 tabular-nums">
          {actPct.toFixed(0)}% of act {actIndex + 1} of {ACTS.length}
        </span>
      </div>

      {/* ── Journey bar, split into the three acts ──
           One 8,473 km bar gives the room a single win, 31 days away. Three
           bars give it three, and the first arrives inside a week. The widths
           stay proportional to the real distances, so it still reads as one
           journey — and Act II visibly being half the challenge is the honest
           thing to show, not something to smooth over. */}
      <div className="max-w-screen-2xl mx-auto px-5 pt-2 pb-1">
        <div className="flex gap-1.5 items-end">
          {ACTS.map((a, i) => {
            const span = a.to - a.from
            const filled = Math.max(0, Math.min(span, shownTotal - a.from))
            const actDone = shownTotal >= a.to
            const isHere = !actDone && shownTotal >= a.from
            const cities = BAR_LABELS.filter((c) => c.m > a.from && c.m <= a.to)
            return (
              // minWidth 0 or the act names set a floor on each bar, which
              // breaks the proportions on a narrow screen and stops `truncate`
              // from ever truncating.
              <div key={a.name} style={{ flexGrow: span, flexBasis: 0, minWidth: 0 }}>
                <div
                  className="relative h-4 rounded-full overflow-visible transition-all duration-500"
                  style={{
                    background: '#161616',
                    border: isHere ? `1px solid ${BRAND.darkRed}` : '1px solid transparent',
                  }}
                >
                  <div
                    className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${(filled / span) * 100}%`,
                      background: `linear-gradient(90deg, ${BRAND.darkRed}, ${BRAND.red}, ${BRAND.pink})`,
                      boxShadow: filled > 0 ? `0 0 14px ${BRAND.red}66` : undefined,
                    }}
                  />
                  {/* pace ghost, drawn only in the act it currently falls in */}
                  {pace !== null && day > 0 && !replaying && pace > a.from && pace <= a.to && (
                    <div
                      className="absolute top-[-4px] w-[2px] h-6 bg-white/70"
                      style={{ left: `${((pace - a.from) / span) * 100}%` }}
                      title="On-pace position"
                    />
                  )}
                  {cities.map((c, j) => (
                    <div
                      key={j}
                      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                      style={{
                        left: `calc(${((c.m - a.from) / span) * 100}% - 4px)`,
                        background: c.m <= shownTotal ? '#fff' : '#3a3a3a',
                        border: `2px solid ${c.m <= shownTotal ? BRAND.red : '#242424'}`,
                      }}
                    />
                  ))}
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5 overflow-hidden">
                  <span
                    className="text-[10px] font-black tracking-[0.2em] shrink-0"
                    style={{ color: actDone ? BRAND.red : isHere ? BRAND.pink : '#3f3f46' }}
                  >
                    {actDone ? '✓' : ACT_NUMERALS[i]}
                  </span>
                  <span
                    className="text-[10px] uppercase tracking-wider truncate"
                    style={{ color: actDone || isHere ? '#a1a1aa' : '#3f3f46' }}
                  >
                    {a.name}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Machines + milestone feed ── */}
      <div className="max-w-screen-2xl mx-auto px-5 py-3 grid grid-cols-1 lg:grid-cols-3 gap-3 pb-6">
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-5 gap-2">
          {MACHINES.map((m) => {
            const v = summary.byMachine[m] ?? 0
            const color = MACHINE_COLORS[m]
            const share = total > 0 ? ((v / total) * 100).toFixed(1) : '0.0'
            return (
              <div
                key={m}
                className="rounded-xl p-3"
                style={{ background: '#0d0d0d', border: '1px solid #1c1c1c', borderTop: `3px solid ${color}` }}
              >
                <div className="text-[11px] font-black uppercase tracking-wider mb-1" style={{ color }}>
                  {m}
                </div>
                <div className="text-lg font-black tabular-nums leading-tight">{fmtKm(v)}</div>
                <div className="text-xs text-zinc-600">{share}% of the trip</div>
              </div>
            )
          })}
        </div>

        <div className="rounded-xl p-3" style={{ background: '#0d0d0d', border: '1px solid #1c1c1c' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-widest text-zinc-500">Milestones</span>
            <span className="text-xs font-bold" style={{ color: BRAND.pink }}>
              {unlocked.length} / {MILESTONES.length}
            </span>
          </div>
          {nextMilestone && (
            <div className="flex items-baseline gap-2 mb-2 pb-2" style={{ borderBottom: '1px solid #1c1c1c' }}>
              <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: BRAND.darkRed, color: BRAND.pink }}>
                Next
              </span>
              <span className="text-sm font-bold truncate">{nextMilestone.name}</span>
              <span className="text-xs text-zinc-500 ml-auto shrink-0 tabular-nums">{fmtKm(nextMilestone.m - total)} away</span>
            </div>
          )}
          <div className="space-y-1.5">
            {feed.length === 0 && <div className="text-zinc-600 text-sm">The journey begins with the first entry.</div>}
            {feed.map((ms) => (
              <div key={ms.m} className="flex items-baseline gap-2 text-sm group">
                <span style={{ color: BRAND.red }}>✓</span>
                <span className={ms.major ? 'font-bold' : 'text-zinc-300'}>{ms.name}</span>
                <span className="text-zinc-600 text-xs ml-auto shrink-0 tabular-nums">{fmt(ms.m)} m</span>
                <button
                  onClick={() => downloadShareCard(ms, day)}
                  title="Download share card"
                  className="text-zinc-600 hover:text-white text-xs shrink-0 transition-colors"
                >
                  ↓
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Trainer tools ──
          Undo only. Simulate and reset used to sit here too, and a button
          that fabricates 273,000 meters has no business on a gym computer
          during a live challenge: one stray click and the road jumps a day
          that nobody rode. Both still exist as admin-key mutations for the
          CLI and for launch day, where a human is deliberately running them. */}
      {!tvMode && kiosk && (
        <div className="max-w-screen-2xl mx-auto px-5 pb-8 space-y-3">
          <RecentEntries />
        </div>
      )}
    </div>
  )
}
