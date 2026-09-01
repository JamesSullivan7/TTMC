import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import {
  BRAND,
  CHALLENGE_NAME,
  GOAL,
  MACHINES,
  MACHINE_COLORS,
  Machine,
  Milestone,
  challengeDay,
  crossedMilestones,
  fmt,
  fmtKm,
} from './config'
import { machineUnit, parseAmount, toMeters, unitAbbrev, unitLabel } from '../convex/machines'
import { locationLabel } from './geo'
import { downloadShareCard } from './shareCard'
import { getLogKey, getLogToken, setLogToken, getPersonId, setPersonId, clearPersonId } from './keys'
import PersonPicker, { Pickable } from './PersonPicker'

// The member-facing page, reached by scanning the QR on a machine. Everything
// here is one-handed and sweaty-thumbed: big targets, no navigation, no map,
// and as little to download as possible on gym wifi.
//
// The point of this page is the moment after you log. On the TV your 2,000 m
// is 0.02% of a bar. Here it is a named piece of road that you moved the gym
// along, and it belongs to you.

type Outcome = {
  meters: number
  journeyMeters: number
  totalBefore: number
  totalAfter: number
  crossed: Milestone[]
}

export default function LogPage() {
  const logEntry = useMutation(api.worldTour.logEntry)
  const addPerson = useMutation(api.people.addPerson)
  const summary = useQuery(api.worldTour.getSummary)
  const people = useQuery(api.people.listPeople)

  // Whoever pledged on this phone. Kept so a member is not asked their name
  // every time they finish on a machine — but changeable, because phones get
  // handed to a friend.
  const [person, setPerson] = useState<Pickable | null>(null)
  const storedPersonId = getPersonId()
  const knownPerson = useMemo(
    () => (people ?? []).find((p) => (p.id as unknown as string) === storedPersonId) ?? null,
    [people, storedPersonId]
  )
  const who = person ?? knownPerson

  // A remembered id can outlive what it points at — a trainer removing a
  // duplicate, a reset, or a phone that once opened the dev deployment. This
  // page survives that on its own, because it resolves the id against the
  // roster and falls back to asking. But it never cleared the dead value, so it
  // asked again on every visit forever, and /me could not use it either. Only
  // once the roster has actually arrived: an empty list is loading, not proof.
  useEffect(() => {
    if (storedPersonId && people && people.length > 0 && !knownPerson) clearPersonId()
  }, [storedPersonId, people, knownPerson])

  const params = new URLSearchParams(window.location.search)
  const [machine, setMachine] = useState<string>(() => {
    const m = params.get('m')
    return m && (MACHINES as readonly string[]).includes(m) ? m : ''
  })
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  // The QR carries the token. Keep it, so a member only ever has to scan once
  // and can log from the couch afterwards if they forgot at the machine.
  useEffect(() => {
    const t = params.get('t')
    if (t) {
      setLogToken(t)
      // Drop it out of the address bar so it isn't screenshotted or shared.
      const clean = window.location.pathname + (machine ? `?m=${encodeURIComponent(machine)}` : '')
      window.history.replaceState({}, '', clean)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasToken = getLogToken() !== '' || getLogKey() !== ''
  const unit = machine ? machineUnit(machine) : null
  const isDistance = unit === 'km' || unit === 'miles'
  const parsed = machine ? parseAmount(machine, amount) : null
  const total = summary?.totalJourney ?? 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const n = machine ? parseAmount(machine, amount) : null
    if (!machine || n === null || unit === null || busy || !who) return
    setBusy(true)
    setError('')
    // Taken from the live subscription, not returned by the mutation — which
    // no longer reads the total, so that concurrent logs cannot conflict.
    const before = summary?.totalJourney ?? 0
    try {
      const res = await logEntry({
        machine,
        amount: n,
        key: getLogKey(),
        personId: who!.id as any,
      })
      const after = before + res.journeyMeters
      setOutcome({
        meters: res.meters,
        journeyMeters: res.journeyMeters,
        totalBefore: before,
        totalAfter: after,
        crossed: crossedMilestones(before, after),
      })
      setAmount('')
    } catch (err: any) {
      const raw = String(err?.message ?? '')
      if (/not authorized/i.test(raw)) {
        setError('Scan the QR code on the machine to start logging.')
      } else if (/Max single entry/i.test(raw)) {
        setError(raw.match(/Max single entry[^\n]*/)![0])
      } else if (/Too many/i.test(raw)) {
        setError('Lots of entries just came in — try again in a minute.')
      } else {
        setError('That did not go through. Try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  // ── The moment ────────────────────────────────────────────────────────────
  if (outcome) {
    const from = locationLabel(outcome.totalBefore)
    const to = locationLabel(outcome.totalAfter)
    const movedOn = from.nextStop !== to.nextStop
    const headline = outcome.crossed[outcome.crossed.length - 1] ?? null

    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center px-6 py-10 text-center">
        <img
          src="/logo-t.png"
          alt=""
          className="w-16 h-16 rounded-full mb-5"
          style={{ border: `2px solid ${BRAND.red}`, boxShadow: `0 0 18px ${BRAND.red}66` }}
        />
        <div className="text-xs font-black uppercase tracking-[0.4em]" style={{ color: BRAND.pink }}>
          You just moved us
        </div>
        <div
          className="font-display uppercase leading-none mt-3"
          style={{ fontSize: 'clamp(3rem, 18vw, 5.5rem)' }}
        >
          {fmt(outcome.journeyMeters)}
        </div>
        <div className="text-sm text-zinc-400 -mt-1">meters down the road</div>

        <div className="mt-7 text-xl font-bold leading-snug max-w-sm">
          {to.done ? (
            // The road has run out. There is no next stop to be closer to, and
            // saying there is reads as broken at the one moment that matters.
            <>
              The gym is <span style={{ color: BRAND.red }}>home</span>. That is on top of the
              whole road.
            </>
          ) : movedOn ? (
            <>
              {from.where} <span style={{ color: BRAND.red }}>→</span> {to.where}
            </>
          ) : (
            <>
              {fmtKm(outcome.journeyMeters)} closer to{' '}
              <span style={{ color: BRAND.red }}>{to.nextStop}</span>
            </>
          )}
        </div>
        {!to.done && to.toNext > 0 && (
          <div className="mt-2 text-sm text-zinc-500">
            {fmtKm(to.toNext)} to {to.nextStop}
          </div>
        )}

        {headline && (
          <div
            className="mt-7 pt-6 w-full max-w-sm"
            style={{ borderTop: `1px solid ${BRAND.darkRed}` }}
          >
            <div className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: BRAND.pink }}>
              You took us past
            </div>
            <div className="font-display uppercase text-2xl mt-2 leading-tight">{headline.name}</div>
            {outcome.crossed.length > 1 && (
              <div className="text-xs text-zinc-500 mt-1">
                and {outcome.crossed.length - 1} more
              </div>
            )}
            <button
              onClick={() => downloadShareCard(headline, challengeDay())}
              className="mt-4 w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest"
              style={{ background: BRAND.red, color: '#fff' }}
            >
              Save share card
            </button>
          </div>
        )}

        <button
          onClick={() => setOutcome(null)}
          className="mt-8 w-full max-w-sm py-4 rounded-xl font-black text-sm uppercase tracking-widest"
          style={{ background: '#141414', border: '1px solid #2a2a2a', color: '#d4d4d8' }}
        >
          Log another
        </button>

        {/* The only route into /me that does not require finding the printed
            card again. This is also the moment it is worth most: they have just
            finished, the number is fresh, and "what have I done altogether" is
            the next question. Only offered when we know who they are — the page
            has nothing to show otherwise. */}
        {who && (
          <a
            href="/me"
            className="mt-3 block w-full max-w-sm py-4 rounded-xl font-black text-sm uppercase tracking-widest text-center transition-opacity hover:opacity-80"
            style={{ border: `1.5px solid ${BRAND.darkRed}`, color: BRAND.pink }}
          >
            All your meters
          </a>
        )}

        <div className="mt-6 text-xs text-zinc-600">
          The gym is at {fmt(outcome.totalAfter)} of {fmt(GOAL)} m
        </div>
      </div>
    )
  }

  // ── The form ──────────────────────────────────────────────────────────────
  const loc = locationLabel(total)

  return (
    <div className="min-h-screen bg-[#050505] text-white px-5 py-7">
      <div className="max-w-sm mx-auto">
        <div className="flex items-center gap-3">
          <img
            src="/logo-t.png"
            alt=""
            className="w-11 h-11 rounded-full"
            style={{ border: `1.5px solid ${BRAND.darkRed}` }}
          />
          <div>
            <div className="text-[10px] font-black tracking-[0.3em] uppercase" style={{ color: BRAND.red }}>
              Tulsa Training
            </div>
            <div className="font-display text-xl uppercase leading-none">{CHALLENGE_NAME}</div>
          </div>
        </div>

        {!hasToken ? (
          <div
            className="mt-10 rounded-2xl p-6 text-center"
            style={{ background: '#0d0d0d', border: '1px solid #2a2a2a' }}
          >
            <div className="font-display uppercase text-xl">Scan to log</div>
            <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
              Point your camera at the QR code on any machine to start logging your meters.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-7">
            {/* Whose meters these are. The phone already knows if they pledged
                on it, so this is normally just a confirmation — but phones get
                handed to a friend at the machine, so it stays changeable. */}
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Who is logging?</div>
            <PersonPicker
            onCreate={async (firstName, lastName) => {
              try {
                const made = await addPerson({ key: getLogKey(), firstName, lastName })
                return { id: made.id as unknown as string, name: made.name,
                           firstName, lastName }
              } catch {
                return null
              }
            }}
              people={people}
              value={who}
              onChange={(p) => {
                setPerson(p)
                if (p) setPersonId(p.id as unknown as string)
              }}
              placeholder="Type your name…"
            />
            {!who && (
              <div className="mt-2 text-xs text-zinc-500 leading-relaxed">
                Pick your name to log — meters have to land on somebody to count toward
                your pledge and your badges. Not on the list? Type your full name and
                add yourself.
              </div>
            )}

            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2 mt-6">Which machine?</div>
            <div className="grid grid-cols-2 gap-2">
              {MACHINES.map((m) => {
                const on = m === machine
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMachine(m)
                      setAmount('')
                    }}
                    className="py-3 px-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all"
                    style={{
                      background: on ? MACHINE_COLORS[m as Machine] : '#0d0d0d',
                      color: on ? '#000' : '#a1a1aa',
                      border: `1.5px solid ${on ? MACHINE_COLORS[m as Machine] : '#2a2a2a'}`,
                    }}
                  >
                    {m}
                  </button>
                )
              })}
            </div>

            {machine && (
              <>
                <div className="mt-6 flex items-baseline justify-between">
                  <span className="text-xs uppercase tracking-widest text-zinc-500">
                    {unit ? unitLabel(unit) : 'Distance'}
                  </span>
                  {isDistance && (
                    <span className="text-[11px] font-bold" style={{ color: BRAND.pink }}>
                      this one reads in {unit === 'km' ? 'kilometers' : 'miles'}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={isDistance ? '2,08' : '2000'}
                  className="mt-2 w-full bg-[#0d0d0d] text-white text-center rounded-xl px-4 py-5 focus:outline-none placeholder:text-zinc-700 font-display"
                  style={{
                    fontSize: '3rem',
                    border: `1.5px solid ${isDistance ? BRAND.darkRed : '#2a2a2a'}`,
                  }}
                />
                <div className="mt-1.5 text-center text-xs text-zinc-600">
                  type the number off the machine's screen
                </div>

                <button
                  type="submit"
                  disabled={parsed === null || !who || busy}
                  className="mt-5 w-full py-5 rounded-xl font-black text-base uppercase tracking-widest transition-all disabled:opacity-40"
                  style={{ background: BRAND.red, color: '#fff' }}
                >
                  {busy ? 'Logging…' : 'Log it'}
                </button>

                {amount.trim() !== '' && unit && machine && (
                  <div className="mt-2 text-center text-xs text-zinc-500">
                    {parsed === null
                      ? 'that is not a number I can read'
                      : isDistance
                        ? `${parsed} ${unitAbbrev(unit)} = ${fmt(toMeters(machine, parsed))} meters`
                        : `${fmt(parsed)} meters down the road`}
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="mt-4 text-center text-sm font-bold" style={{ color: '#F59E0B' }}>
                {error}
              </div>
            )}
          </form>
        )}

        {/* Where the gym is right now — context, not the main event. */}
        <div
          className="mt-10 rounded-2xl p-4"
          style={{ background: '#0d0d0d', border: '1px solid #1c1c1c' }}
        >
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">The gym is at</div>
          <div className="font-display text-2xl tabular-nums leading-tight mt-0.5">{fmt(total)}</div>
          <div className="text-xs text-zinc-500">
            of {fmt(GOAL)} m ·{' '}
            <span style={{ color: BRAND.red }} className="font-black">
              {((total / GOAL) * 100).toFixed(1)}%
            </span>
          </div>
          {loc.toNext > 0 && (
            <div className="text-sm mt-2.5">
              <span className="text-zinc-500">Next stop </span>
              <span className="font-bold">{loc.nextStop}</span>
              <span className="text-zinc-500"> · {fmtKm(loc.toNext)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
