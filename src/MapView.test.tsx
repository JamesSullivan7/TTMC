// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import MapView from './MapView'
import { GOAL } from './config'
import { STATE_CROSSINGS } from './stateCrossings'

// The map is the thing on the gym TV for thirty days unattended, and until now
// nothing covered it at all. It takes a number and draws a country, so it is
// unusually testable for a visual component: no network, no camera, no render
// loop, and every shape derived from `totalMeters`.

afterEach(cleanup)

const svg = () => document.querySelector('svg')!
const states = () => [...svg().querySelectorAll('path[data-state]')]

describe('the frame', () => {
  it('draws the lower 48 and nothing else', () => {
    render(<MapView totalMeters={0} paceMeters={0} />)
    // albersUsa puts Alaska and Hawaii in the bottom-left as insets; the route
    // never goes near them and keeping them letterboxes the map on a wide TV.
    const ids = states().map((p) => p.getAttribute('data-state'))
    expect(ids).not.toContain('02')
    expect(ids).not.toContain('15')
    expect(ids.length).toBeGreaterThan(45)
  })

  it('scales to its container rather than a fixed size', () => {
    render(<MapView totalMeters={0} paceMeters={0} />)
    expect(svg().getAttribute('viewBox')).toBeTruthy()
    // A fixed width would pin the TV layout to one screen. Two rounds of layout
    // bugs on this project came from exactly that.
    expect(svg().getAttribute('width')).toBeNull()
  })
})

describe('what the road looks like at each stage', () => {
  // Oklahoma is lit from meter zero, because Tulsa is in it. The gym is
  // standing in the first state before anybody has rowed anything.
  it('lights only the home state at the start line', () => {
    render(<MapView totalMeters={0} paceMeters={0} />)
    const lit = states().filter((p) => p.getAttribute('data-lit') === 'true')
    expect(lit).toHaveLength(1)
    expect(lit[0].getAttribute('data-state')).toBe(STATE_CROSSINGS[0].id)
  })

  it('lights a state only once the road has reached it', () => {
    const second = STATE_CROSSINGS[1]
    const { rerender } = render(<MapView totalMeters={second.m - 1} paceMeters={0} />)
    const before = states().filter((p) => p.getAttribute('data-lit') === 'true')
    expect(before.map((p) => p.getAttribute('data-state'))).not.toContain(second.id)

    rerender(<MapView totalMeters={second.m} paceMeters={0} />)
    const after = states().filter((p) => p.getAttribute('data-lit') === 'true')
    expect(after).toHaveLength(before.length + 1)
    expect(after.map((p) => p.getAttribute('data-state'))).toContain(second.id)
  })

  it('has the whole country lit by the finish', () => {
    render(<MapView totalMeters={GOAL} paceMeters={0} />)
    const lit = states().filter((p) => p.getAttribute('data-lit') === 'true')
    expect(lit).toHaveLength(STATE_CROSSINGS.length)
  })

  it('never un-lights a state as the road goes on', () => {
    let previous = 0
    for (const m of [0, GOAL * 0.25, GOAL * 0.5, GOAL * 0.75, GOAL]) {
      cleanup()
      render(<MapView totalMeters={m} paceMeters={0} />)
      const lit = states().filter((p) => p.getAttribute('data-lit') === 'true').length
      expect(lit).toBeGreaterThanOrEqual(previous)
      previous = lit
    }
  })
})

describe('the pace ghost', () => {
  it('is absent before the challenge, when there is no pace to keep', () => {
    render(<MapView totalMeters={100_000} paceMeters={0} />)
    expect(svg().querySelector('[data-ghost]')).toBeNull()
  })

  it('appears once there is a pace to be behind', () => {
    render(<MapView totalMeters={100_000} paceMeters={500_000} />)
    expect(svg().querySelector('[data-ghost]')).not.toBeNull()
  })
})

describe('holding up at the edges', () => {
  // A trainer fat-fingering an extra zero, or the gym genuinely arriving and
  // carrying on logging, must not produce a component that throws on the TV.
  it('survives meters past the end of the route', () => {
    expect(() => render(<MapView totalMeters={GOAL * 2} paceMeters={GOAL * 2} />)).not.toThrow()
    expect(states().filter((p) => p.getAttribute('data-lit') === 'true'))
      .toHaveLength(STATE_CROSSINGS.length)
  })

  it('survives a negative total', () => {
    expect(() => render(<MapView totalMeters={-1} paceMeters={0} />)).not.toThrow()
  })
})
