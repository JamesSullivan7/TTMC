import { describe, expect, it } from 'vitest'
import { VOLUME_BADGES, earnedCount, nextBadge, volumeBadges } from './badges'
import { EVEREST, GOAL, MARATHON } from './config'

// The badge scheme carries the founding constraint, so these check the rules it
// has to keep rather than the arithmetic, which is trivial.

describe('the volume tiers', () => {
  it('is strictly ascending', () => {
    const out = VOLUME_BADGES.filter((b, i) => i > 0 && b.at <= VOLUME_BADGES[i - 1].at)
    expect(out.map((b) => b.name)).toEqual([])
  })

  it('has unique ids and names', () => {
    expect(new Set(VOLUME_BADGES.map((b) => b.id)).size).toBe(VOLUME_BADGES.length)
    expect(new Set(VOLUME_BADGES.map((b) => b.name)).size).toBe(VOLUME_BADGES.length)
  })

  // The gym has members in their twenties and members in their seventies. A
  // scheme whose cheapest badge needs an even share of the whole route has
  // nothing to say to half the room.
  it('opens well below an even share of the route', () => {
    const evenShare = GOAL / 182
    expect(VOLUME_BADGES[0].at).toBeLessThan(evenShare / 4)
  })

  it('starts at two things a member already understands', () => {
    expect(VOLUME_BADGES[0].at).toBe(EVEREST)
    expect(VOLUME_BADGES[1].at).toBe(MARATHON)
  })

  // If the top tier were reachable by an average member it would not be worth
  // having; if it were beyond the whole gym's route it would be a joke.
  it('tops out hard but not absurdly', () => {
    const top = VOLUME_BADGES[VOLUME_BADGES.length - 1].at
    expect(top).toBeGreaterThan(GOAL / 182 * 10)
    expect(top).toBeLessThan(GOAL / 4)
  })
})

describe('earning them', () => {
  it('gives nothing for nothing', () => {
    expect(earnedCount(0)).toBe(0)
    expect(volumeBadges(0).every((b) => !b.earned)).toBe(true)
  })

  it('earns a badge exactly at its number, not one meter later', () => {
    const b = VOLUME_BADGES[2]
    expect(volumeBadges(b.at - 1).find((x) => x.badge.id === b.id)!.earned).toBe(false)
    expect(volumeBadges(b.at).find((x) => x.badge.id === b.id)!.earned).toBe(true)
  })

  it('keeps every badge already passed', () => {
    const all = volumeBadges(VOLUME_BADGES[3].at)
    expect(all.slice(0, 4).every((b) => b.earned)).toBe(true)
    expect(all.slice(4).every((b) => !b.earned)).toBe(true)
  })

  it('returns them in order whatever the total', () => {
    const order = volumeBadges(123_456).map((b) => b.badge.id)
    expect(order).toEqual(VOLUME_BADGES.map((b) => b.id))
  })
})

describe('the next one', () => {
  it('points at the first one not yet earned', () => {
    const next = nextBadge(0)!
    expect(next.badge.id).toBe(VOLUME_BADGES[0].id)
    expect(next.toGo).toBe(VOLUME_BADGES[0].at)
  })

  it('counts down to it', () => {
    const target = VOLUME_BADGES[2]
    expect(nextBadge(target.at - 500)!.toGo).toBe(500)
  })

  it('has nothing left to offer once they are all in', () => {
    expect(nextBadge(VOLUME_BADGES[VOLUME_BADGES.length - 1].at)).toBeNull()
  })

  it('never points backwards', () => {
    for (const m of [0, 1, EVEREST, MARATHON, 99_999, 250_000, 999_999]) {
      const n = nextBadge(m)
      if (n) expect(n.badge.at).toBeGreaterThan(m)
    }
  })
})
