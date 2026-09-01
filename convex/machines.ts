// The machines, and the unit each one shows on its own screen.
//
// This is the single source of truth for both the Convex functions and the UI —
// src/config.ts re-exports from here — because a machine's unit is a
// correctness concern, not a display preference. The Assault Bike reads in
// kilometers; if "2.6" off its screen were stored as 2.6 meters, the journey
// would silently lose 2,597 meters and nobody would ever notice.
export type Unit = 'meters' | 'km' | 'miles'

export const METERS_PER_MILE = 1609.344
export const METERS_PER_KM = 1000

// One table rather than a ternary per call site. Adding a unit means adding a
// row here, and every cap, label and conversion follows automatically.
const METERS_PER_UNIT: Record<Unit, number> = {
  meters: 1,
  km: METERS_PER_KM,
  miles: METERS_PER_MILE,
}

export const MACHINES = [
  { name: 'Row', unit: 'meters' },
  { name: 'Ski', unit: 'meters' },
  { name: 'Erg Bike', unit: 'meters' },
  { name: 'Assault Bike', unit: 'km' },
  { name: 'Assault Runner', unit: 'meters' },
] as const satisfies readonly { name: string; unit: Unit }[]

export type Machine = (typeof MACHINES)[number]['name']

export const MACHINE_NAMES: readonly Machine[] = MACHINES.map((m) => m.name)

export function machineUnit(name: string): Unit | null {
  return MACHINES.find((m) => m.name === name)?.unit ?? null
}

export function metersPerUnit(unit: Unit): number {
  return METERS_PER_UNIT[unit]
}

export function unitLabel(unit: Unit): string {
  return unit === 'miles' ? 'Miles' : unit === 'km' ? 'Kilometers' : 'Meters'
}

export function unitAbbrev(unit: Unit): string {
  return unit === 'miles' ? 'mi' : unit === 'km' ? 'km' : 'm'
}

// Convert whatever a trainer reads off the machine's screen into real meters.
export function toMeters(machineName: string, displayed: number): number {
  const unit = machineUnit(machineName)
  if (unit === null) throw new Error('Unknown machine')
  return displayed * METERS_PER_UNIT[unit]
}

// Read what a human actually typed.
//
// The Assault Bike's screen shows a decimal comma — "02,08" is two point oh
// eight kilometers — so a comma cannot simply be stripped. What it means
// depends on the machine, and guessing wrong is a silent 100x error either
// way, so the unit decides rather than a heuristic about digit counts:
//
//   distance units (km, miles)  "02,08" -> 2.08     comma is the decimal point
//   meters                      "2,000" -> 2000     comma is a thousands mark
//
// Meters machines never show a fraction, so on those a comma can only be a
// thousands separator. Returns null for anything that is not a single positive
// number, so the caller never has to check for NaN.
export function parseAmount(machineName: string, raw: string): number | null {
  const unit = machineUnit(machineName)
  if (unit === null) return null

  let s = raw.trim().replace(/\s/g, '')
  if (s === '') return null

  s = unit === 'meters' ? s.replace(/,/g, '') : s.replace(/,/g, '.')

  // One optional decimal point, at least one digit, nothing else. Leading
  // zeros are fine: the bike writes them.
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return null

  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}
