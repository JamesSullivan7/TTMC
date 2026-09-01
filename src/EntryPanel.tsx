import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import { MACHINES, MACHINE_COLORS, BRAND, fmt, Machine, challengeDay } from './config'
import { machineUnit, parseAmount, toMeters, unitAbbrev, unitLabel } from '../convex/machines'
import { getTrainerKey, getLogKey, isAuthError } from './keys'
import PersonPicker, { Pickable } from './PersonPicker'
import LogResult, { LogOutcome } from './LogResult'

// Anything past this (in real meters) asks for confirmation before logging.
const BIG_ENTRY_METERS = 30_000

export function EntryForm() {
  const logEntry = useMutation(api.worldTour.logEntry)
  // The running total comes from this live subscription rather than from the
  // mutation, which no longer reads it — see the note in convex/worldTour.ts.
  const summary = useQuery(api.worldTour.getSummary)
  const people = useQuery(api.people.listPeople)
  const [person, setPerson] = useState<Pickable | null>(null)
  const [machine, setMachine] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle')
  const [lastLogged, setLastLogged] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [outcome, setOutcome] = useState<LogOutcome | null>(null)

  // The label, placeholder and step all follow the selected machine's screen —
  // a trainer should type exactly the number in front of them, nothing more.
  const unit = machine ? machineUnit(machine) : null
  const isDistance = unit === 'km' || unit === 'miles'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = machine ? parseAmount(machine, amount) : null
    if (!machine || n === null || unit === null) return

    const asMeters = toMeters(machine, n)
    if (
      asMeters > BIG_ENTRY_METERS &&
      !window.confirm(`${fmt(n)} ${unitAbbrev(unit)} is a big single entry — log it?`)
    ) {
      return
    }

    setStatus('saving')
    setErrorMsg('')
    const before = summary?.totalJourney ?? 0
    try {
      // The trainer PIN on the gym computer, the log token on a member's phone.
      // The server accepts either — see requireLogAccess in worldTour.ts.
      const res = await logEntry({
        machine,
        amount: n,
        key: getLogKey(),
        personId: (person?.id as any) ?? undefined,
      })
      setAmount('')
      setLastLogged(res.journeyMeters)
      setOutcome({
        meters: res.meters,
        journeyMeters: res.journeyMeters,
        totalBefore: before,
        totalAfter: before + res.journeyMeters,
      })
      setStatus('done')
      setTimeout(() => {
        setStatus('idle')
        setLastLogged(null)
      }, 2500)
    } catch (err: any) {
      const raw = String(err?.message ?? 'Could not log entry')
      const m = raw.match(/Max single entry[^\n]*/)
      setErrorMsg(m ? m[0] : 'Could not log entry — try again')
      setStatus('idle')
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
        <div style={{ width: '13rem' }}>
          <label className="block text-zinc-500 text-xs mb-1 uppercase tracking-wider">Who</label>
          <PersonPicker
            people={people}
            value={person}
            onChange={setPerson}
            placeholder="Type a name…"
            compact
          />
        </div>
        <div>
          <label className="block text-zinc-500 text-xs mb-1 uppercase tracking-wider">Machine</label>
          <select
            value={machine}
            onChange={(e) => {
              setMachine(e.target.value)
              setAmount('')
            }}
            className="bg-zinc-900 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 w-44 focus:outline-none"
            style={{ colorScheme: 'dark', borderColor: machine ? MACHINE_COLORS[machine as Machine] : undefined }}
          >
            <option value="" disabled>
              Select...
            </option>
            {MACHINES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="block text-xs mb-1 uppercase tracking-wider"
            style={{ color: isDistance ? BRAND.pink : '#71717a' }}
          >
            {unit ? unitLabel(unit) : 'Distance'}
          </label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={isDistance ? 'e.g. 2,08' : 'e.g. 2000'}
            min={0}
            className="bg-zinc-900 border text-white text-sm rounded-lg px-3 py-2 w-32 focus:outline-none placeholder:text-zinc-600"
            style={{ borderColor: isDistance ? BRAND.darkRed : '#3f3f46' }}
          />
        </div>
        <button
          type="submit"
          disabled={!machine || !amount || status === 'saving'}
          className="px-5 py-2 rounded-lg font-black text-sm uppercase tracking-wider transition-all disabled:opacity-40"
          style={{ background: status === 'done' ? '#10B981' : BRAND.red, color: '#fff' }}
        >
          {status === 'saving'
            ? '...'
            : status === 'done' && lastLogged
              ? `+${fmt(lastLogged)} m!`
              : person
                ? `Log for ${person.firstName}`
                : 'Log it'}
        </button>
        {isDistance && status !== 'done' && (
          <span className="text-[11px] self-center" style={{ color: BRAND.pink }}>
            Reads in {unit === 'km' ? 'kilometers' : 'miles'} — type what the screen says
          </span>
        )}
        {errorMsg && (
          <span className="text-xs font-bold self-center" style={{ color: '#F59E0B' }}>
            {errorMsg}
          </span>
        )}
      </form>
      {outcome && (
        <LogResult outcome={outcome} day={challengeDay()} onDone={() => setOutcome(null)} />
      )}
    </>
  )
}

// Simulate and reset are the only two things the trainer PIN cannot do. A
// four-digit PIN gets typed at the gym all day and is 10,000 guesses against a
// public endpoint — fine for logging and undo, not for erasing the month. So
// these ask for the admin key at the moment they are used, and deliberately do
// not remember it: walking away from an unlocked gym computer must not leave
// the ability to wipe the challenge sitting there.
export function DemoTools() {
  const simulateDay = useMutation(api.worldTour.simulateDay)
  const resetChallenge = useMutation(api.worldTour.resetChallenge)
  const trainerKey = getTrainerKey()
  const admin = useQuery(api.worldTour.isAdmin, trainerKey ? { key: trainerKey } : 'skip')
  const [busy, setBusy] = useState(false)

  async function run(fn: (key: string) => Promise<unknown>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return

    let key = trainerKey
    if (!admin) {
      const entered = window.prompt('This one needs the admin key, not the trainer PIN:')
      if (entered === null) return
      key = entered.trim()
    }

    setBusy(true)
    try {
      await fn(key)
    } catch (err) {
      window.alert(
        isAuthError(err)
          ? 'That key was not accepted.'
          : 'That did not go through. Try again.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3 text-xs flex-wrap">
      <span className="text-zinc-600 uppercase tracking-widest">Testing tools</span>
      <button
        disabled={busy}
        onClick={() => run((key) => simulateDay({ key }))}
        className="px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider text-zinc-300 hover:text-white transition-colors disabled:opacity-40"
        style={{ background: '#141414', border: '1px solid #2a2a2a' }}
      >
        Simulate a day (~273k m)
      </button>
      <button
        disabled={busy}
        onClick={() =>
          run(
            (key) => resetChallenge({ key }),
            'Wipe ALL entries and reset the challenge to zero?'
          )
        }
        className="px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-40"
        style={{ background: '#141414', border: '1px solid #2a2a2a' }}
      >
        Reset to zero
      </button>
      {admin === false && (
        <span className="text-zinc-600">These two ask for the admin key.</span>
      )}
    </div>
  )
}

export function RecentEntries() {
  const recent = useQuery(api.worldTour.getRecent)
  const deleteEntry = useMutation(api.worldTour.deleteEntry)

  if (!recent || recent.length === 0) return null

  return (
    <div className="rounded-xl p-3" style={{ background: '#0d0d0d', border: '1px solid #1c1c1c' }}>
      <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Recent entries</div>
      <div className="space-y-1">
        {recent.map((e) => {
          const typedInOwnUnit = e.unit !== null && e.unit !== 'meters' && e.input !== null
          return (
            <div key={e.id} className="flex items-center gap-2 text-xs">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: MACHINE_COLORS[e.machine as Machine] ?? '#666' }}
              />
              <span className="text-zinc-300 w-24 truncate">{e.machine}</span>
              <span className="w-28 truncate" style={{ color: e.personName ? '#fff' : '#52525b' }}>
                {e.personName ?? 'no name'}
              </span>
              {/* Show what was typed, so a trainer can check an entry against
                  the machine's screen without converting in their head. */}
              <span className="text-white font-bold tabular-nums">
                {typedInOwnUnit ? `${e.input} ${e.unit === 'km' ? 'km' : 'mi'}` : `${fmt(e.meters)} m`}
              </span>
              {typedInOwnUnit && (
                <span className="text-zinc-500 tabular-nums">({fmt(e.meters)} m)</span>
              )}
              <span className="text-zinc-600 tabular-nums">→ {fmt(e.journeyMeters)} m</span>
              <span className="text-zinc-600 ml-auto">
                {new Date(e.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
              <button
                onClick={() => deleteEntry({ id: e.id, key: getTrainerKey() })}
                className="text-zinc-600 hover:text-red-400 px-1"
                title="Undo this entry"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
