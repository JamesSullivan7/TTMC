// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { convexReactMock, installMatchMedia, resetQueries, setQuery } from './test/harness'

const pledge = vi.fn()

vi.mock('convex/react', async () => {
  const harness = await import('./test/harness')
  return { ...harness.convexReactMock(), useMutation: () => pledge }
})
void convexReactMock

import JoinPage from './JoinPage'

// The page 182 people have to get through on their own phones, most of them
// once, several of them while standing up and slightly out of breath. It is the
// only surface where a failure means somebody simply does not take part.

beforeEach(() => {
  installMatchMedia()
  localStorage.clear()
  history.replaceState({}, '', '/join')
  setQuery('people:listPeople', [])
  pledge.mockReset()
  pledge.mockResolvedValue({ id: 'p9', name: 'Dana Reyes', pledgeMeters: 250000, alreadyPledged: false })
})

afterEach(() => {
  cleanup()
  resetQueries()
  localStorage.clear()
})

const type = async (user: ReturnType<typeof userEvent.setup>, label: string, text: string) =>
  user.type(screen.getByLabelText(label), text)

describe('claiming your meters', () => {
  it('offers the tiers and a way to say something else entirely', () => {
    render(<JoinPage />)
    for (const t of ['150,000', '250,000', '350,000', '500,000']) {
      expect(screen.getByRole('button', { name: t })).toBeTruthy()
    }
    // The custom field is the point of pledging at all: an even split would ask
    // the same of a 25-year-old and a 70-year-old.
    expect(screen.getByLabelText('Your own number of meters')).toBeTruthy()
  })

  it('sends the tier you tapped', async () => {
    const user = userEvent.setup()
    render(<JoinPage />)
    await type(user, 'First name', 'Dana')
    await type(user, 'Last name', 'Reyes')
    await user.click(screen.getByRole('button', { name: '350,000' }))
    await user.click(screen.getByRole('button', { name: /pledge it/i }))

    expect(pledge).toHaveBeenCalledWith({ firstName: 'Dana', lastName: 'Reyes', meters: 350000 })
  })

  it('sends your own number when you type one', async () => {
    const user = userEvent.setup()
    render(<JoinPage />)
    await type(user, 'First name', 'Dana')
    await type(user, 'Last name', 'Reyes')
    await user.type(screen.getByLabelText('Your own number of meters'), '30000')
    await user.click(screen.getByRole('button', { name: /pledge it/i }))

    // Well under the smallest button, which has to keep working — a row of
    // large round numbers must not shut out somebody being honest.
    expect(pledge).toHaveBeenCalledWith({ firstName: 'Dana', lastName: 'Reyes', meters: 30000 })
  })

  it('lets a typed number replace a tapped tier', async () => {
    const user = userEvent.setup()
    render(<JoinPage />)
    await type(user, 'First name', 'Dana')
    await type(user, 'Last name', 'Reyes')
    await user.click(screen.getByRole('button', { name: '500,000' }))
    await user.type(screen.getByLabelText('Your own number of meters'), '42000')
    await user.click(screen.getByRole('button', { name: /pledge it/i }))

    expect(pledge).toHaveBeenCalledWith({ firstName: 'Dana', lastName: 'Reyes', meters: 42000 })
  })

  it('will not submit without a name', async () => {
    const user = userEvent.setup()
    render(<JoinPage />)
    await user.click(screen.getByRole('button', { name: '250,000' }))
    await user.click(screen.getByRole('button', { name: /pledge it/i }))
    expect(pledge).not.toHaveBeenCalled()
  })

  it('will not submit without a number', async () => {
    const user = userEvent.setup()
    render(<JoinPage />)
    await type(user, 'First name', 'Dana')
    await type(user, 'Last name', 'Reyes')
    await user.click(screen.getByRole('button', { name: /pledge it/i }))
    expect(pledge).not.toHaveBeenCalled()
  })

  it('remembers who this phone belongs to, so logging never asks again', async () => {
    const user = userEvent.setup()
    render(<JoinPage />)
    await type(user, 'First name', 'Dana')
    await type(user, 'Last name', 'Reyes')
    await user.click(screen.getByRole('button', { name: '250,000' }))
    await user.click(screen.getByRole('button', { name: /pledge it/i }))

    expect(localStorage.getItem('tt-person')).toBe('p9')
  })
})

describe('the token in the QR', () => {
  it('is kept and taken back out of the address bar', () => {
    history.replaceState({}, '', '/join?t=secret-token')
    render(<JoinPage />)
    expect(localStorage.getItem('tt-log-token')).toBe('secret-token')
    // One scan sets the phone up to pledge now and log meters in September, and
    // a screenshot of this page must not hand the token to anybody.
    expect(window.location.search).not.toContain('secret-token')
  })
})

describe('when it goes wrong', () => {
  it('says so, and does not lose what they typed', async () => {
    pledge.mockRejectedValue(new Error('Please claim at least 1,000 meters'))
    const user = userEvent.setup()
    render(<JoinPage />)
    await type(user, 'First name', 'Dana')
    await type(user, 'Last name', 'Reyes')
    await user.click(screen.getByRole('button', { name: '150,000' }))
    await user.click(screen.getByRole('button', { name: /pledge it/i }))

    expect(await screen.findByText(/at least 1,000 meters/)).toBeTruthy()
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('Dana')
  })
})
