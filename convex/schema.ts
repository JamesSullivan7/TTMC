import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  entries: defineTable({
    machine: v.string(),
    meters: v.number(),
    journeyMeters: v.number(),
  }),
  settings: defineTable({
    boostActive: v.boolean(),
  }),
})
