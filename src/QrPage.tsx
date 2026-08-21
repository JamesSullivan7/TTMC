import { useEffect, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import { BRAND, CHALLENGE_NAME, MACHINES, MACHINE_COLORS, Machine } from './config'
import { getTrainerKey } from './keys'

// Printable QR cards, one per machine. A trainer opens this on the gym
// computer (already unlocked with the trainer PIN), hits print, and tapes one
// card to each machine. That is the whole distribution mechanism for member
// self-logging.
//
// qrcode is loaded on demand rather than imported at the top, so it never
// lands in the bundle every member downloads — this page is seen once, by one
// person, on one computer.

export default function QrPage() {
  const trainerKey = getTrainerKey()
  const token = useQuery(api.worldTour.getLogToken, trainerKey ? { key: trainerKey } : 'skip')
  const [codes, setCodes] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      try {
        const QR = await import('qrcode')
        const opts = {
          width: 640,
          margin: 1,
          errorCorrectionLevel: 'M' as const,
          color: { dark: '#050505', light: '#ffffff' },
        }
        const out: Record<string, string> = {}
        for (const m of MACHINES) {
          const url = `${window.location.origin}/log?m=${encodeURIComponent(m)}&t=${encodeURIComponent(token)}`
          out[m] = await QR.toDataURL(url, opts)
        }
        // Carries the token too, so one scan both pledges now and sets the
        // phone up to log meters in September.
        out.__pledge = await QR.toDataURL(
          `${window.location.origin}/join?t=${encodeURIComponent(token)}`,
          opts
        )
        if (!cancelled) setCodes(out)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  if (!trainerKey) {
    return (
      <Shell>
        <p className="text-zinc-400">
          Open this on the gym computer, after unlocking with <strong>Trainer login</strong>.
        </p>
      </Shell>
    )
  }
  if (token === undefined) return <Shell><p className="text-zinc-500">Checking…</p></Shell>
  if (token === null) {
    return (
      <Shell>
        <p className="text-zinc-400">
          No log token is set on this deployment yet. Set one, then reload:
        </p>
        <pre className="mt-3 text-xs bg-black/60 p-3 rounded-lg overflow-x-auto">
          npx convex env set LOG_TOKEN &lt;value&gt; --prod
        </pre>
      </Shell>
    )
  }
  if (failed) {
    return <Shell><p className="text-zinc-400">Couldn't build the QR codes. Reload the page.</p></Shell>
  }

  return (
    <div className="min-h-screen bg-white text-black p-8 print:p-0">
      <style>{`@media print { .no-print { display: none } .card { break-inside: avoid; page-break-inside: avoid } }`}</style>

      <div className="no-print max-w-3xl mx-auto mb-8">
        <h1 className="text-2xl font-black uppercase tracking-wide">
          {CHALLENGE_NAME} — machine cards
        </h1>
        <p className="text-sm text-zinc-600 mt-2">
          Print these and tape one to each machine. Anyone who scans one can log their own
          meters — they never see this page, and they never need the trainer PIN.
        </p>
        <button
          onClick={() => window.print()}
          className="mt-4 px-5 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest text-white"
          style={{ background: BRAND.red }}
        >
          Print
        </button>
      </div>

      <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* The pledge card. Same code as the gym TV, so it can go on the front
            desk too — the sign-up drive only has the days before September to
            happen in, and one screen is one place to catch people. */}
        {codes.__pledge && (
          <div
            className="card rounded-2xl p-6 text-center sm:col-span-2"
            style={{ border: `3px solid ${BRAND.red}` }}
          >
            <div className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: BRAND.red }}>
              Tulsa Training · {CHALLENGE_NAME}
            </div>
            <div className="font-display text-4xl uppercase mt-1 leading-none">Pledge your meters</div>
            <img src={codes.__pledge} alt="QR code to pledge" className="w-56 h-56 mx-auto my-4" />
            <div className="font-black text-lg uppercase tracking-wide">
              Scan to pledge your meters
            </div>
            <p className="text-sm text-zinc-600 mt-2 leading-relaxed max-w-md mx-auto">
              This September the whole gym drives one road together — Tulsa to Los Angeles to
              New York and home. Put in your name and say how many meters you will cover.
              Whatever is honest for you.
            </p>
          </div>
        )}

        {MACHINES.map((m) => (
          <div
            key={m}
            className="card rounded-2xl p-6 text-center"
            style={{ border: `3px solid ${MACHINE_COLORS[m as Machine]}` }}
          >
            <div className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: BRAND.red }}>
              Tulsa Training · {CHALLENGE_NAME}
            </div>
            <div className="font-display text-3xl uppercase mt-1 leading-none">{m}</div>
            {codes[m] ? (
              <img src={codes[m]} alt={`QR code for ${m}`} className="w-52 h-52 mx-auto my-4" />
            ) : (
              <div className="w-52 h-52 mx-auto my-4 bg-zinc-100 rounded" />
            )}
            <div className="font-black text-lg uppercase tracking-wide">Scan to log your meters</div>
            <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">
              Type the number off the screen when you finish.
              <br />
              Every meter moves the gym down the road.
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <img
          src="/logo-t.png"
          alt=""
          className="w-14 h-14 rounded-full mx-auto mb-5"
          style={{ border: `2px solid ${BRAND.red}` }}
        />
        {children}
      </div>
    </div>
  )
}
