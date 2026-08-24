import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { MACHINE_NAMES, machineUnit, toMeters, unitAbbrev } from './machines'

// Map scale. The Tulsa -> New York -> Los Angeles -> Tulsa route is 8,473 km,
// which the gym covers in ~31 days at its real output — so this is 1, and the
// old silent x5 tailwind is gone for good. Every meter rowed is a meter of
// road. Nothing to hide, nothing to explain.
const MULTIPLIER = 1

// Sanity cap on a single entry. The longest plausible single piece on any of
// these machines is a half-marathon row (~21,000 m), so 60,000 is generous
// while still catching a fat-fingered extra zero.
const MAX_SINGLE_ENTRY = 60_000

// Tulsa is UTC-5 (CDT) — used only to bucket entries into local gym days.
const TZ_OFFSET_MS = 5 * 3600 * 1000

function dayKey(creationTime: number): string {
  return new Date(creationTime - TZ_OFFSET_MS).toISOString().slice(0, 10)
}

// ── Authorization ────────────────────────────────────────────────────────────
//
// This app has no user accounts by design (no names, no leaderboard), and the
// Convex deployment URL ships inside the client bundle — so anything callable
// is callable by anyone who opens the site. Access is therefore shared keys,
// held ONLY in the deployment's environment. None is ever bundled or committed.
//
// Three tiers, because they protect very different things:
//
//   LOG_TOKEN    members. Rides in the machine QR codes. Log meters, nothing else.
//   TRAINER_PIN  trainers. Short and memorable, typed at the gym many times a
//                day: log on anyone's behalf, undo a mistake, print QR cards.
//   ADMIN_KEY    long and random. Wiping or fabricating the challenge, only.
//
// The split exists because TRAINER_PIN is four digits. That is the right
// trade for something trainers type constantly — but it is 10,000 guesses
// against a public endpoint, so it must not be able to erase a month of work.
// Nobody needs reset or simulate during a challenge; those keep the long key.
//
//   npx convex env set TRAINER_PIN 6426 --prod
//   npx convex env set ADMIN_KEY <long random> --prod
//
function requireAdmin(key: string) {
  const expected = process.env.ADMIN_KEY
  if (!expected) {
    throw new Error('ADMIN_KEY is not set on this deployment — run: npx convex env set ADMIN_KEY <value>')
  }
  if (key !== expected) throw new Error('Not authorized')
}

// A trainer, or an admin — admins can do everything a trainer can.
function requireTrainer(key: string) {
  const pin = process.env.TRAINER_PIN
  const admin = process.env.ADMIN_KEY
  if (pin && key === pin) return
  if (admin && key === admin) return
  throw new Error('Not authorized')
}

// Trainer login: succeeds or throws. The client stores the key on success so
// a trainer only types the PIN once per device.
export const verifyTrainer = mutation({
  args: { key: v.string() },
  handler: async (_ctx, { key }) => {
    requireTrainer(key)
    return true
  },
})

// Whether this key can also reach the destructive tools — so the UI can show
// or hide them honestly instead of offering buttons that will be refused.
export const isAdmin = query({
  args: { key: v.string() },
  handler: async (_ctx, { key }) => key !== '' && key === process.env.ADMIN_KEY,
})

// The QR codes carry the log token, so a trainer needs to see it to print
// them. Trainer-gated: the token is strictly lower privilege than the PIN, so
// there is nothing gained by holding it back from someone who already has one.
export const getLogToken = query({
  args: { key: v.string() },
  handler: async (_ctx, { key }) => {
    requireTrainer(key)
    return process.env.LOG_TOKEN ?? null
  },
})

// ── Logging ──────────────────────────────────────────────────────────────────

