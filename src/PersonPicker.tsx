import { useMemo, useState } from 'react'
import { BRAND, shortName } from './config'

// Find a person by typing. Shared by the trainer's entry form and the phone,
// because both need the same thing: type "ja", get the Jameses, pick one.
//
// Matched on any word start, so "sul" finds James Sullivan and "or" finds Ana
// Ortiz. Filtered here against a roster that arrives once rather than queried
// per keystroke — 182 rows is nothing, and a trainer with somebody waiting at
// the desk should never be watching a spinner.

export type Pickable = {
  id: string
  name: string
  firstName: string
  lastName: string
}

export default function PersonPicker({
  people,
  value,
  onChange,
  placeholder = 'Type a name…',
  compact = false,
}: {
  people: Pickable[] | undefined
  value: Pickable | null
  onChange: (p: Pickable | null) => void
  placeholder?: string
  compact?: boolean
}) {
  const [q, setQ] = useState('')

  const indexed = useMemo(
    () => (people ?? []).map((p) => ({ p, words: p.name.toLowerCase().split(/\s+/) })),
    [people]
  )

  const matches = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!terms.length) return []
    return indexed
      .filter(({ words }) => terms.every((t) => words.some((w) => w.startsWith(t))))
      .slice(0, 6)
      .map(({ p }) => p)
  }, [indexed, q])

  if (value) {
    return (
      <div
        className="flex items-center justify-between gap-3 rounded-xl px-3"
        style={{
          background: '#0d0d0d',
          border: `1.5px solid ${BRAND.darkRed}`,
          paddingTop: compact ? 8 : 12,
          paddingBottom: compact ? 8 : 12,
        }}
      >
        <span className="font-bold truncate" style={{ fontSize: compact ? '0.9rem' : '1.05rem' }}>
          {value.name}
        </span>
        <button
          type="button"
          onClick={() => {
            onChange(null)
            setQ('')
          }}
          className="text-zinc-500 hover:text-white shrink-0 px-1"
          aria-label="Change person"
        >
          ×
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full bg-[#0d0d0d] text-white rounded-xl px-3 focus:outline-none placeholder:text-zinc-600"
        style={{
          border: '1.5px solid #2a2a2a',
          paddingTop: compact ? 8 : 12,
          paddingBottom: compact ? 8 : 12,
          fontSize: compact ? '0.9rem' : '1.05rem',
        }}
      />
      {q.trim().length > 0 && (
        <div
          className="absolute left-0 right-0 mt-1 rounded-xl overflow-hidden z-20"
          style={{ border: '1.5px solid #2a2a2a', background: '#0d0d0d' }}
        >
          {matches.length === 0 ? (
            <div className="px-3 py-3 text-sm text-zinc-500">
              No match. Check the spelling, or leave it blank.
            </div>
          ) : (
            matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p)
                  setQ('')
                }}
                className="w-full text-left px-3 py-2.5 font-bold transition-colors hover:bg-[#161616]"
                style={{ borderBottom: '1px solid #161616', fontSize: compact ? '0.9rem' : '1rem' }}
              >
                {p.name}
                <span className="text-zinc-600 font-normal ml-2 text-xs">{shortName(p.firstName, p.lastName)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
