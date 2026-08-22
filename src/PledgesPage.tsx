import { useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import { BRAND, CHALLENGE_NAME, GOAL, MACHINE_COLORS, Machine, fmt, shortName } from './config'
import { getTrainerKey } from './keys'

// Who pledged what, and what they have actually done about it.
//
// The TV cycles names too fast to look anybody up, so this is where you read
// the list — and once September starts it is also the per-person lookup:
// search a name, see their total, their split across the machines, and how
// they are tracking against the number they claimed.
//
// The half that matters most before September is the second list: everybody on
// the roster who has not pledged yet. That is the chase list, and it is the one
// thing here that needs a trainer — a public wall naming people who have not
// signed up is a very different object from one celebrating those who have.

type Sort = 'name' | 'recent' | 'pledge' | 'done'

export default function PledgesPage() {
  const data = useQuery(api.people.peopleWithTotals)
  const isTrainer = getTrainerKey() !== ''
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('name')
  const [open, setOpen] = useState<string | null>(null)

  const { pledged, waiting, totalPledged, totalDone } = useMemo(() => {
    const all = data?.people ?? []
    const term = q.trim().toLowerCase()
    const match = (name: string) =>
      !term || name.toLowerCase().split(/\s+/).some((w) => w.startsWith(term))

    // Somebody who logs without ever pledging still belongs on the list — they
    // are taking part, which is the thing being celebrated.
    const p = all.filter((x) => (x.pledgeMeters > 0 || x.meters > 0) && match(x.name))
    const w = all.filter((x) => x.pledgeMeters === 0 && x.meters === 0 && match(x.name))

    p.sort((a, b) =>
      sort === 'pledge'
        ? b.pledgeMeters - a.pledgeMeters
        : sort === 'done'
          ? b.meters - a.meters
          : sort === 'recent'
            ? b.pledgedAt - a.pledgedAt
            : a.name.localeCompare(b.name)
    )
    w.sort((a, b) => a.name.localeCompare(b.name))

    return {
      pledged: p,
      waiting: w,
      totalPledged: all.reduce((s, x) => s + x.pledgeMeters, 0),
      totalDone: all.reduce((s, x) => s + x.meters, 0),
    }
  }, [data, q, sort])

  const remaining = Math.max(0, GOAL - totalPledged)
  const started = totalDone > 0 || (data?.unattributed ?? 0) > 0

  return (
    <div className="min-h-screen bg-[#050505] text-white px-5 py-7">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <img src="/logo-t.png" alt="" className="w-14 h-14 rounded-full" style={{ border: `2px solid ${BRAND.darkRed}` }} />
          <div>
            <div className="text-[10px] font-black tracking-[0.3em] uppercase" style={{ color: BRAND.red }}>
              Tulsa Training
            </div>
            <div className="font-display text-2xl uppercase leading-none">{CHALLENGE_NAME}</div>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-3 gap-3">
          {[
            { label: 'pledged', value: fmt(totalPledged), tint: '#fff' },
            started
              ? { label: 'done so far', value: fmt(totalDone + (data?.unattributed ?? 0)), tint: BRAND.pink }
              : { label: 'still to pledge', value: fmt(remaining), tint: BRAND.red },
            { label: 'people in', value: String(pledged.length), tint: '#fff' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl p-4" style={{ background: '#0d0d0d', border: '1px solid #1c1c1c' }}>
              <div className="font-display text-2xl leading-none tabular-nums" style={{ color: s.tint }}>
                {s.value}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1.5">{s.label}</div>
            </div>
          ))}
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a name…"
          className="mt-5 w-full bg-[#0d0d0d] text-white rounded-xl px-4 py-3 focus:outline-none placeholder:text-zinc-600"
          style={{ border: '1.5px solid #2a2a2a' }}
        />

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {(['name', 'recent', 'pledge', 'done'] as Sort[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className="px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-colors"
              style={
                sort === s
                  ? { background: BRAND.red, color: '#fff' }
                  : { background: '#141414', color: '#a1a1aa', border: '1px solid #2a2a2a' }
              }
            >
              {s === 'name' ? 'A–Z' : s === 'recent' ? 'Newest' : s === 'pledge' ? 'Biggest pledge' : 'Most done'}
            </button>
          ))}
        </div>

        <div className="mt-6 text-xs font-black uppercase tracking-[0.3em]" style={{ color: BRAND.pink }}>
          Taking part · {pledged.length}
        </div>
        <div className="mt-3 rounded-2xl overflow-hidden" style={{ border: '1px solid #1c1c1c' }}>
          {pledged.length === 0 && (
            <div className="px-4 py-5 text-zinc-600 text-sm" style={{ background: '#0d0d0d' }}>
              {q ? 'Nobody by that name.' : 'Nobody has pledged yet.'}
            </div>
          )}
          {pledged.map((p, i) => {
            const machines = Object.entries(p.byMachine).sort((a, b) => b[1] - a[1])
            const expanded = open === p.id
            return (
              <div key={p.id} style={{ background: '#0d0d0d', borderTop: i ? '1px solid #161616' : undefined }}>
                <button
                  onClick={() => setOpen(expanded ? null : p.id)}
                  className="w-full text-left px-4 py-3"
                  disabled={machines.length === 0}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-bold truncate">
                      {isTrainer ? p.name : shortName(p.firstName, p.lastName)}
                      {p.keptPledge && (
                        <span className="ml-2 text-[10px] font-black uppercase tracking-wider" style={{ color: '#10B981' }}>
                          kept it
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums shrink-0 text-sm">
                      {started && (
                        <span className="font-black" style={{ color: BRAND.pink }}>
                          {fmt(p.meters)}
                        </span>
                      )}
                      {started && p.pledgeMeters > 0 && <span className="text-zinc-600"> / </span>}
                      {p.pledgeMeters > 0 && (
                        <span className={started ? 'text-zinc-500' : 'font-black'} style={started ? undefined : { color: BRAND.pink }}>
                          {fmt(p.pledgeMeters)}
                        </span>
                      )}
                    </span>
                  </div>

                  {started && p.pledgeMeters > 0 && (
                    <div className="relative h-1.5 rounded-full mt-2" style={{ background: '#1c1c1c' }}>
                      <div
                        className="absolute left-0 top-0 h-full rounded-full"
                        style={{
                          width: `${p.pledgePct}%`,
                          background: p.keptPledge ? '#10B981' : BRAND.red,
                        }}
                      />
                    </div>
                  )}
                </button>

                {expanded && machines.length > 0 && (
                  <div className="px-4 pb-4 -mt-1">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">
                      {p.entries} {p.entries === 1 ? 'entry' : 'entries'}
                    </div>
                    <div className="space-y-1.5">
                      {machines.map(([m, meters]) => (
                        <div key={m} className="flex items-center gap-2 text-sm">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: MACHINE_COLORS[m as Machine] ?? '#666' }}
                          />
                          <span className="text-zinc-300 w-32 truncate">{m}</span>
                          <span className="font-bold tabular-nums">{fmt(meters)} m</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {started && (data?.unattributed ?? 0) > 0 && (
          <div className="mt-3 text-xs text-zinc-600">
            {fmt(data!.unattributed)} m logged without a name. Counts for the gym, not for a person.
          </div>
        )}

        {/* The chase list. Trainers only — a public page naming everyone who
            has not signed up yet would be a different thing entirely. */}
        {isTrainer ? (
          <>
            <div className="mt-8 text-xs font-black uppercase tracking-[0.3em] text-zinc-500">
              Not pledged yet · {waiting.length}
            </div>
            <div className="mt-3 rounded-2xl overflow-hidden" style={{ border: '1px solid #1c1c1c' }}>
              {waiting.length === 0 && (
                <div className="px-4 py-5 text-zinc-600 text-sm" style={{ background: '#0d0d0d' }}>
                  {data && data.people.length === 0
                    ? 'No member list imported yet.'
                    : 'Everyone on the list is in.'}
                </div>
              )}
              {waiting.map((p, i) => (
                <div
                  key={p.id}
                  className="px-4 py-3 text-zinc-400"
                  style={{ background: '#0d0d0d', borderTop: i ? '1px solid #161616' : undefined }}
                >
                  {p.name}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-8 text-xs text-zinc-600">
            Trainers: log in on the main screen to see who has not pledged yet.
          </div>
        )}
      </div>
    </div>
  )
}
