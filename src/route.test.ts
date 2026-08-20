import { describe, expect, it } from 'vitest'
import { GOAL, MILESTONES, ROUTE, crossedMilestones, fmtKm } from './config'
import { locationLabel, positionAt } from './geo'
import { MACHINES, machineUnit, toMeters } from '../convex/machines'

// The route is data, and data rots quietly. A milestone out of order or a city
// missing a coordinate produces no error — just a map that draws itself wrong
// on a gym TV in front of the whole room. These are the checks that would have
// caught it.
describe('route data', () => {
  it('is strictly ascending', () => {
    const out = MILESTONES.filter((ms, i) => i > 0 && ms.m <= MILESTONES[i - 1].m)
    expect(out.map((o) => o.name)).toEqual([])
  })

  it('gives every mapped stop a coordinate', () => {
    const mapped = MILESTONES.filter((ms) => ms.kind === 'city' || ms.kind === 'finish')
    const broken = mapped.filter((ms) => ms.lat === undefined || ms.lng === undefined)
    expect(broken.map((b) => b.name)).toEqual([])
  })

  it('keeps every coordinate inside the continental US', () => {
    // albersUsa projects anything outside this to null, which silently drops
    // the stop off the map rather than erroring.
    const outside = ROUTE.filter(
      (r) => r.lat < 24 || r.lat > 50 || r.lng < -126 || r.lng > -66
    )
    expect(outside.map((o) => o.name)).toEqual([])
  })

  it('finishes exactly on GOAL', () => {
    expect(MILESTONES[MILESTONES.length - 1].m).toBe(GOAL)
  })

  it('starts and ends in Tulsa', () => {
    const first = ROUTE[0]
    const last = ROUTE[ROUTE.length - 1]
    expect(first.lat).toBeCloseTo(last.lat, 2)
    expect(first.lng).toBeCloseTo(last.lng, 2)
  })

  it('never leaves the gym without a celebration for more than two days', () => {
    // ~273,000 real meters a gym day at MULTIPLIER 1. A silent stretch is how
    // a month-long challenge loses the room.
    const DAY = 273_120
    let prev = 0
    const gaps = MILESTONES.map((ms) => {
      const gap = (ms.m - prev) / DAY
      prev = ms.m
      return { name: ms.name, days: gap }
    }).filter((g) => g.days > 2)
    expect(gaps).toEqual([])
  })
})

describe('positionAt', () => {
  it('starts at Tulsa', () => {
    const p = positionAt(0)
    expect(p.lat).toBeCloseTo(36.15, 2)
    expect(p.lng).toBeCloseTo(-95.99, 2)
  })

  it('lands exactly on a waypoint at its own meter mark', () => {
    const nyc = ROUTE.find((r) => r.name === 'NEW YORK CITY')!
    const p = positionAt(nyc.m)
    expect(p.lat).toBeCloseTo(nyc.lat, 4)
    expect(p.lng).toBeCloseTo(nyc.lng, 4)
  })

  it('interpolates halfway between two waypoints', () => {
    const i = ROUTE.findIndex((r) => r.name === 'Denver')
    const a = ROUTE[i - 1]
    const b = ROUTE[i]
    const p = positionAt((a.m + b.m) / 2)
    expect(p.lat).toBeCloseTo((a.lat + b.lat) / 2, 3)
    expect(p.lng).toBeCloseTo((a.lng + b.lng) / 2, 3)
  })

  it('clamps past the finish instead of running off the end', () => {
    const p = positionAt(GOAL * 2)
    const last = ROUTE[ROUTE.length - 1]
    expect(p.lat).toBeCloseTo(last.lat, 4)
    expect(p.lng).toBeCloseTo(last.lng, 4)
  })

  it('treats negative totals as the start line', () => {
    expect(positionAt(-1)).toEqual(positionAt(0))
  })

  it('moves monotonically west then east, never jumping the map', () => {
    // A bad interpolation shows up as the logo teleporting across the country.
    let prev = positionAt(0)
    for (let m = 10_000; m <= GOAL; m += 10_000) {
      const p = positionAt(m)
      const jump = Math.abs(p.lat - prev.lat) + Math.abs(p.lng - prev.lng)
      expect(jump).toBeLessThan(1)
      prev = p
    }
  })
})