// Members log from their own phones by scanning a QR code on the machine, so
// logging cannot require the trainer key. It is still not open to the world:
// the QR carries a separate LOG_TOKEN, which — unlike anything in the bundle —
// you cannot get by reading the site's source. You have to have stood in the
// gym and pointed a camera at a machine.
//
// That is a deliberately modest bar. It is not protecting money, it is
// stopping a stranger who guessed the URL from spraying the total. A trainer's
// admin key is accepted too, so the gym computer keeps working unchanged.
//
//   npx convex env set LOG_TOKEN <value> --prod
//
function requireLogAccess(key: string) {
  const logToken = process.env.LOG_TOKEN
  if (logToken && key === logToken) return
  const pin = process.env.TRAINER_PIN
  if (pin && key === pin) return
  const admin = process.env.ADMIN_KEY
  if (admin && key === admin) return
  throw new Error('Not authorized')
}

// A throttle against a runaway client or a bored member with a script — not
// the main defence, which is the token gate plus the fact that a trainer can
// undo anything. So it is set well above any real burst: a class of thirty
// finishing together must never be told to wait.
//
// Sharded because the obvious implementation — read the most recent N entries
// and check their timestamps — puts those rows in every writer's read set, and
// concurrent inserts then invalidate it. That is the precise cause of the
// OptimisticConcurrencyControlFailure this exists alongside. Here each writer
// touches exactly one row, so two people logging in the same instant only
// collide if they happen to land on the same shard.
const RATE_SHARDS = 8
const PER_SHARD_PER_MINUTE = 20 // 160/min across the gym
const RATE_WINDOW_MS = 60_000

async function checkRateLimit(ctx: { db: any }) {
  const shard = Math.floor(Math.random() * RATE_SHARDS)
  const now = Date.now()
  const row = await ctx.db
    .query('rateLimit')
    .withIndex('by_shard', (q: any) => q.eq('shard', shard))
    .unique()

  if (!row) {
    await ctx.db.insert('rateLimit', { shard, windowStart: now, count: 1 })
    return
  }
  if (now - row.windowStart >= RATE_WINDOW_MS) {
    await ctx.db.patch(row._id, { windowStart: now, count: 1 })
    return
  }
  if (row.count >= PER_SHARD_PER_MINUTE) {
    throw new Error('Too many entries at once — give it a minute')
  }
  await ctx.db.patch(row._id, { count: row.count + 1 })
}

export const logEntry = mutation({
  // `amount` is the raw number off the machine's screen, in that machine's own
  // unit. Conversion to meters happens here, server-side, so nothing
  // downstream ever has to wonder what unit it is holding.
  args: {
    machine: v.string(),
    amount: v.number(),
    key: v.optional(v.string()),
    // Who did it. Optional so a trainer with a queue at the desk is never
    // blocked by a name that will not resolve — see the note in schema.ts.
    personId: v.optional(v.id('people')),
  },
  handler: async (ctx, { machine, amount, key, personId }) => {
    requireLogAccess(key ?? '')
    await checkRateLimit(ctx)

    // A stale personId from a phone whose person was merged or removed must
    // not take the whole entry down with it — drop the attribution, keep the
    // meters.
    let person = null
    if (personId) person = await ctx.db.get(personId)

    const unit = machineUnit(machine)
    if (unit === null) throw new Error('Unknown machine')
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Distance must be a positive number')
    }

    const meters = toMeters(machine, amount)
    if (meters > MAX_SINGLE_ENTRY) {
      const cap = unit === 'miles' ? MAX_SINGLE_ENTRY / 1609.344 : MAX_SINGLE_ENTRY
      throw new Error(
        `Max single entry is ${Math.floor(cap).toLocaleString('en-US')} ${unitAbbrev(unit)}`
      )
    }

    // This deliberately does NOT read the running total, even though the
    // "which stretch of road did I move us along" message needs it. Reading
    // the entries table here put every existing row in the read set, so any
    // two people logging at the same moment invalidated each other — measured
    // at roughly 14% of writes failing with OptimisticConcurrencyControlFailure
    // when 35 logged at once, which is an ordinary end-of-class burst.
    //
    // The client already subscribes to the total and computes the message from
    // it. If someone else's entry lands in the same instant, the message shifts
    // by their meters and nobody can tell. A failed write, they notice.
    const journeyMeters = Math.round(meters * MULTIPLIER)
    await ctx.db.insert('entries', {
      machine,
      meters: Math.round(meters),
      journeyMeters,
      input: amount,
      unit,
      personId: person ? person._id : undefined,
    })

    return {
      journeyMeters,
      meters: Math.round(meters),
      personName: person ? person.name : null,
    }
  },
})

