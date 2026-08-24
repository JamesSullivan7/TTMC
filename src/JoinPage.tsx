import { useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import { BRAND, CHALLENGE_NAME, CHALLENGE_WINDOW, GOAL, fmt } from './config'
import { setLogToken, setPersonId } from './keys'

// Reached by scanning the code on the gym TV. One job: claim your meters.
//
// An even split would ask the same of everyone, and this gym has members in
// their twenties and members in their seventies. So each person names their
// own number instead, and the sum of those numbers is what the gym has
// committed to the road.

// Four numbers to tap, and your own if none of them is yours.
//
// These are ambitious against the arithmetic — an even share of the route
// across 182 members is about 46,500, so the smallest button here is roughly
// three times that. That is deliberate: the people actually signing up are
// pledging far more than the old tiers suggested, and a button nobody picks is
// not doing any work.
//
// Which is exactly why the custom field below is not a fallback. The gym has
// members in their twenties and members in their seventies, and a row of large
// round numbers anchors hard — somebody who can honestly do 30,000 has to be
// able to say so without feeling they have picked the loser's option.
const TIERS = [150_000, 250_000, 350_000, 500_000]

export default function JoinPage() {
  const pledge = useMutation(api.people.pledge)
  const people = useQuery(api.people.listPeople)

  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [meters, setMeters] = useState<number | null>(null)
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ name: string; pledgeMeters: number; already: boolean } | null>(null)

  // The token rides in the QR, so scanning here also sets the phone up to log
  // meters from day one — one scan, not two.
  useMemo(() => {
    const t = new URLSearchParams(window.location.search).get('t')
    if (t) {
      setLogToken(t)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const totalPledged = (people ?? []).reduce((s, p) => s + p.pledgeMeters, 0)
  const remaining = Math.max(0, GOAL - totalPledged)

  // If they have pledged before, spot it while they type rather than after
  // they submit — and show them what they already claimed.
  const existing = useMemo(() => {
    if (!people || first.trim().length < 2 || last.trim().length < 1) return null
    const key = `${first.trim()} ${last.trim()}`.toLowerCase()
    return people.find((p) => p.name.toLowerCase() === key) ?? null
  }, [people, first, last])

  // Split once when the roster arrives, not on every keystroke.
  const indexed = useMemo(
    () => (people ?? []).map((p) => ({ p, words: p.name.toLowerCase().split(/\s+/) })),
    [people]
  )

  // Matched on any word start, so "sul" finds James Sullivan and "ja" finds
  // every James and Jackson. Filtered here rather than on the server: the
  // roster arrives once and every keystroke is instant with no round trip.
  const suggestions = useMemo(() => {
    const terms = `${first} ${last}`.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!terms.length || terms.join(' ').length < 2) return []
    const exact = `${first.trim()} ${last.trim()}`.toLowerCase()
    return indexed
      .filter(({ p, words }) => {
        if (p.name.toLowerCase() === exact) return false // already covered below
        return terms.every((t) => words.some((w) => w.startsWith(t)))
      })
      .slice(0, 5)
      .map(({ p }) => p)
  }, [indexed, first, last])

  const amount = meters ?? (custom ? Math.round(Number(custom)) : 0)
  const canSubmit = first.trim().length >= 2 && last.trim().length >= 1 && amount >= 1000 && !busy

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError('')
    try {
      const res = await pledge({ firstName: first, lastName: last, meters: amount })
      // So September does not ask them who they are every single time.
      setPersonId(res.id as unknown as string)
      setDone({ name: res.name, pledgeMeters: res.pledgeMeters, already: res.alreadyPledged })
    } catch (err: any) {
      const raw = String(err?.message ?? '')
      const m = raw.match(/(Please [^\n]*|That is more than[^\n]*|That name is too long|Lots of people[^\n]*)/)
      setError(m ? m[0] : 'That did not go through. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center px-6 py-10 text-center">
        <img
          src="/logo-t.png"
          alt=""
          className="w-16 h-16 rounded-full mb-5"
          style={{ border: `2px solid ${BRAND.red}`, boxShadow: `0 0 18px ${BRAND.red}66` }}
        />
        <div className="text-xs font-black uppercase tracking-[0.4em]" style={{ color: BRAND.pink }}>
          {done.already ? 'Pledge updated' : "You're in"}
        </div>
        <div className="font-display uppercase leading-none mt-3" style={{ fontSize: 'clamp(2.4rem, 13vw, 4rem)' }}>
          {done.name}
        </div>
        <div className="mt-6 text-sm text-zinc-400">has pledged</div>
        <div className="font-display leading-none mt-1" style={{ fontSize: 'clamp(3rem, 17vw, 5rem)', color: BRAND.red }}>
          {fmt(done.pledgeMeters)}
        </div>
        <div className="text-sm text-zinc-400 -mt-1">meters</div>

        <p className="mt-8 text-sm text-zinc-400 max-w-xs leading-relaxed">
          Your name is on the gym screen. When the challenge starts, scan the code on any
          machine to log what you do.
        </p>

        <button
          onClick={() => { setDone(null); setMeters(null); setCustom('') }}
          className="mt-8 w-full max-w-sm py-4 rounded-xl font-black text-sm uppercase tracking-widest"
          style={{ background: '#141414', border: '1px solid #2a2a2a', color: '#d4d4d8' }}
        >
          Pledge for someone else
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white px-5 py-7">
      <div className="max-w-sm mx-auto">
        <div className="flex items-center gap-3">
          <img src="/logo-t.png" alt="" className="w-11 h-11 rounded-full" style={{ border: `1.5px solid ${BRAND.darkRed}` }} />
          <div>
            <div className="text-[10px] font-black tracking-[0.3em] uppercase" style={{ color: BRAND.red }}>
              Tulsa Training
            </div>
            <div className="font-display text-xl uppercase leading-none">{CHALLENGE_NAME}</div>
          </div>
        </div>

        <h1 className="font-display uppercase mt-7 leading-none" style={{ fontSize: 'clamp(2rem, 10vw, 2.8rem)' }}>
          Pledge your meters
        </h1>
        <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
          This September the whole gym drives {fmt(GOAL)} meters together — Tulsa to Los
          Angeles to New York and home. Say how much of it you will cover. Whatever is
          honest for you: it all goes on the road.
        </p>

        <form onSubmit={submit} className="mt-7">
          <div className="grid grid-cols-2 gap-2">
            {/* htmlFor/id rather than a label that merely sits above the box.
                Without the pairing a screen reader reads two unnamed text
                fields, and tapping the word "First name" does not focus
                anything — which on a phone is the obvious thing to try. */}
            <div>
              <label
                htmlFor="join-first"
                className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5"
              >
                First name
              </label>
              <input
                id="join-first"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                autoComplete="given-name"
                className="w-full bg-[#0d0d0d] text-white rounded-xl px-3 py-3 text-lg focus:outline-none"
                style={{ border: '1.5px solid #2a2a2a' }}
              />
            </div>
            <div>
              <label
                htmlFor="join-last"
                className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5"
              >
                Last name
              </label>
              <input
                id="join-last"
                value={last}
                onChange={(e) => setLast(e.target.value)}
                autoComplete="family-name"
                className="w-full bg-[#0d0d0d] text-white rounded-xl px-3 py-3 text-lg focus:outline-none"
                style={{ border: '1.5px solid #2a2a2a' }}
              />
            </div>
          </div>

          {/* Suggestions from the gym's member list. Typing "ja" narrows to the
              Jameses and Jacksons; tapping one fills both fields, which is how
              a roster of 182 stays 182 rows instead of quietly becoming 210
              because people spell themselves differently on a phone. */}
          {suggestions.length > 0 && (
            <div className="mt-2 rounded-xl overflow-hidden" style={{ border: '1.5px solid #2a2a2a' }}>
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setFirst(p.firstName)
                    setLast(p.lastName)
                  }}
                  className="w-full text-left px-3 py-3 text-base font-bold transition-colors"
                  style={{ background: '#0d0d0d', color: '#d4d4d8', borderBottom: '1px solid #161616' }}
                >
                  {p.name}
                  {p.pledgeMeters > 0 && (
                    <span className="text-xs font-normal ml-2" style={{ color: BRAND.pink }}>
                      already pledged {fmt(p.pledgeMeters)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {existing && existing.pledgeMeters > 0 && (
            <div className="mt-3 text-xs rounded-lg px-3 py-2" style={{ background: '#161616', border: `1px solid ${BRAND.darkRed}`, color: BRAND.pink }}>
              You already pledged {fmt(existing.pledgeMeters)} m. Pledging more will raise it.
            </div>
          )}

          <div className="mt-6 text-[10px] uppercase tracking-widest text-zinc-500 mb-2">How many meters?</div>
          <div className="grid grid-cols-2 gap-2">
            {TIERS.map((t) => {
              const on = meters === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setMeters(t); setCustom('') }}
                  className="py-4 rounded-xl font-black text-base transition-all"
                  style={{
                    background: on ? BRAND.red : '#0d0d0d',
                    color: on ? '#fff' : '#a1a1aa',
                    border: `1.5px solid ${on ? BRAND.red : '#2a2a2a'}`,
                  }}
                >
                  {t.toLocaleString('en-US')}
                </button>
              )
            })}
          </div>

          {/* Given as an equal choice rather than a fallback under the tiers.
              Whatever is honest for you is the whole basis of pledging at all,
              and it has to look like one of the options, not the way out. */}
          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px" style={{ background: '#2a2a2a' }} />
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">or your own number</span>
            <div className="flex-1 h-px" style={{ background: '#2a2a2a' }} />
          </div>

          <input
            type="number"
            inputMode="numeric"
            value={custom}
            onChange={(e) => { setCustom(e.target.value); setMeters(null) }}
            placeholder="whatever is honest for you"
            aria-label="Your own number of meters"
            className="w-full bg-[#0d0d0d] text-white text-center rounded-xl px-4 py-4 font-black text-base focus:outline-none placeholder:text-zinc-600 placeholder:font-normal placeholder:text-sm"
            style={{ border: `1.5px solid ${custom ? BRAND.red : '#2a2a2a'}` }}
          />

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-5 w-full py-5 rounded-xl font-black text-base uppercase tracking-widest transition-all disabled:opacity-40"
            style={{ background: BRAND.red, color: '#fff' }}
          >
            {busy ? 'Pledging…' : 'Pledge it'}
          </button>

          {error && <div className="mt-3 text-center text-sm font-bold" style={{ color: '#F59E0B' }}>{error}</div>}
        </form>

        <div className="mt-9 rounded-2xl p-4" style={{ background: '#0d0d0d', border: '1px solid #1c1c1c' }}>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">The gym has pledged</div>
          <div className="font-display text-2xl tabular-nums leading-tight mt-0.5">{fmt(totalPledged)}</div>
          <div className="text-xs text-zinc-500">
            of {fmt(GOAL)} m ·{' '}
            {remaining > 0 ? (
              <span style={{ color: BRAND.red }} className="font-black">{fmt(remaining)} still to pledge</span>
            ) : (
              <span style={{ color: '#10B981' }} className="font-black">the whole road is pledged</span>
            )}
          </div>
          {CHALLENGE_WINDOW && (
            <div className="text-xs text-zinc-600 mt-2">
              Starts {CHALLENGE_WINDOW.start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
