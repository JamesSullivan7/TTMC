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
})