export const deleteEntry = mutation({
  args: { id: v.id('entries'), key: v.string() },
  handler: async (ctx, { id, key }) => {
    requireTrainer(key)
    await ctx.db.delete(id)
  },
})

// ── Testing tools (used from the dashboard's trainer bar) ───────────────────

// Inserts a realistic day of gym entries (~80 entries) using the machine mix
// observed in the calorie challenge: ~273,000 real meters per gym day.
export const simulateDay = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    requireAdmin(key)
    const MIX: { machine: string; weight: number; avg: number }[] = [
      { machine: 'Assault Runner', weight: 30, avg: 1800 },
      { machine: 'Erg Bike', weight: 28, avg: 6000 },
      { machine: 'Row', weight: 18, avg: 2500 },
      { machine: 'Ski', weight: 12, avg: 2000 },
      { machine: 'Assault Bike', weight: 12, avg: 4200 },
    ]
    const totalWeight = MIX.reduce((s, m) => s + m.weight, 0)
    let journey = 0
    for (let i = 0; i < 80; i++) {
      let roll = Math.random() * totalWeight
      let pick = MIX[0]
      for (const m of MIX) {
        roll -= m.weight
        if (roll <= 0) {
          pick = m
          break
        }
      }
      const meters = Math.round(pick.avg * (0.5 + Math.random()))
      const journeyMeters = meters * MULTIPLIER
      journey += journeyMeters
      await ctx.db.insert('entries', { machine: pick.machine, meters, journeyMeters })
    }
    return { journeyMeters: journey }
  },
})

// Wipes every entry — resets the challenge to zero.
export const resetChallenge = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    requireAdmin(key)
    const entries = await ctx.db.query('entries').collect()
    for (const e of entries) await ctx.db.delete(e._id)
    return { deleted: entries.length }
  },
})

// ── Queries ──────────────────────────────────────────────────────────────────
//
// Queries stay open: everything they expose is already on the gym TV.

export const getSummary = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query('entries').collect()
    let totalJourney = 0
    let totalReal = 0
    let firstEntryAt: number | null = null
    const byMachine: Record<string, number> = {}
    for (const m of MACHINE_NAMES) byMachine[m] = 0
    for (const e of entries) {
      totalJourney += e.journeyMeters
      totalReal += e.meters
      byMachine[e.machine] = (byMachine[e.machine] ?? 0) + e.journeyMeters
      if (firstEntryAt === null || e._creationTime < firstEntryAt) firstEntryAt = e._creationTime
    }
    return { totalJourney, totalReal, byMachine, entryCount: entries.length, firstEntryAt }
  },
})

export const getRecent = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query('entries').order('desc').take(8)
    // At most eight lookups, so resolving names here rather than denormalising
    // them onto the entry — a copied name would drift the moment somebody is
    // renamed or two duplicates are merged.
    return Promise.all(
      entries.map(async (e) => {
        const person = e.personId ? await ctx.db.get(e.personId) : null
        return {
          id: e._id,
          machine: e.machine,
          meters: e.meters,
          journeyMeters: e.journeyMeters,
          input: e.input ?? null,
          unit: e.unit ?? null,
          personName: person ? person.name : null,
          at: e._creationTime,
        }
      })
    )
  },
})

// Journey meters per local (Tulsa) day, oldest first — feeds the daily recap
// and the "today vs. our best day" readout.
export const getDaily = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query('entries').collect()
    const days: Record<string, { journey: number; byMachine: Record<string, number> }> = {}
    for (const e of entries) {
      const k = dayKey(e._creationTime)
      if (!days[k]) days[k] = { journey: 0, byMachine: {} }
      days[k].journey += e.journeyMeters
      days[k].byMachine[e.machine] = (days[k].byMachine[e.machine] ?? 0) + e.journeyMeters
    }
    return Object.entries(days)
      .map(([key, d]) => ({ key, journey: d.journey, byMachine: d.byMachine }))
      .sort((a, b) => (a.key < b.key ? -1 : 1))
  },
})
