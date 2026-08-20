import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import { MACHINES, MACHINE_COLORS, BRAND, fmt, Machine } from './config'

export function EntryForm() {
  const logEntry = useMutation(api.worldTour.logEntry)
  const [machine, setMachine] = useState<string>('')
  const [meters, setMeters] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle')
  const [lastLogged, setLastLogged] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(meters)
    if (!machine || !n || n <= 0) return
    if (n > 30_000 && !window.confirm(`${fmt(n)} meters is a big single entry — log it?`)) return
    setStatus('saving')
    setErrorMsg('')
    try {
      const res = await logEntry({ machine, meters: n })
      setMeters('')
      setLastLogged(res.journeyMeters)
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
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
      <div>
        <label className="block text-zinc-500 text-xs mb-1 uppercase tracking-wider">Machine</label>
        <select
          value={machine}
          onChange={(e) => setMachine(e.target.value)}
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
        <label className="block text-zinc-500 text-xs mb-1 uppercase tracking-wider">Meters</label>
        <input
          type="number"
          value={meters}
          onChange={(e) => setMeters(e.target.value)}
          placeholder="e.g. 2000"
          min={1}
          className="bg-zinc-900 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 w-32 focus:outline-none placeholder:text-zinc-600"
        />
      </div>
      <button
        type="submit"
        disabled={!machine || !meters || status === 'saving'}
        className="px-5 py-2 rounded-lg font-black text-sm uppercase tracking-wider transition-all disabled:opacity-40"
        style={{ background: status === 'done' ? '#10B981' : BRAND.red, color: '#fff' }}
      >
        {status === 'saving' ? '...' : status === 'done' && lastLogged ? `+${fmt(lastLogged)} m!` : 'Log it'}
      </button>
      {errorMsg && (
        <span className="text-xs font-bold self-center" style={{ color: '#F59E0B' }}>
          {errorMsg}
        </span>
      )}
    </form>
  )
}

export function DemoTools() {
  const simulateDay = useMutation(api.worldTour.simulateDay)
  const resetChallenge = useMutation(api.worldTour.resetChallenge)
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<unknown>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-zinc-600 uppercase tracking-widest">Testing tools</span>
      <button
        disabled={busy}
        onClick={() => run(() => simulateDay({}))}
        className="px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider text-zinc-300 hover:text-white transition-colors disabled:opacity-40"
        style={{ background: '#141414', border: '1px solid #2a2a2a' }}
      >
        Simulate a day (~1.35M m)
      </button>
      <button
        disabled={busy}
        onClick={() =>
          run(() => resetChallenge({}), 'Wipe ALL entries and reset the challenge to zero?')
        }
        className="px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-40"
        style={{ background: '#141414', border: '1px solid #2a2a2a' }}
      >
        Reset to zero
      </button>
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
        {recent.map((e) => (
          <div key={e.id} className="flex items-center gap-2 text-xs">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: MACHINE_COLORS[e.machine as Machine] ?? '#666' }}
            />
            <span className="text-zinc-300 w-28 truncate">{e.machine}</span>
            <span className="text-white font-bold tabular-nums">{fmt(e.meters)} m</span>
            <span className="text-zinc-600 tabular-nums">→ {fmt(e.journeyMeters)} m</span>
            <span className="text-zinc-600 ml-auto">
              {new Date(e.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
            <button
              onClick={() => deleteEntry({ id: e.id })}
              className="text-zinc-600 hover:text-red-400 px-1"
              title="Undo this entry"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
