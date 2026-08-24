// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { convexReactMock, installMatchMedia, resetQueries, setQuery } from './test/harness'

vi.mock('convex/react', async () => (await import('./test/harness')).convexReactMock())
void convexReactMock

import MePage from './MePage'

const ROSTER = [
  { id: 'p1', name: 'Kim Tate', firstName: 'Kim', lastName: 'Tate', pledgeMeters: 45000, pledgedAt: 3 },
  { id: 'p2', name: 'Lou Marsh', firstName: 'Lou', lastName: 'Marsh', pledgeMeters: 120000, pledgedAt: 2 },
]

const KIM = {
  id: 'p1',
  name: 'Kim Tate',
  firstName: 'Kim',
  lastName: 'Tate',
  pledgeMeters: 45000,
  meters: 49247,
  entries: 11,
  byMachine: {
    Row: { meters: 16200, count: 5 },
    'Assault Bike': { meters: 18347, count: 2 },
    Ski: { meters: 4600, count: 2 },
    'Erg Bike': { meters: 8200, count: 1 },
    'Assault Runner': { meters: 1900, count: 1 },
  },
  lastAt: 1,
  pledgePct: 100,
  keptPledge: true,
}

beforeEach(() => {
  installMatchMedia()
  localStorage.clear()
  history.replaceState({}, '', '/me')
  setQuery('people:listPeople', ROSTER)
})

afterEach(() => {
  cleanup()
  resetQueries()
  localStorage.clear()
})

describe('finding yourself', () => {
  it('asks who you are when the phone does not know yet', () => {
    render(<MePage />)
    expect(screen.getByPlaceholderText('Type your name…')).toBeTruthy()
  })

  it('remembers you after you pick, so the next scan goes straight through', async () => {
    setQuery('people:personStats', KIM)
    const user = userEvent.setup()
    render(<MePage />)

    await user.type(screen.getByPlaceholderText('Type your name…'), 'kim')
    await user.click(screen.getByRole('button', { name: /Kim Tate/ }))

    expect(localStorage.getItem('tt-person')).toBe('p1')
    expect(screen.getByText('49,247')).toBeTruthy()
  })

  it('matches on any word start, so a surname finds you too', async () => {
    const user = userEvent.setup()
    render(<MePage />)
    await user.type(screen.getByPlaceholderText('Type your name…'), 'mars')
    expect(screen.getByRole('button', { name: /Lou Marsh/ })).toBeTruthy()
  })

  // The blank-page bug. The stored id outlives what it points at — a person
  // removed, a reset, or a phone that once opened the dev deployment — and the
  // server now answers null for all three rather than rejecting the argument.
  // Before that, useQuery rethrew during render and the member got a white
  // screen with no way out of it.
  it('recovers to the picker when the remembered person is gone', () => {
    localStorage.setItem('tt-person', 'an-id-from-a-deployment-that-is-not-this-one')
    setQuery('people:personStats', null)
    render(<MePage />)

    expect(screen.getByPlaceholderText('Type your name…')).toBeTruthy()
    expect(localStorage.getItem('tt-person')).toBeNull()
  })

  it('lets you hand the phone to somebody else', async () => {
    localStorage.setItem('tt-person', 'p1')
    setQuery('people:personStats', KIM)
    const user = userEvent.setup()
    render(<MePage />)

    await user.click(screen.getByRole('button', { name: /Not Kim\?/ }))
    expect(localStorage.getItem('tt-person')).toBeNull()
    expect(screen.getByPlaceholderText('Type your name…')).toBeTruthy()
  })
})

describe('the token in the QR', () => {
  it('keeps it and takes it back out of the address bar', () => {
    history.replaceState({}, '', '/me?t=secret-token')
    render(<MePage />)
    expect(localStorage.getItem('tt-log-token')).toBe('secret-token')
    // A screenshot of this page must not leak the token.
    expect(window.location.search).not.toContain('secret-token')
  })
})

describe('what it tells you', () => {
  beforeEach(() => localStorage.setItem('tt-person', 'p1'))

  it('shows the machines heaviest first, with each share of the total', () => {
    setQuery('people:personStats', KIM)
    const { container } = render(<MePage />)
    const names = [...container.querySelectorAll('.font-bold.truncate')].map((n) => n.textContent)
    expect(names).toEqual(['Assault Bike', 'Row', 'Erg Bike', 'Ski', 'Assault Runner'])
    expect(screen.getByText(/5 sessions · 33% of your meters/)).toBeTruthy()
  })

  it('says session, not sessions, when there was one', () => {
    setQuery('people:personStats', KIM)
    render(<MePage />)
    expect(screen.getByText(/1 session · 17% of your meters/)).toBeTruthy()
  })

  it('celebrates keeping your pledge without ranking you against anyone', () => {
    setQuery('people:personStats', KIM)
    render(<MePage />)
    expect(screen.getByText(/You have done what you said you would/)).toBeTruthy()
  })

  it('counts down what is left when you are short of it', () => {
    setQuery('people:personStats', { ...KIM, meters: 4000, pledgePct: 8.9, keptPledge: false, entries: 1, byMachine: { Row: { meters: 4000, count: 1 } } })
    render(<MePage />)
    expect(screen.getByText(/41,000/)).toBeTruthy()
  })

  it('has something to say to somebody who has not started', () => {
    setQuery('people:personStats', { ...KIM, meters: 0, entries: 0, byMachine: {}, pledgePct: 0, keptPledge: false })
    render(<MePage />)
    expect(screen.getByText('Nothing logged yet')).toBeTruthy()
    // No machine breakdown and no route line to divide by zero with.
    expect(screen.queryByText(/of your meters/)).toBeNull()
  })

  // locationLabel's `where` answers "how far has the gym got", and for one
  // person that is almost always still the start — it read "driven out of
  // Tulsa as far as Past Tulsa".
  it('places you by what is coming up, not by the stop behind you', () => {
    setQuery('people:personStats', KIM)
    render(<MePage />)
    expect(screen.queryByText(/Past Tulsa/)).toBeNull()
    expect(screen.getByText(/out of Tulsa/)).toBeTruthy()
  })

  // The founding constraint. Names and recognition yes, ranking no.
  it('never puts anybody else on the page', () => {
    setQuery('people:personStats', KIM)
    const { container } = render(<MePage />)
    expect(container.textContent).not.toContain('Lou')
  })
})
