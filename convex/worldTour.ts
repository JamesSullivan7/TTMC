import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// Map scale: every real meter moves the journey 5 meters.
const MULTIPLIER = 5

const MACHINES = ['Row', 'Ski', 'Erg Bike', 'Assault Bike', 'Assault Runner']

// Tulsa is UTC-5 (CDT) for the whole of September.
const TZ_OFFSET_MS = 5 * 3600 * 1000

function dayKey(creationTime: number): string {
  return new Date(creationTime - TZ_OFFSET_MS).toISOString().slice(0, 10)
}

async function isBoostActive(ctx: { db: any }): Promise<boolean> {
  const s = await ctx.db.query('settings').first()
  return s?.boostActive ?? false
}

export const logEntry = mutation({
  args: { machine: v.string(), meters: v.number() },
  handler: async (ctx, { machine, meters }) => {
    if (!MACHINES.includes(machine)) throw new Error('Unknown machine')
    if (!(meters > 0 && meters <= 1_000_000)) throw new Error('Max single entry is 1,000,000 meters')
    const boost = await isBoostActive(ctx)
    const journeyMeters = Math.round(meters * MULTIPLIER * (boost ? 2 : 1))
    await ctx.db.insert('entries', { machine, meters: Math.round(meters), journeyMeters })
    return { journeyMeters, boosted: boost }
  },
})

export const deleteEntry = mutation({
  args: { id: v.id('entries') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id)
  },
})

// ── Boost day ────────────────────────────────────────────────────────────────

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const s = await ctx.db.query('settings').first()
    return { boostActive: s?.boostActive ?? false }
  },
})

export const setBoost = mutation({
  args: { active: v.boolean() },
  handler: async (ctx, { active }) => {
    const s = await ctx.db.query('settings').first()
    if (s) await ctx.db.patch(s._id, { boostActive: active })
    else await ctx.db.insert('settings', { boostActive: active })
  },
})

// ── Testing tools (used from the dashboard's demo bar) ──────────────────────

// Inserts a realistic day of gym entries (~80 entries, ~1.35M journey meters)
// using the machine mix observed in the calorie challenge.
export const simulateDay = mutation({
  args: {},
  handler: async (ctx) => {
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
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query('entries').collect()
    for (const e of entries) await ctx.db.delete(e._id)
    return { deleted: entries.length }
  },
})

// ── Queries ──────────────────────────────────────────────────────────────────

export const getSummary = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query('entries').collect()
    let totalJourney = 0
    let totalReal = 0
    let firstEntryAt: number | null = null
    const byMachine: Record<string, number> = {}
    for (const m of MACHINES) byMachine[m] = 0
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
      at: e._creationTime,
    }))
  },
})

// Journey meters per local (Tulsa) day, oldest first — feeds the daily recap.
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
