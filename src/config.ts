// ── Challenge configuration ─────────────────────────────────────────────────
// PLACEHOLDER: still the around-the-world number. Gets replaced when the
// cross-country route is chosen — route length and MULTIPLIER (in
// convex/worldTour.ts) are the same decision, sized against ~273,000 real
// meters per gym day.
export const GOAL = 40_000_000

// PLACEHOLDER: challenge name — header, TV title, and share cards read this.
export const CHALLENGE_NAME = 'Cross Country'

// Date window. null = open-ended: no countdown, no day counter, no pace ghost,
// no "day N of N" on share cards. Set { start, days } once the dates are
// decided and all of that lights back up on its own.
export const CHALLENGE_WINDOW: { start: Date; days: number } | null = null

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

// ── Milestones ──────────────────────────────────────────────────────────────
// kind 'city' = route waypoint drawn on the globe (needs lat/lng).
// kind 'mark' = distance achievement announced in the feed + celebration.
export type Milestone = {
  m: number
  name: string
  kind: 'city' | 'mark' | 'finish' | 'stretch'
  lat?: number
  lng?: number
  note?: string
  major?: boolean // major = globe label + bigger celebration
  img?: string // optional postcard backdrop — drop photos into public/postcards/
}

export const MILESTONES: Milestone[] = [
  { m: 8_848, name: 'Height of Mount Everest', img: '/postcards/everest.jpg', kind: 'mark', note: 'We are above the clouds' },
  { m: 42_195, name: 'First marathon', img: '/postcards/first-marathon.jpg', kind: 'mark', note: 'The marathon counter starts ticking' },
  { m: 100_000, name: '100 km club', img: '/postcards/100km.jpg', kind: 'mark' },
  { m: 185_000, name: 'Joplin, MO', img: '/postcards/joplin.jpg', kind: 'city', lat: 37.08, lng: -94.51, note: 'First city falls' },
  { m: 290_000, name: 'Springfield, MO', img: '/postcards/springfield.jpg', kind: 'city', lat: 37.21, lng: -93.29 },
  { m: 630_000, name: 'St. Louis', img: '/postcards/stlouis.jpg', kind: 'city', lat: 38.63, lng: -90.2, note: 'The Gateway Arch — gateway to the journey' },
  { m: 1_000_000, name: 'First million meters', img: '/postcards/first-million.jpg', kind: 'mark' },
  { m: 1_100_000, name: 'Chicago', img: '/postcards/chicago.jpg', kind: 'city', lat: 41.88, lng: -87.63, major: true, note: 'Eastern end of Route 66 — remember this for the finale' },
  { m: 1_609_344, name: '1,000 miles', img: '/postcards/1000-miles.jpg', kind: 'mark' },
  { m: 1_650_000, name: 'Cleveland', img: '/postcards/cleveland.jpg', kind: 'city', lat: 41.5, lng: -81.69 },
  { m: 2_350_000, name: 'New York City', img: '/postcards/nyc.jpg', kind: 'city', lat: 40.71, lng: -74.01, major: true, note: 'Times Square' },
  { m: 2_700_000, name: 'Boston', img: '/postcards/boston.jpg', kind: 'city', lat: 42.36, lng: -71.06, note: 'The most famous marathon finish line on Earth — 64 marathons in' },
  { m: 3_500_000, name: 'Length of the Appalachian Trail', img: '/postcards/appalachian.jpg', kind: 'mark' },
  { m: 3_766_000, name: 'Length of the Mississippi River', img: '/postcards/mississippi.jpg', kind: 'mark' },
  { m: 3_940_000, name: 'Full length of Route 66', img: '/postcards/route66.jpg', kind: 'mark' },
  { m: 4_300_000, name: "St. John's, Newfoundland", img: '/postcards/stjohns.jpg', kind: 'city', lat: 47.56, lng: -52.71, note: 'Last land — into the Atlantic' },
  { m: 4_900_000, name: 'Titanic wreck site', img: '/postcards/titanic.jpg', kind: 'mark', note: 'A moment of silence. Then keep rowing.' },
  { m: 5_000_000, name: '5 million meters', img: '/postcards/5-million.jpg', kind: 'mark' },
  { m: 6_371_000, name: 'Distance to the center of the Earth', img: '/postcards/center-earth.jpg', kind: 'mark' },
  { m: 6_650_000, name: 'Length of the Nile', img: '/postcards/nile.jpg', kind: 'mark' },
  { m: 7_600_000, name: 'Dublin', img: '/postcards/dublin.jpg', kind: 'city', lat: 53.35, lng: -6.26, major: true, note: 'THE ATLANTIC IS CROSSED' },
  { m: 8_100_000, name: 'London', img: '/postcards/london.jpg', kind: 'city', lat: 51.51, lng: -0.13, major: true, note: 'Big Ben' },
  { m: 8_450_000, name: 'Paris', img: '/postcards/paris.jpg', kind: 'city', lat: 48.86, lng: 2.35, major: true, note: 'The Eiffel Tower' },
  { m: 9_289_000, name: 'Full length of the Trans-Siberian Railway', img: '/postcards/trans-siberian.jpg', kind: 'mark' },
  { m: 9_500_000, name: 'Berlin', img: '/postcards/berlin.jpg', kind: 'city', lat: 52.52, lng: 13.41 },
  { m: 9_850_000, name: 'Prague', img: '/postcards/prague.jpg', kind: 'city', lat: 50.08, lng: 14.44 },
  { m: 10_000_000, name: 'QUARTER OF THE WAY AROUND THE WORLD', img: '/postcards/quarter.jpg', kind: 'mark', major: true },
  { m: 10_100_000, name: 'Vienna', img: '/postcards/vienna.jpg', kind: 'city', lat: 48.21, lng: 16.37 },
  { m: 11_200_000, name: 'Istanbul', img: '/postcards/istanbul.jpg', kind: 'city', lat: 41.01, lng: 28.98, major: true, note: 'Two continents, one city — welcome to Asia' },
  { m: 12_000_000, name: '12 million meters', img: '/postcards/12-million.jpg', kind: 'mark' },
  { m: 12_500_000, name: 'Petra, Jordan', img: '/postcards/petra.jpg', kind: 'city', lat: 30.33, lng: 35.44, note: 'Wonder of the world' },
  { m: 14_200_000, name: 'Dubai', img: '/postcards/dubai.jpg', kind: 'city', lat: 25.2, lng: 55.27, major: true, note: 'The Burj Khalifa' },
  { m: 15_000_000, name: '15 million meters', img: '/postcards/15-million.jpg', kind: 'mark' },
  { m: 16_100_000, name: 'Mumbai', img: '/postcards/mumbai.jpg', kind: 'city', lat: 19.08, lng: 72.88, major: true },
  { m: 17_000_000, name: 'The Taj Mahal', img: '/postcards/tajmahal.jpg', kind: 'city', lat: 27.18, lng: 78.02, note: 'A detour worth taking' },
  { m: 18_000_000, name: '18 million meters', img: '/postcards/18-million.jpg', kind: 'mark' },
  { m: 19_100_000, name: 'Bangkok', img: '/postcards/bangkok.jpg', kind: 'city', lat: 13.76, lng: 100.5, major: true },
  { m: 20_000_000, name: 'HALFWAY AROUND THE WORLD', img: '/postcards/halfway.jpg', kind: 'mark', major: true, note: '20,000,000 meters down. 20,000,000 to go.' },
  { m: 20_037_500, name: 'The antipode', img: '/postcards/antipode.jpg', kind: 'mark', note: 'Exact opposite side of the planet from home. Every meter now brings us closer to Tulsa.' },
  { m: 20_500_000, name: 'Singapore', img: '/postcards/singapore.jpg', kind: 'city', lat: 1.35, lng: 103.82, major: true, note: 'Nearly on the equator' },
  { m: 21_196_000, name: 'Length of the Great Wall of China', img: '/postcards/great-wall.jpg', kind: 'mark' },
  { m: 23_100_000, name: 'Hong Kong', img: '/postcards/hongkong.jpg', kind: 'city', lat: 22.32, lng: 114.17, major: true },
  { m: 24_300_000, name: 'Shanghai', img: '/postcards/shanghai.jpg', kind: 'city', lat: 31.23, lng: 121.47 },
  { m: 25_000_000, name: '25 million meters', img: '/postcards/25-million.jpg', kind: 'mark' },
  { m: 25_700_000, name: 'Mount Fuji on the horizon', img: '/postcards/fuji.jpg', kind: 'mark' },
  { m: 26_100_000, name: 'Tokyo', img: '/postcards/tokyo.jpg', kind: 'city', lat: 35.68, lng: 139.69, major: true, note: 'Last big city before the Pacific' },
  { m: 27_000_000, name: 'Into the Pacific', img: '/postcards/pacific.jpg', kind: 'mark', note: 'The largest ocean on Earth' },
  { m: 28_500_000, name: 'The International Date Line', img: '/postcards/date-line.jpg', kind: 'mark', note: 'We just gained a day' },
  { m: 29_200_000, name: 'Middle of the Pacific', img: '/postcards/mid-pacific.jpg', kind: 'mark', note: 'Farthest from land all month' },
  { m: 30_000_000, name: 'THREE-QUARTERS AROUND THE WORLD', img: '/postcards/three-quarters.jpg', kind: 'mark', major: true },
  { m: 31_000_000, name: 'Midway Atoll', img: '/postcards/midway.jpg', kind: 'city', lat: 28.21, lng: -177.38 },
  { m: 32_300_000, name: 'Honolulu', img: '/postcards/honolulu.jpg', kind: 'city', lat: 21.31, lng: -157.86, major: true, note: 'Aloha' },
  { m: 33_756_000, name: '800th marathon', img: '/postcards/800-marathons.jpg', kind: 'mark' },
  { m: 35_000_000, name: '35 million meters', img: '/postcards/35-million.jpg', kind: 'mark' },
  { m: 36_400_000, name: 'LOS ANGELES — BACK ON THE MAINLAND', img: '/postcards/la.jpg', kind: 'city', lat: 34.05, lng: -118.24, major: true, note: 'Santa Monica Pier — the western end of Route 66. We touched its eastern end on day 1.' },
  { m: 36_800_000, name: 'Las Vegas', img: '/postcards/vegas.jpg', kind: 'city', lat: 36.17, lng: -115.14 },
  { m: 37_200_000, name: 'The Grand Canyon', img: '/postcards/grand-canyon.jpg', kind: 'city', lat: 36.06, lng: -112.14 },
  { m: 38_100_000, name: 'Santa Fe', img: '/postcards/santafe.jpg', kind: 'city', lat: 35.69, lng: -105.94 },
  { m: 38_500_000, name: 'Amarillo', img: '/postcards/amarillo.jpg', kind: 'city', lat: 35.22, lng: -101.83, note: 'Cadillac Ranch' },
  { m: 39_000_000, name: 'ONE MILLION METERS TO GO', img: '/postcards/one-million-to-go.jpg', kind: 'mark', major: true },
  { m: 39_800_000, name: 'Oklahoma City', img: '/postcards/okc.jpg', kind: 'city', lat: 35.47, lng: -97.52, major: true, note: 'Almost home' },
  { m: 40_000_000, name: 'TULSA. AROUND THE WORLD.', img: '/postcards/tulsa.jpg', kind: 'finish', lat: 36.15, lng: -95.99, major: true, note: 'WE DID IT.' },
  { m: 42_650_000, name: 'One full ISS orbit', img: '/postcards/iss.jpg', kind: 'stretch', note: 'We circled the Earth at sea level. Then we did it at 250 miles up.' },
]

// Route waypoints for the globe: start + every city milestone, in order.
export const ROUTE: { m: number; name: string; lat: number; lng: number; major?: boolean }[] = [
  { m: 0, name: 'Tulsa', lat: 36.15, lng: -95.99, major: true },
  ...MILESTONES.filter((ms) => (ms.kind === 'city' || ms.kind === 'finish') && ms.lat !== undefined).map(
    (ms) => ({ m: ms.m, name: ms.name, lat: ms.lat!, lng: ms.lng!, major: ms.major })
  ),
]

export const MARATHON = 42_195
export const EVEREST = 8_848

export function fmt(n: number) {
  return Math.round(n).toLocaleString('en-US')
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
