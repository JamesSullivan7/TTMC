// ── Challenge configuration ─────────────────────────────────────────────────
// Tulsa -> Los Angeles -> New York -> Tulsa, 8,473 km of real road.
//
// Route length and MULTIPLIER (convex/worldTour.ts) are one decision, not two:
// the gym's output is the fixed input at ~273,000 real meters a day. This route
// takes 31.0 gym days at MULTIPLIER = 1 — which is why there is no longer any
// map scale at all. Every meter someone rows is a meter down the road.
//
// Driven westbound first, so the gym leaves town on Route 66 — which runs
// through Tulsa — and reaches its end at the Santa Monica Pier. The distance is
// identical either way round; the story is not.
export const GOAL = 8_473_348

// Challenge name — header, TV title, and share cards read this.
export const CHALLENGE_NAME = 'Cross Country'

// September 2026, the whole month. Parsed in local time, so this is midnight
// on the 1st in Tulsa.
//
// Setting this turns the countdown, the day counter, the pace ghost, the
// ahead/behind-pace badge and the day line on share cards back on. Set it to
// null to run open-ended again.
//
// Worth knowing: 30 days at the calorie challenge's observed output
// (~273,000 real meters a gym day) comes to 8,193,600 — about 3.3% short of
// this route. The gym has to beat its own previous pace slightly, or it goes
// to the wire. That is a choice, not an oversight.
export const CHALLENGE_WINDOW: { start: Date; days: number } | null = {
  start: new Date('2026-09-01T00:00:00'),
  days: 30,
}

// Machines and their units live in convex/machines.ts so the server and the UI
// cannot disagree about whether a number is meters or miles.
import { MACHINE_NAMES, type Machine } from '../convex/machines'
export type { Machine }
export const MACHINES = MACHINE_NAMES

export const MACHINE_COLORS: Record<Machine, string> = {
  'Row': '#3B82F6',
  'Ski': '#8B5CF6',
  'Erg Bike': '#F59E0B',
  'Assault Bike': '#F29BAB',
  'Assault Runner': '#10B981',
}

export const BRAND = {
  darkRed: '#8C2336',
  red: '#D93B58',
  pink: '#F29BAB',
}

// ── The three acts ──────────────────────────────────────────────────────────
// The loop is not one journey, it is three, and each one ends somewhere that
// feels like an arrival. Naming them gives the gym something to say to each
// other — "we're in the Long Haul" — that one 8,473 km bar never could.
export type Act = { name: string; blurb: string; from: number; to: number }

export const ACTS: Act[] = [
  { name: 'The Mother Road', blurb: 'Tulsa to the Pacific on Route 66', from: 0, to: 2_269_000 },
  { name: 'The Long Haul', blurb: 'Los Angeles to the Atlantic', from: 2_269_000, to: 6_438_000 },
  { name: 'The Run Home', blurb: 'New York back to Tulsa', from: 6_438_000, to: 8_473_348 },
]

export function actAt(meters: number): { act: Act; index: number; pct: number } {
  const i = Math.min(ACTS.length - 1, Math.max(0, ACTS.findIndex((a) => meters < a.to)))
  const act = ACTS[i < 0 ? ACTS.length - 1 : i]
  const span = act.to - act.from
  const pct = span > 0 ? Math.max(0, Math.min(1, (meters - act.from) / span)) * 100 : 100
  return { act, index: i < 0 ? ACTS.length - 1 : i, pct }
}

// ── Milestones ──────────────────────────────────────────────────────────────
// kind 'city' = route waypoint drawn on the map (needs lat/lng).
// kind 'mark' = distance achievement announced in the feed + celebration.
//
// `img` is only set where the postcard actually exists in public/postcards/.
// To add one of the pending photos, drop the JPG in and add the img line —
// Celebration falls back to the brand treatment until then either way.
export type Milestone = {
  m: number
  name: string
  kind: 'city' | 'mark' | 'finish' | 'stretch'
  lat?: number
  lng?: number
  note?: string
  major?: boolean // major = map label + bigger celebration
  img?: string // optional postcard backdrop — drop photos into public/postcards/
}

