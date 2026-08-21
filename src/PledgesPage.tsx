import { useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import { BRAND, CHALLENGE_NAME, GOAL, fmt, shortName } from './config'
import { getTrainerKey } from './keys'

// The browsable version of the board. The TV cycles through names too fast to
// look anybody up, so this is where you actually read the list.
//
// The half that matters for the next eleven days is the second one: everybody
// on the roster who has not pledged yet. That is the chase list, and it is the
// only thing here that needs a trainer — a public wall naming people who have
// not signed up is a very different object from one celebrating those who have.

type Sort = 'name' | 'recent' | 'amount'

export default function PledgesPage() {
  const roster = useQuery(api.people.listPeople)
  const isTrainer = getTrainerKey() !== ''
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('name')

  const { pledged, waiting, total } = useMemo(() => {
    const all = roster ?? []
    const term = q.trim().toLowerCase()
    const match = (name: string) =>
      !term || name.toLowerCase().split(/\s+/).some((w) => w.startsWith(term))

    const p = all.filter((x) => x.pledgeMeters > 0 && match(x.name))
    const w = all.filter((x) => x.pledgeMeters === 0 && match(x.name))

    p.sort((a, b) =>
      sort === 'amount'
        ? b.pledgeMeters - a.pledgeMeters
        : sort === 'recent'
          ? b.pledgedAt - a.pledgedAt
          : a.name.localeCompare(b.name)
    )
    w.sort((a, b) => a.name.localeCompare(b.name))

    return {
      pledged: p,
      waiting: w,
      total: all.filter((x) => x.pledgeMeters > 0).reduce((s, x) => s + x.pledgeMeters, 0),
    }
  }, [roster, q, sort])

  const remaining = Math.max(0, GOAL - total)

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
            { label: 'pledged', value: fmt(total), tint: '#fff' },
            { label: 'still to pledge', value: fmt(remaining), tint: BRAND.red },
            { label: 'people in', value: String(roster ? roster.filter((r) => r.pledgeMeters > 0).length : 0), tint: '#fff' },
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

        <div className="mt-4 flex items-center gap-2">
          {(['name', 'recent', 'amount'] as Sort[]).map((s) => (
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
              {s === 'name' ? 'A–Z' : s === 'recent' ? 'Newest' : 'Largest'}
            </button>
          ))}
        </div>

        <div className="mt-6 text-xs font-black uppercase tracking-[0.3em]" style={{ color: BRAND.pink }}>
          Pledged · {pledged.length}
        </div>
        <div className="mt-3 rounded-2xl overflow-hidden" style={{ border: '1px solid #1c1c1c' }}>
          {pledged.length === 0 && (
            <div className="px-4 py-5 text-zinc-600 text-sm" style={{ background: '#0d0d0d' }}>
              {q ? 'Nobody by that name has pledged.' : 'Nobody has pledged yet.'}
            </div>
          )}
          {pledged.map((p, i) => (
            <div
              key={p.id}
              className="flex items-baseline justify-between gap-4 px-4 py-3"
              style={{ background: '#0d0d0d', borderTop: i ? '1px solid #161616' : undefined }}
            >
              <span className="font-bold truncate">{shortName(p.firstName, p.lastName)}</span>
              <span className="font-black tabular-nums shrink-0" style={{ color: BRAND.pink }}>
                {fmt(p.pledgeMeters)}
              </span>
            </div>
          ))}
        </div>

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
                  {roster && roster.length === 0
                    ? 'No member list imported yet.'
                    : 'Everyone on the list has pledged.'}
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
