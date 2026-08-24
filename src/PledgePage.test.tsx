// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { act } from 'react'
import {
  convexReactMock,
  installMatchMedia,
  resetQueries,
  resetViewport,
  setQuery,
  setViewport,
  staleFirstRead,
} from './test/harness'

vi.mock('convex/react', async () => (await import('./test/harness')).convexReactMock())
void convexReactMock

// qrcode is loaded on demand and hits a canvas jsdom does not have. The board
// is explicitly built to work without it, so the tests run the same way.
vi.mock('qrcode', () => ({ default: { toDataURL: async () => '' } }))

import PledgePage from './PledgePage'

const PEOPLE = [
  { id: 'p1', name: 'Kim Tate', firstName: 'Kim', lastName: 'Tate', pledgeMeters: 45000, pledgedAt: 3 },
  { id: 'p2', name: 'Lou Marsh', firstName: 'Lou', lastName: 'Marsh', pledgeMeters: 120000, pledgedAt: 2 },
  // A roster row: imported from the member list, has pledged nothing. Must not
  // reach the TV.
  { id: 'p3', name: 'Ana Ortiz', firstName: 'Ana', lastName: 'Ortiz', pledgeMeters: 0, pledgedAt: 0 },
]

// Only the wide layout draws a vertical tube, so the class the road-ahead layer
// carries is an unambiguous read on which layout is mounted.
const layout = () =>
  document.querySelector('.road-ahead-up')
    ? 'tv'
    : document.querySelector('.road-ahead-right')
      ? 'phone'
      : 'neither'

beforeEach(() => {
  installMatchMedia()
  setQuery('people:listPeople', PEOPLE)
  setQuery('worldTour:getLogToken', null)
})

afterEach(() => {
  cleanup()
  resetQueries()
  resetViewport()
  vi.useRealTimers()
})

describe('which layout the board picks', () => {
  it('gives a wide screen the TV layout', () => {
    setViewport(1920, { fireResize: false })
    render(<PledgePage />)
    expect(layout()).toBe('tv')
  })

  it('gives a phone the stacked layout', () => {
    setViewport(390, { fireResize: false })
    render(<PledgePage />)
    expect(layout()).toBe('phone')
  })

  // The regression. A cast tab starts small and is resized by the TV as it
  // connects; if the board latches to the phone layout there, that is what the
  // gym looks at for a month. It used to, because it listened for the
  // matchMedia change event and nothing else — and that event is not reliably
  // delivered. fireChange is off here on purpose: this asserts the board
  // recovers with only a resize to go on.
  it('follows the viewport wide even when the media query never fires', () => {
    setViewport(390, { fireResize: false })
    render(<PledgePage />)
    expect(layout()).toBe('phone')

    act(() => setViewport(1920, { fireChange: false }))
    expect(layout()).toBe('tv')
  })

  it('follows the viewport back down again', () => {
    setViewport(1920, { fireResize: false })
    render(<PledgePage />)
    expect(layout()).toBe('tv')

    act(() => setViewport(390, { fireChange: false }))
    expect(layout()).toBe('phone')
  })

  // The other way in: the viewport moves between the first render and the
  // effect subscribing, so the change event lands with nothing listening for
  // it. staleFirstRead makes the state initializer see the old width while
  // every later read sees the truth — which is that race, staged. Nothing else
  // fires here, so only the sync() inside the effect can save it.
  it('corrects a viewport that moved before the effect subscribed', () => {
    setViewport(1920, { fireResize: false })
    staleFirstRead()
    render(<PledgePage />)
    expect(layout()).toBe('tv')
  })
})

describe('the gauge track', () => {
  it('is not the near-invisible colour it used to be', () => {
    setViewport(1920, { fireResize: false })
    render(<PledgePage />)
    const track = document.querySelector('.road-ahead-up')!.parentElement as HTMLElement
    // #161616 measured 1.13:1 against the #050505 board — not a dark track on a
    // gym TV, just nothing.
    // jsdom hands these back normalised to rgb().
    expect(track.style.background).not.toContain('rgb(22, 22, 22)') // #161616
    expect(track.style.background).toContain('rgb(20, 20, 25)') // #141419
    expect(track.style.boxShadow).toContain('#2e2e38') // box-shadow is left as authored
  })

  it('carries the road ahead behind the fill, not over it', () => {
    setViewport(1920, { fireResize: false })
    render(<PledgePage />)
    const track = document.querySelector('.road-ahead-up')!.parentElement!
    const kids = [...track.children]
    const dashes = kids.findIndex((k) => k.classList.contains('road-ahead-up'))
    expect(dashes).toBe(0)
    expect(kids.length).toBeGreaterThan(1)
  })

  it('bleeds the dashes past the track so the loop has no seam', () => {
    setViewport(1920, { fireResize: false })
    render(<PledgePage />)
    const dashes = document.querySelector('.road-ahead-up') as HTMLElement
    // One dash period of overhang at each end, clipped by overflow-hidden.
    expect(dashes.style.top).toBe('-1.2vw')
    expect(dashes.style.bottom).toBe('-1.2vw')
    expect(dashes.style.getPropertyValue('--dash-period')).toBe('1.2vw')
  })
})

describe('what reaches the TV', () => {
  it('keeps people who have pledged nothing off the board', () => {
    setViewport(1920, { fireResize: false })
    render(<PledgePage />)
    expect(screen.getByText('Kim T.')).toBeTruthy()
    expect(screen.queryByText('Ana O.')).toBeNull()
  })

  it('totals only the pledges, not the roster', () => {
    setViewport(1920, { fireResize: false })
    render(<PledgePage />)
    expect(screen.getByText('165,000')).toBeTruthy()
  })

  // Zinc-400 is 8.0:1 on this background and zinc-500 is 4.2:1, and the worst of
  // it lands on the smallest type. Across a gym they are gone.
  it('leaves no grey secondary text on the TV layout', () => {
    setViewport(1920, { fireResize: false })
    const { container } = render(<PledgePage />)
    const grey = container.querySelectorAll('.text-zinc-400, .text-zinc-500, .text-zinc-600')
    expect([...grey].map((g) => g.textContent)).toEqual([])
  })

  it('keeps the greys on a phone, which is read at arm’s length', () => {
    setViewport(390, { fireResize: false })
    const { container } = render(<PledgePage />)
    expect(container.querySelectorAll('.text-zinc-400, .text-zinc-500').length).toBeGreaterThan(0)
  })
})