export const MILESTONES: Milestone[] = [
  // ── ACT I — THE MOTHER ROAD · Tulsa to the Pacific ────────────────────────
  { m: 8_848, name: 'Height of Mount Everest', img: '/postcards/everest.jpg', kind: 'mark', note: 'Above the clouds, and it is still the first morning' },
  { m: 42_195, name: 'First marathon', img: '/postcards/first-marathon.jpg', kind: 'mark', note: 'The marathon counter starts ticking' },
  { m: 100_000, name: '100 km club', img: '/postcards/100km.jpg', kind: 'mark' },
  { m: 157_000, name: 'Oklahoma City', img: '/postcards/okc.jpg', kind: 'city', lat: 35.47, lng: -97.52, note: 'First city falls — and everyone here has driven this bit' },
  { m: 350_000, name: 'The 100th Meridian', kind: 'mark', note: 'The old dividing line. Everything from here is the West.' },
  { m: 549_000, name: 'Amarillo', img: '/postcards/amarillo.jpg', kind: 'city', lat: 35.22, lng: -101.83, note: 'Cadillac Ranch — ten of them, nose down in a field' },
  { m: 700_000, name: 'Into Mountain time', kind: 'mark', note: 'We just lost an hour' },
  { m: 925_000, name: 'Santa Fe', img: '/postcards/santafe.jpg', kind: 'city', lat: 35.69, lng: -105.94 },
  { m: 1_000_000, name: 'First million meters', img: '/postcards/first-million.jpg', kind: 'mark' },
  { m: 1_019_000, name: 'Albuquerque', kind: 'city', lat: 35.08, lng: -106.65 },
  { m: 1_300_000, name: 'The Painted Desert', kind: 'mark' },
  { m: 1_527_000, name: 'The Grand Canyon', img: '/postcards/grand-canyon.jpg', kind: 'city', lat: 36.06, lng: -112.14, major: true, note: 'A detour worth taking' },
  { m: 1_609_344, name: '1,000 miles', img: '/postcards/1000-miles.jpg', kind: 'mark' },
  { m: 1_632_000, name: 'Flagstaff', kind: 'city', lat: 35.2, lng: -111.65 },
  { m: 1_850_000, name: 'The Colorado River at Needles', kind: 'mark' },
  { m: 2_122_000, name: 'Barstow', kind: 'city', lat: 34.9, lng: -117.02, note: 'Kingman, Barstow, San Bernardino' },
  { m: 2_269_000, name: 'LOS ANGELES', img: '/postcards/la.jpg', kind: 'city', lat: 34.05, lng: -118.24, major: true, note: 'Santa Monica Pier — the end of Route 66. The Pacific. Now turn around.' },

  // ── ACT II — THE LONG HAUL · Los Angeles to the Atlantic ──────────────────
  { m: 2_636_000, name: 'Las Vegas', img: '/postcards/vegas.jpg', kind: 'city', lat: 36.17, lng: -115.14 },
  { m: 2_900_000, name: 'Red rock country', kind: 'mark' },
  { m: 3_220_000, name: 'Salt Lake City', kind: 'city', lat: 40.76, lng: -111.89 },
  { m: 3_500_000, name: 'The Continental Divide', kind: 'mark', major: true, note: 'From here, every river runs to the Atlantic' },
  { m: 3_816_000, name: 'Denver', kind: 'city', lat: 39.74, lng: -104.99, major: true, note: 'A mile above the sea' },
  { m: 4_236_674, name: 'HALFWAY', img: '/postcards/halfway.jpg', kind: 'mark', major: true, note: 'Middle of the country, middle of nowhere, middle of the challenge. Keep going.' },
  { m: 4_600_000, name: 'Omaha', kind: 'city', lat: 41.26, lng: -95.93 },
  { m: 4_796_000, name: 'Des Moines', kind: 'city', lat: 41.59, lng: -93.62 },
  { m: 5_000_000, name: 'The Mississippi River', img: '/postcards/mississippi.jpg', kind: 'mark', note: 'The big one. We cross it again on the way home.' },
  { m: 5_294_000, name: 'Chicago', img: '/postcards/chicago.jpg', kind: 'city', lat: 41.88, lng: -87.63, major: true, note: 'The other end of Route 66. We left town on this road — here is where it starts.' },
  { m: 5_600_000, name: 'The shore of Lake Erie', kind: 'mark' },
  { m: 5_789_000, name: 'Cleveland', img: '/postcards/cleveland.jpg', kind: 'city', lat: 41.5, lng: -81.69 },
  { m: 6_000_000, name: '6 million meters', img: '/postcards/6-million.jpg', kind: 'mark' },
  { m: 6_438_000, name: 'NEW YORK CITY', img: '/postcards/nyc.jpg', kind: 'city', lat: 40.71, lng: -74.01, major: true, note: 'The Atlantic. Both oceans, done. Everything from here is the way home.' },

  // ── ACT III — THE RUN HOME · New York to Tulsa ────────────────────────────
  { m: 6_568_000, name: 'Philadelphia — the Rocky Steps', kind: 'city', lat: 39.95, lng: -75.17, major: true, note: 'Seventy-two steps. You know the ones.' },
  { m: 6_800_000, name: 'Over the Appalachians', img: '/postcards/appalachian.jpg', kind: 'mark', note: 'The last mountains standing between us and home' },
  { m: 6_981_000, name: 'Pittsburgh', kind: 'city', lat: 40.44, lng: -79.996 },
  { m: 7_242_000, name: 'Columbus', kind: 'city', lat: 39.96, lng: -83.0 },
  { m: 7_512_000, name: 'Indianapolis', kind: 'city', lat: 39.77, lng: -86.16 },
  { m: 7_883_000, name: 'St. Louis', img: '/postcards/stlouis.jpg', kind: 'city', lat: 38.63, lng: -90.2, major: true, note: 'The Gateway Arch, and the Mississippi crossed again — westbound, homeward' },
  { m: 8_000_000, name: '8 million meters', img: '/postcards/8-million.jpg', kind: 'mark' },
  { m: 8_196_000, name: 'Springfield, MO', img: '/postcards/springfield.jpg', kind: 'city', lat: 37.21, lng: -93.29 },
  { m: 8_306_000, name: 'Joplin, MO', img: '/postcards/joplin.jpg', kind: 'city', lat: 37.08, lng: -94.51, note: 'Back on Route 66. Last stop before home.' },
  { m: 8_373_348, name: '100 KM TO GO', img: '/postcards/100-to-go.jpg', kind: 'mark', major: true, note: 'Everyone in this room has driven the rest of it' },
  { m: 8_473_348, name: 'TULSA. HOME.', kind: 'finish', lat: 36.15, lng: -95.99, major: true, note: 'Coast to coast to coast. 8,473 kilometers. 200 marathons. WE DID IT.' },
]

