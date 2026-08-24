import { useEffect, useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import {
  BRAND,
  CHALLENGE_NAME,
  EVEREST,
  MACHINE_COLORS,
  MARATHON,
  Machine,
  fmt,
  fmtKm,
} from './config'
import { locationLabel } from './geo'
import { nextBadge, volumeBadges } from './badges'
import { getPersonId, setPersonId, clearPersonId, setLogToken } from './keys'
import PersonPicker from './PersonPicker'

// A member's own numbers, on their own phone. Scan the code, type your name,
// see what you have done and which machines you did it on.
//
// This is the only surface that is about one person rather than the gym, so
// the rule that governs it is the founding one: names and recognition yes,
// ranking no. It shows you your own meters and never puts them next to
// anybody else's — there is no position, no percentile, nothing to be beaten
// by. The comparison it does make is against the number you claimed yourself,
// which is the only one that means the same thing to a 25-year-old and a
// 70-year-old.
//
// The phone remembers who it belongs to (the same key /join sets), so this is
// a one-scan surface after the first time.

export default function MePage() {
  // The QR carries the log token, exactly as the pledge card does, so one scan
  // both shows your meters and sets the phone up to log more.
  useEffect(() => {
    const url = new URL(window.location.href)
    const t = url.searchParams.get('t')
    if (t) {
      setLogToken(t)
      url.searchParams.delete('t')
      window.history.replaceState({}, '', url.pathname + url.search)
    }
  }, [])

  const [personId, setId] = useState<string>(() => getPersonId())
  const roster = useQuery(api.people.listPeople)
  const stats = useQuery(api.people.personStats, personId ? { id: personId } : 'skip')

  // A remembered id can outlive the person it points at — a trainer removing a
  // duplicate, or a reset. Drop back to the picker rather than spinning.
  useEffect(() => {
    if (personId && stats === null) {
      clearPersonId()
      setId('')
    }
  }, [personId, stats])

  const pick = (id: string) => {
    setPersonId(id)
    setId(id)
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white px-5 py-7">
      <div className="max-w-md mx-auto">
        <div className="text-center">
          <div className="font-black tracking-[0.35em] uppercase text-[0.6rem]" style={{ color: BRAND.red }}>
            Tulsa Training · {CHALLENGE_NAME}
          </div>
          <h1 className="font-display uppercase leading-none mt-2 text-[2rem]">Your meters</h1>
        </div>

        {!personId ? (
          <Chooser roster={roster} onPick={pick} />
        ) : stats === undefined ? (
          <Loading />
        ) : stats ? (
          <Stats stats={stats} onSwitch={() => { clearPersonId(); setId('') }} />
        ) : null}
      </div>
    </div>
  )
}

function Chooser({
  roster,
  onPick,
}: {
  roster: { id: string; name: string; firstName: string; lastName: string }[] | undefined
  onPick: (id: string) => void
}) {
  return (
    <div className="mt-8">
      <p className="text-zinc-400 text-sm leading-relaxed text-center">
        Type your name to see everything you have done so far.
      </p>
      <div className="mt-5">
        <PersonPicker
          people={roster}
          value={null}
          onChange={(p) => p && onPick(p.id)}
          placeholder="Type your name…"
        />
      </div>
      {roster === undefined && <div className="text-zinc-600 text-sm mt-4 text-center">Loading the roster…</div>}
      <p className="text-zinc-600 text-xs leading-relaxed mt-6 text-center">
        Not finding yourself? You may not have pledged yet — scan the pledge code on the wall first,
        or ask a trainer.
      </p>
    </div>
  )
}

function Loading() {
  // Skeleton rather than a spinner: the shape it settles into is the same
  // shape it shows while waiting, so nothing jumps.
  return (
    <div className="mt-8 animate-pulse">
      <div className="h-4 w-24 rounded bg-[#141419] mx-auto" />
      <div className="h-14 w-56 rounded bg-[#141419] mx-auto mt-4" />
      <div className="h-3 w-full rounded-full bg-[#141419] mt-8" />
      <div className="h-40 w-full rounded-2xl bg-[#141419] mt-8" />
    </div>
  )
}

type Stats = {
  name: string
  pledgeMeters: number
  meters: number
  entries: number
  byMachine: Record<string, { meters: number; count: number }>
  pledgePct: number
  keptPledge: boolean
}

function Stats({ stats, onSwitch }: { stats: Stats; onSwitch: () => void }) {
  const { name, meters, pledgeMeters, entries, byMachine, pledgePct, keptPledge } = stats

  const machines = useMemo(
    () =>
      Object.entries(byMachine)
        .map(([machine, v]) => ({ machine, ...v }))
        .sort((a, b) => b.meters - a.meters),
    [byMachine]
  )
  const most = machines[0]

  return (
    <div className="mt-7">
      <div className="text-center">
        <div className="font-bold text-lg">{name}</div>
        <div className="font-display leading-none tabular-nums mt-2" style={{ fontSize: 'clamp(3rem, 18vw, 4.5rem)' }}>
          {fmt(meters)}
        </div>
        <div className="text-zinc-400 text-sm mt-1">
          meters · <span className="text-white font-bold">{fmtKm(meters)}</span>
        </div>
      </div>

      {meters === 0 ? (
        <Empty />
      ) : (
        <>
          {pledgeMeters > 0 && (
            <Pledge meters={meters} pledgeMeters={pledgeMeters} pct={pledgePct} kept={keptPledge} />
          )}

          <Section label="Where that got you" />
          <YourRoad meters={meters} />

          <Section label={`On ${machines.length === 1 ? 'this machine' : 'these machines'}`} />
          <div className="mt-3 flex flex-col gap-2.5">
            {machines.map((m) => (
              <MachineRow key={m.machine} {...m} share={(m.meters / meters) * 100} />
            ))}
          </div>

          <Section label="What you have to show for it" />
          <Badges meters={meters} kept={keptPledge} pledgeMeters={pledgeMeters} />

          <Section label="All told" />
          <div className="grid grid-cols-3 gap-3 mt-3">
            <Tile value={String(entries)} label={entries === 1 ? 'session' : 'sessions'} />
            <Tile value={fmt(Math.round(meters / Math.max(1, entries)))} label="avg session" />
            <Tile value={most ? most.machine : '—'} label="most used" small />
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onSwitch}
        className="w-full mt-9 rounded-xl py-3 text-sm font-bold text-zinc-400 hover:text-white transition-colors active:translate-y-px"
        style={{ border: '1.5px solid #2a2a2a' }}
      >
        Not {name.split(' ')[0]}? Change name
      </button>
    </div>
  )
}

// Keeping your pledge sits above the volume tiers and is styled to outrank
// them, because it is the only one every member can reach — each person set
// their own number, so it means the same thing at 20,000 as at 500,000. Sizing
// it by volume, or putting it in the same row as the tiers, would quietly turn
// the one egalitarian achievement into another measure of output.
function Badges({
  meters,
  kept,
  pledgeMeters,
}: {
  meters: number
  kept: boolean
  pledgeMeters: number
}) {
  const tiers = volumeBadges(meters)
  const next = nextBadge(meters)

  return (
    <div className="mt-3">
      {pledgeMeters > 0 && (
        <div
          className="rounded-2xl px-4 py-4 flex items-center gap-3.5"
          style={
            kept
              ? { border: `1.5px solid ${BRAND.red}`, background: 'rgba(217,59,88,0.09)' }
              : { border: '1.5px solid #1c1c22' }
          }
        >
          <Seal earned={kept} big />
          <div className="min-w-0">
            <div className="font-black text-[0.95rem]" style={{ color: kept ? BRAND.pink : '#a1a1aa' }}>
              {kept ? 'You kept your pledge' : 'Your pledge'}
            </div>
            {/* Deliberately does not repeat the number to go — the pledge bar
                above already counts that down, and saying it twice on one
                screen makes the page feel like it is nagging. */}
            <div className="text-zinc-400 text-xs mt-1 leading-relaxed">
              {kept
                ? `You said ${fmt(pledgeMeters)} and you did it. Same badge whatever the number — that is the point of it.`
                : 'Everyone who gets to their own number gets this one, whatever they claimed.'}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mt-2">
        {tiers.map(({ badge, earned }) => (
          <div
            key={badge.id}
            className="rounded-xl px-3 py-2.5 flex items-center gap-2.5"
            style={{ border: `1.5px solid ${earned ? BRAND.darkRed : '#16161c'}` }}
            title={badge.blurb}
          >
            <Seal earned={earned} />
            <div className="min-w-0">
              <div
                className="font-bold text-[0.8rem] truncate"
                style={{ color: earned ? '#fff' : '#52525b' }}
              >
                {badge.name}
              </div>
              <div className="tabular-nums text-[0.62rem]" style={{ color: earned ? BRAND.pink : '#3f3f46' }}>
                {fmt(badge.at)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {next && meters > 0 && (
        <div className="text-zinc-400 text-xs mt-3 text-center leading-relaxed">
          <span className="text-white font-bold tabular-nums">{fmt(next.toGo)}</span> more to{' '}
          <span style={{ color: BRAND.pink }}>{next.badge.name}</span>
        </div>
      )}
    </div>
  )
}

// A filled disc when earned, an empty ring when not. Deliberately not a tick or
// a lock: a lock says "denied", and this is a road you are still on.
function Seal({ earned, big = false }: { earned: boolean; big?: boolean }) {
  const size = big ? '2.1rem' : '1.15rem'
  return (
    <span
      className="shrink-0 rounded-full"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: earned
          ? `linear-gradient(135deg, ${BRAND.darkRed}, ${BRAND.red} 60%, ${BRAND.pink})`
          : 'transparent',
        border: earned ? 'none' : '1.5px solid #2a2a32',
        boxShadow: earned ? `0 0 ${big ? '14px' : '8px'} rgba(217,59,88,0.45)` : 'none',
      }}
    />
  )
}

function Section({ label }: { label: string }) {
  return (
    <div
      className="font-black uppercase tracking-[0.3em] text-[0.6rem] mt-8"
      style={{ color: BRAND.pink }}
    >
      {label}
    </div>
  )
}

function Empty() {
  return (
    <div className="mt-8 rounded-2xl px-5 py-7 text-center" style={{ border: '1.5px solid #2a2a2a' }}>
      <div className="font-display uppercase text-xl leading-tight">Nothing logged yet</div>
      <p className="text-zinc-400 text-sm leading-relaxed mt-3">
        Scan the code on any machine when you finish, put in what the screen says, and it will show
        up here.
      </p>
    </div>
  )
}

// Against the number you claimed yourself — the only comparison on this page,
// and the one achievement every member can actually reach.
function Pledge({
  meters,
  pledgeMeters,
  pct,
  kept,
}: {
  meters: number
  pledgeMeters: number
  pct: number
  kept: boolean
}) {
  const left = Math.max(0, pledgeMeters - meters)
  return (
    <div className="mt-7">
      <div className="flex items-baseline justify-between">
        <span className="font-black uppercase tracking-[0.3em] text-[0.6rem]" style={{ color: BRAND.pink }}>
          Your pledge
        </span>
        <span className="font-black tabular-nums text-sm">{Math.round(pct)}%</span>
      </div>

      <div
        className="relative h-3 rounded-full mt-2.5 overflow-hidden"
        style={{ background: '#141419', boxShadow: 'inset 0 0 0 1px #2e2e38' }}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000"
          style={{
            width: `${Math.max(pct, meters > 0 ? 2 : 0)}%`,
            background: `linear-gradient(90deg, ${BRAND.darkRed}, ${BRAND.red}, ${BRAND.pink})`,
          }}
        />
      </div>

      <div className="text-sm mt-2.5">
        {kept ? (
          <span className="font-bold" style={{ color: BRAND.pink }}>
            You have done what you said you would — {fmt(pledgeMeters)} meters, kept.
          </span>
        ) : (
          <span className="text-zinc-400">
            <span className="text-white font-bold">{fmt(left)}</span> to go of the{' '}
            {fmt(pledgeMeters)} you claimed.
          </span>
        )}
      </div>
    </div>
  )
}

// Your own meters laid on the route. Not a position in the gym's journey —
// this is the road you would have covered driving it alone, which is a way of
// making a number that means nothing on its own into a place.
function YourRoad({ meters }: { meters: number }) {
  // Deliberately phrased off the NEXT stop rather than locationLabel's `where`.
  // That field answers "where has the gym got to", and its answer is the last
  // waypoint passed — which for one person's total is almost always still
  // Tulsa, so it reads as "driven out of Tulsa as far as Past Tulsa". How far
  // you are and what is coming up works at every distance.
  const { nextStop, toNext } = locationLabel(meters)
  const marathons = meters / MARATHON
  const everests = meters / EVEREST

  return (
    <div className="mt-3 rounded-2xl px-4 py-4" style={{ border: '1.5px solid #2a2a2a' }}>
      <div className="text-sm leading-relaxed">
        On your own you would be{' '}
        <span className="font-bold" style={{ color: BRAND.pink }}>
          {fmtKm(meters)}
        </span>{' '}
        out of Tulsa
        {toNext > 0 && (
          <>
            {' '}— {fmtKm(toNext)} short of {nextStop}
          </>
        )}
        .
      </div>
      {marathons >= 0.25 && (
        <div className="text-zinc-400 text-xs mt-2.5 leading-relaxed">
          That is {marathons >= 1 ? `${marathons.toFixed(1)} marathons` : `${Math.round(marathons * 100)}% of a marathon`}
          {everests >= 1 && <> · {everests.toFixed(1)}× the height of Everest</>}
        </div>
      )}
    </div>
  )
}

function MachineRow({
  machine,
  meters,
  count,
  share,
}: {
  machine: string
  meters: number
  count: number
  share: number
}) {
  const color = MACHINE_COLORS[machine as Machine] ?? BRAND.red
  return (
    <div className="rounded-xl px-3.5 py-3" style={{ border: '1.5px solid #1c1c22' }}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
          <span className="font-bold truncate">{machine}</span>
        </span>
        <span className="font-black tabular-nums shrink-0">{fmt(meters)}</span>
      </div>
      <div className="h-1.5 rounded-full mt-2.5 overflow-hidden" style={{ background: '#141419' }}>
        <div className="h-full rounded-full" style={{ width: `${share}%`, background: color }} />
      </div>
      <div className="text-zinc-500 text-xs mt-1.5 tabular-nums">
        {count} {count === 1 ? 'session' : 'sessions'} · {Math.round(share)}% of your meters
      </div>
    </div>
  )
}

function Tile({ value, label, small = false }: { value: string; label: string; small?: boolean }) {
  return (
    <div className="rounded-xl px-2 py-3 text-center" style={{ border: '1.5px solid #1c1c22' }}>
      <div
        className="font-display leading-none tabular-nums truncate"
        style={{ fontSize: small ? '0.95rem' : '1.35rem' }}
      >
        {value}
      </div>
      <div className="uppercase tracking-[0.2em] text-zinc-500 text-[0.5rem] mt-1.5">{label}</div>
    </div>
  )
}
