import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  entries: defineTable({
    machine: v.string(),
    // Always real meters, whatever unit the machine's screen used.
    meters: v.number(),
    journeyMeters: v.number(),
    // What the trainer actually typed, and the unit they typed it in — kept so
    // the recent-entries list can show "5 mi" rather than a converted number
    // nobody recognizes. Optional: entries logged before units existed have
    // neither.
    input: v.optional(v.number()),
    unit: v.optional(v.string()),
  }),

  // Rate limiting, deliberately spread over several rows. A limiter that read
  // recent `entries` would put those rows into every writer's read set — which
  // is exactly the contention it is supposed to help the gym survive.
  rateLimit: defineTable({
    shard: v.number(),
    windowStart: v.number(),
    count: v.number(),
  }).index('by_shard', ['shard']),

  // Everyone taking part, and the meters they claimed before the challenge
  // started. The pledge is the point: an even split would ask the same of a
  // 25-year-old and a 70-year-old, so instead each person names their own
  // number and the sum of those numbers is what the gym has actually
  // committed to the road.
  //
  // nameLower is indexed so a second pledge under the same name updates the
  // person rather than quietly creating a duplicate and splitting their total.
  people: defineTable({
    firstName: v.string(),
    lastName: v.string(),
    name: v.string(), // display form, "James Sullivan"
    nameLower: v.string(), // matching form, "james sullivan"
    pledgeMeters: v.number(),
    pledgedAt: v.number(),
  }).index('by_nameLower', ['nameLower']),
})
