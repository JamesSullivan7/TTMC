import { ROUTE, CHALLENGE_NAME } from './config'

// Interpolate position along the route for a given journey-meter total.
// Handles date-line crossing by always taking the shortest longitude path.
export function positionAt(meters: number): { lat: number; lng: number } {
  const total = Math.max(0, meters)
  if (total >= ROUTE[ROUTE.length - 1].m) {
    const last = ROUTE[ROUTE.length - 1]
    return { lat: last.lat, lng: last.lng }
  }
  let i = 0
  while (i < ROUTE.length - 1 && ROUTE[i + 1].m <= total) i++
  const a = ROUTE[i]
  const b = ROUTE[Math.min(i + 1, ROUTE.length - 1)]
  const span = b.m - a.m
  const t = span > 0 ? (total - a.m) / span : 0
  const dLng = ((b.lng - a.lng + 540) % 360) - 180
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: ((a.lng + dLng * t + 540) % 360) - 180,
  }
}

// Human-readable location line: between which waypoints, distance to next.
// `done` is explicit rather than left for each caller to infer from toNext === 0.
// Three surfaces render nextStop — the member's phone, the trainer panel and the
// TV — and every one of them read "3 km closer to Cross Country — complete" once
// the road ran out, because "the next stop" has no meaning after the last one.
// That is the finish, the moment the whole month is pointed at, so it is worth a
// field rather than three guesses.
export function locationLabel(meters: number): {
  where: string
  nextStop: string
  toNext: number
  done: boolean
} {
  const total = Math.max(0, meters)
  const last = ROUTE[ROUTE.length - 1]
  if (total >= last.m) {
    return { where: 'Home in Tulsa', nextStop: `${CHALLENGE_NAME} — complete`, toNext: 0, done: true }
  }
  let i = 0
  while (i < ROUTE.length - 1 && ROUTE[i + 1].m <= total) i++
  const a = ROUTE[i]
  const b = ROUTE[i + 1]
  const cleanName = (n: string) => n.split('—')[0].split(',')[0].trim()
  return {
    where: total === 0 ? 'Tulsa — the start line' : `Past ${cleanName(a.name)}`,
    nextStop: cleanName(b.name),
    toNext: b.m - total,
    done: false,
  }
}
