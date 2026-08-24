import { EVEREST, MARATHON } from './config'

// What a member has to show for the month.
//
// Two kinds, and the split is the whole point.
//
// **Keeping your pledge** is the one every member can reach, because each
// person set their own number. It is identical whether somebody said 20,000 or
// 500,000 — a 71-year-old who claimed 20,000 and did it has done exactly the
// thing a 24-year-old who claimed 500,000 and did it has done. That badge is
// the loudest thing this app says, and it must never be sized by volume.
//
// **Volume tiers** sit underneath and are honest about being volume. They are
// pitched against the even share of the route — 8,473,348 over 182 members is
// about 46,500 — not against the pledge buttons, which start at 150,000 and are
// deliberately aspirational. So the first two are reachable by anybody who
// turns up, and the top one is genuinely hard.
//
// These are only ever shown to you, on your own page. Names and recognition
// yes, ranking no: there is no position, no percentile, and no way to see
// anybody else's.
//
// ── Naming ──────────────────────────────────────────────────────────────────
// Plain facts, deliberately. Road-crew names (Navigator / Driver / Long Hauler
// / Road Captain) are more fun but read as a soft ranking, which is the one
// thing this challenge is built not to have. If that call is ever reversed,
// this list is the only place to change.

export type Badge = {
  id: string
  name: string
  /** meters required */
  at: number
  /** what the number actually means, in one line */
  blurb: string
}

export const VOLUME_BADGES: Badge[] = [
  { id: 'everest', name: 'Everest', at: EVEREST, blurb: 'The height of Everest, in meters' },
  { id: 'marathon', name: 'Marathon', at: MARATHON, blurb: 'A marathon, in meters' },
  { id: '100km', name: '100 km Club', at: 100_000, blurb: 'One hundred thousand meters' },
  { id: 'quarter', name: 'Quarter Million', at: 250_000, blurb: '250,000 meters' },
  { id: 'half', name: 'Half Million', at: 500_000, blurb: '500,000 meters' },
  { id: 'million', name: 'One Million', at: 1_000_000, blurb: 'Seven figures, on your own' },
]

export type BadgeState = {
  badge: Badge
  earned: boolean
}

/** Every volume badge, in order, marked earned or not. */
export function volumeBadges(meters: number): BadgeState[] {
  return VOLUME_BADGES.map((badge) => ({ badge, earned: meters >= badge.at }))
}

/**
 * The next one within reach, and how far away it is — or null once they are all
 * done. Worth showing because "8,000 to go" is a reason to get back on a rower
 * and a count of what you have already got is not.
 */
export function nextBadge(meters: number): { badge: Badge; toGo: number } | null {
  const next = VOLUME_BADGES.find((b) => meters < b.at)
  return next ? { badge: next, toGo: next.at - meters } : null
}

/** How many are in hand. */
export function earnedCount(meters: number): number {
  return VOLUME_BADGES.filter((b) => meters >= b.at).length
}
