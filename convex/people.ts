import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// Pledges: everyone claims the meters they intend to cover, before the
// challenge starts. The sum is what the gym has actually committed to the
// road, which is a far more useful number in August than in late September.

const MAX_PLEDGE = 2_000_000 // more than a fifth of the whole route
const MIN_PLEDGE = 1_000

// Deliberately open, with no key.
//
// The whole point is that 182 people can claim their meters from their own
// phones in the eleven days before September, and a token in the way is
// friction against the one thing that has to happen 182 times. What a spammer
// could achieve is a silly name on the gym TV and an inflated pledge total —
// visible, harmless, and removable by any trainer in two clicks. That is a
// better trade than making it harder for a 70-year-old member to sign up.
//
// The throttle below is sharded for the same reason the logging one is: a
// limiter that reads recent rows puts them in every writer's read set.
const PLEDGE_SHARDS = 4
const PER_SHARD_PER_MINUTE = 8 // 32/min across the gym
const WINDOW_MS = 60_000

async function checkRate(ctx: { db: any }) {
  const shard = 100 + Math.floor(Math.random() * PLEDGE_SHARDS)
  const now = Date.now()
  const row = await ctx.db
    .query('rateLimit')
    .withIndex('by_shard', (q: any) => q.eq('shard', shard))
    .unique()
  if (!row) {
    await ctx.db.insert('rateLimit', { shard, windowStart: now, count: 1 })
    return
  }
  if (now - row.windowStart >= WINDOW_MS) {
    await ctx.db.patch(row._id, { windowStart: now, count: 1 })
    return
  }
  if (row.count >= PER_SHARD_PER_MINUTE) {
    throw new Error('Lots of people are signing up at once — try again in a minute')
  }
  await ctx.db.patch(row._id, { count: row.count + 1 })
}

function clean(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}

// "james  SULLIVAN" and "James Sullivan" have to land on the same person, or
// their meters end up split across two rows and neither total is right.
function displayCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_, sep, c) => sep + c.toUpperCase())
}

export const pledge = mutation({
  args: { firstName: v.string(), lastName: v.string(), meters: v.number() },
  handler: async (ctx, { firstName, lastName, meters }) => {
    const first = displayCase(clean(firstName))
    const last = displayCase(clean(lastName))
    if (first.length < 2) throw new Error('Please enter a first name')
    if (last.length < 1) throw new Error('Please enter a last name')
    if (first.length > 40 || last.length > 40) throw new Error('That name is too long')
    if (!Number.isFinite(meters) || meters < MIN_PLEDGE) {
      throw new Error(`Please claim at least ${MIN_PLEDGE.toLocaleString('en-US')} meters`)
    }
    if (meters > MAX_PLEDGE) {
      throw new Error(`That is more than ${MAX_PLEDGE.toLocaleString('en-US')} meters — check the number`)
    }

    const name = `${first} ${last}`
    const nameLower = name.toLowerCase()
    const rounded = Math.round(meters)

    const existing = await ctx.db
      .query('people')
      .withIndex('by_nameLower', (q) => q.eq('nameLower', nameLower))
      .unique()

    if (existing) {
      // Pledges go up, never down. Somebody raising their number is a story;
      // quietly walking one back is not, and it would let a mistyped small
      // number wipe out a real commitment.
      //
      // A roster entry imported from the member list sits at 0, so this is
      // also the path where someone on the list pledges for the first time —
      // which is not the same as having already pledged.
      const hadPledged = existing.pledgeMeters > 0
      const next = Math.max(existing.pledgeMeters, rounded)
      await ctx.db.patch(existing._id, { pledgeMeters: next, pledgedAt: Date.now() })
      return { id: existing._id, name, pledgeMeters: next, alreadyPledged: hadPledged }
    }

    await checkRate(ctx)
    const id = await ctx.db.insert('people', {
      firstName: first,
      lastName: last,
      name,
      nameLower,
      pledgeMeters: rounded,
      pledgedAt: Date.now(),
    })
    return { id, name, pledgeMeters: rounded, alreadyPledged: false }
  },
})

// Everyone the app knows about, newest pledge first — so somebody who has just
// scanned the code sees their own name arrive at the top of the gym TV within
// seconds. 182 rows is small enough to hand over whole and let the client sort
// and filter, which is also what makes the name typeahead instant: no round
// trip per keystroke.
//
// Rows with pledgeMeters 0 are roster entries imported from the gym's member
// list. They exist so the join form can suggest a name instead of trusting
// someone to type it the same way twice, and the board filters them out —
// nobody appears on the TV having pledged nothing.
export const listPeople = query({
  args: {},
  handler: async (ctx) => {
    const people = await ctx.db.query('people').collect()
    return people
      .sort((a, b) => b.pledgedAt - a.pledgedAt)
      .map((p) => ({
        id: p._id,
        name: p.name,
        firstName: p.firstName,
        lastName: p.lastName,
        pledgeMeters: p.pledgeMeters,
        pledgedAt: p.pledgedAt,
      }))
  },
})

export const pledgeTotal = query({
  args: {},
  handler: async (ctx) => {
    const people = await ctx.db.query('people').collect()
    const pledged = people.filter((p) => p.pledgeMeters > 0)
    return {
      totalPledged: pledged.reduce((s, p) => s + p.pledgeMeters, 0),
      count: pledged.length,
      rosterSize: people.length,
    }
  },
})

// Seed the roster from the gym's member list. Admin-gated, and idempotent —
// re-running after the list is updated adds the new people and leaves everyone
// else, including their pledges, untouched.
export const importRoster = mutation({
  args: {
    key: v.string(),
    names: v.array(v.object({ firstName: v.string(), lastName: v.string() })),
  },
  handler: async (ctx, { key, names }) => {
    const admin = process.env.ADMIN_KEY
    if (!admin || key !== admin) throw new Error('Not authorized')

    let added = 0
    let skipped = 0
    for (const raw of names) {
      const first = displayCase(clean(raw.firstName))
      const last = displayCase(clean(raw.lastName))
      if (first.length < 1 || last.length < 1) {
        skipped++
        continue
      }
      const name = `${first} ${last}`
      const nameLower = name.toLowerCase()
      const existing = await ctx.db
        .query('people')
        .withIndex('by_nameLower', (q) => q.eq('nameLower', nameLower))
        .unique()
      if (existing) {
        skipped++
        continue
      }
      // pledgedAt 0 marks a roster entry: known to the app, not yet committed
      // to anything, and therefore not on the board.
      await ctx.db.insert('people', {
        firstName: first,
        lastName: last,
        name,
        nameLower,
        pledgeMeters: 0,
        pledgedAt: 0,
      })
      added++
    }
    return { added, skipped }
  },
})

// Trainers can remove a bad entry — the safety valve that lets pledging stay
// open in the first place.
export const removePerson = mutation({
  args: { id: v.id('people'), key: v.string() },
  handler: async (ctx, { id, key }) => {
    const pin = process.env.TRAINER_PIN
    const admin = process.env.ADMIN_KEY
    if (!(pin && key === pin) && !(admin && key === admin)) throw new Error('Not authorized')
    await ctx.db.delete(id)
  },
})
