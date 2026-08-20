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
// is callable by anyone who opens the site. Destructive operations therefore
// check a shared key that lives ONLY in the deployment's environment and is
// typed in by a trainer on demand. It is never bundled, never committed.
//
//   npx convex env set ADMIN_KEY <value>          (dev)
//   npx convex env set ADMIN_KEY <value> --prod   (production)
//
function requireAdmin(key: string) {
  const expected = process.env.ADMIN_KEY
  if (!expected) {
    throw new Error('ADMIN_KEY is not set on this deployment — run: npx convex env set ADMIN_KEY <value>')
  }
  if (key !== expected) throw new Error('Not authorized')
}

// Trainer login: succeeds or throws. The client stores the key on success so
// trainers only type it once per device.
export const verifyAdmin = mutation({
  args: { key: v.string() },
  handler: async (_ctx, { key }) => {
    requireAdmin(key)
    return true
  },
})

// ── Logging ──────────────────────────────────────────────────────────────────

// The plan is a QR code on every machine so members log from their own phone,
// and that needs logEntry open to anyone. It is NOT open yet, because the site
// is live at a guessable URL and today only trainers log: an unauthenticated
// write is pure downside until the thing it exists for actually ships.
//
// Flip this to false the day member self-logging goes in. Nothing else needs
// to change — the client sends the key when it has one either way.
const REQUIRE_KEY_TO_LOG = true

export const logEntry = mutation({
  // `amount` is the raw number off the machine's screen, in that machine's own
  // unit. Conversion to meters happens here, server-side, so nothing
  // downstream ever has to wonder what unit it is holding.
  args: { machine: v.string(), amount: v.number(), key: v.optional(v.string()) },
  handler: async (ctx, { machine, amount, key }) => {
    if (REQUIRE_KEY_TO_LOG) requireAdmin(key ?? '')
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

    // Total before and after, so the logger can be told exactly which stretch
    // of road their meters covered.
    const existing = await ctx.db.query('entries').collect()
    const totalBefore = existing.reduce((s, e) => s + e.journeyMeters, 0)

    const journeyMeters = Math.round(meters * MULTIPLIER)
    await ctx.db.insert('entries', {
      machine,
      meters: Math.round(meters),
      journeyMeters,
      input: amount,
      unit,
    })

    return { journeyMeters, meters: Math.round(meters), totalBefore, totalAfter: totalBefore + journeyMeters }
  },
})

export const deleteEntry = mutation({
  args: { id: v.id('entries'), key: v.string() },
  handler: async (ctx, { id, key }) => {
    requireAdmin(key)
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
    return entries.map((e) => ({
      id: e._id,
      machine: e.machine,
      meters: e.meters,
      journeyMeters: e.journeyMeters,
      input: e.input ?? null,
      unit: e.unit ?? null,
      at: e._creationTime,
    }))
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