// Route waypoints for the map: start + every city milestone, in order.
export const ROUTE: { m: number; name: string; lat: number; lng: number; major?: boolean }[] = [
  { m: 0, name: 'Tulsa', lat: 36.15, lng: -95.99, major: true },
  ...MILESTONES.filter((ms) => (ms.kind === 'city' || ms.kind === 'finish') && ms.lat !== undefined).map(
    (ms) => ({ m: ms.m, name: ms.name, lat: ms.lat!, lng: ms.lng!, major: ms.major })
  ),
]

// Which milestones a jump from `prev` to `next` crosses, and which of those
// earn a celebration. A single catch-up entry can cross several at once, and
// showing every one would leave the gym TV stuck in overlays for minutes — so
// past two, keep the majors plus whichever one we actually landed on.
export function crossedMilestones(prev: number, next: number): Milestone[] {
  if (!(next > prev)) return []
  const crossed = MILESTONES.filter((ms) => ms.m > prev && ms.m <= next)
  if (crossed.length <= 2) return crossed
  const majors = crossed.filter((c) => c.major || c.kind === 'finish' || c.kind === 'stretch')
  const last = crossed[crossed.length - 1]
  return majors.includes(last) ? majors : [...majors, last]
}

export const MARATHON = 42_195
export const EVEREST = 8_848

export function fmt(n: number) {
  return Math.round(n).toLocaleString('en-US')
}

// "Sam Okafor" on the screen becomes "Sam O." — it fits a narrow column, it
// is how people actually refer to each other in a gym, and it keeps a full
// name off a wall anyone can walk past. Trainer views keep the whole thing,
// because telling two Sams apart is the entire point there.
export function shortName(firstName: string, lastName: string): string {
  const initial = lastName.trim().charAt(0).toUpperCase()
  return initial ? `${firstName} ${initial}.` : firstName
}

export function fmtKm(meters: number) {
  return `${Math.round(meters / 1000).toLocaleString('en-US')} km`
}

// Day of challenge: 0 = not started or no window set, 1..N during, >N overtime.
export function challengeDay(now = new Date()): number {
  if (!CHALLENGE_WINDOW) return 0
  const diff = now.getTime() - CHALLENGE_WINDOW.start.getTime()
  if (diff < 0) return 0
  return Math.floor(diff / 86_400_000) + 1
}

// Where the pace ghost should be right now (meters). null = no window, so
// there is no pace to be ahead of or behind.
export function paceTarget(now = new Date()): number | null {
  if (!CHALLENGE_WINDOW) return null
  const total = CHALLENGE_WINDOW.days * 86_400_000
  const elapsed = now.getTime() - CHALLENGE_WINDOW.start.getTime()
  const frac = Math.max(0, Math.min(1, elapsed / total))
  return GOAL * frac
}

// Days until the challenge opens. null = no window, or it has already begun.
export function daysToStart(now = new Date()): number | null {
  if (!CHALLENGE_WINDOW) return null
  const diff = CHALLENGE_WINDOW.start.getTime() - now.getTime()
  return diff > 0 ? Math.ceil(diff / 86_400_000) : null
}