describe('locationLabel', () => {
  it('names the start line before anything is logged', () => {
    expect(locationLabel(0).where).toMatch(/start line/i)
  })

  it('counts down to the next stop', () => {
    const joplin = ROUTE.find((r) => r.name === 'Joplin, MO')!
    const l = locationLabel(joplin.m - 50_000)
    expect(l.nextStop).toBe('Joplin')
    expect(l.toNext).toBe(50_000)
  })

  it('reports home once the loop is closed', () => {
    expect(locationLabel(GOAL).toNext).toBe(0)
    expect(locationLabel(GOAL).where).toMatch(/home/i)
  })
})

describe('crossedMilestones', () => {
  it('finds nothing when the total has not moved', () => {
    expect(crossedMilestones(500_000, 500_000)).toEqual([])
  })

  it('ignores a total that goes backwards (an undone entry)', () => {
    expect(crossedMilestones(500_000, 100_000)).toEqual([])
  })

  it('catches a single crossing', () => {
    const names = crossedMilestones(8_000, 9_000).map((m) => m.name)
    expect(names).toEqual(['Height of Mount Everest'])
  })

  it('excludes the lower bound and includes the upper', () => {
    // Landing exactly on a milestone should celebrate it, and it must not
    // then fire again on the next entry.
    expect(crossedMilestones(0, 8_848).map((m) => m.name)).toContain('Height of Mount Everest')
    expect(crossedMilestones(8_848, 20_000).map((m) => m.name)).not.toContain(
      'Height of Mount Everest'
    )
  })

  it('collapses a huge catch-up jump instead of queueing every overlay', () => {
    // Crossing the whole route at once must not lock the TV into 41 back-to-back
    // celebrations.
    const all = crossedMilestones(0, GOAL)
    expect(all.length).toBeLessThan(MILESTONES.length)
    expect(all.length).toBeGreaterThan(0)
  })

  it('always includes the milestone actually landed on', () => {
    const all = crossedMilestones(0, 2_035_000)
    expect(all[all.length - 1].name).toBe('NEW YORK CITY')
  })

  it('does not collapse two or fewer', () => {
    const two = crossedMilestones(0, 42_195)
    expect(two.map((m) => m.name)).toEqual(['Height of Mount Everest', 'First marathon'])
  })
})

describe('machine units', () => {
  it('reads the Assault Bike in miles and everything else in meters', () => {
    expect(machineUnit('Assault Bike')).toBe('miles')
    for (const m of MACHINES.filter((x) => x.name !== 'Assault Bike')) {
      expect(machineUnit(m.name)).toBe('meters')
    }
  })

  it('converts miles off the bike screen into real meters', () => {
    expect(toMeters('Assault Bike', 5)).toBeCloseTo(8046.72, 2)
    expect(toMeters('Assault Bike', 12.4)).toBeCloseTo(19955.87, 2)
  })

  it('leaves meter machines alone', () => {
    expect(toMeters('Row', 2000)).toBe(2000)
    expect(toMeters('Assault Runner', 1800)).toBe(1800)
  })

  it('refuses a machine it does not know', () => {
    expect(() => toMeters('Treadmill', 100)).toThrow(/unknown machine/i)
    expect(machineUnit('Treadmill')).toBeNull()
  })

  it('never silently treats miles as meters', () => {
    // The bug this whole unit system exists to prevent: 5 off the bike screen
    // must never become 5 meters.
    expect(toMeters('Assault Bike', 5)).not.toBe(5)
  })
})

describe('fmtKm', () => {
  it('rounds to whole kilometres with a thousands separator', () => {
    expect(fmtKm(8_473_348)).toBe('8,473 km')
    expect(fmtKm(500)).toBe('1 km')
  })
})
