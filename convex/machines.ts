// The machines, and the unit each one shows on its own screen.
//
// This is the single source of truth for both the Convex functions and the UI —
// src/config.ts re-exports from here — because a machine's unit is a
// correctness concern, not a display preference. An Assault Bike reads in
// miles; if "5" off its screen were stored as 5 meters, the journey would
// silently lose 8 kilometers and nobody would ever notice.
export type Unit = 'meters' | 'miles'

export const METERS_PER_MILE = 1609.344

export const MACHINES = [
  { name: 'Row', unit: 'meters' },
  { name: 'Ski', unit: 'meters' },
  { name: 'Erg Bike', unit: 'meters' },
  { name: 'Assault Bike', unit: 'miles' },
  { name: 'Assault Runner', unit: 'meters' },
] as const satisfies readonly { name: string; unit: Unit }[]

export type Machine = (typeof MACHINES)[number]['name']

export const MACHINE_NAMES: readonly Machine[] = MACHINES.map((m) => m.name)

export function machineUnit(name: string): Unit | null {
  return MACHINES.find((m) => m.name === name)?.unit ?? null
}

export function unitLabel(unit: Unit): string {
  return unit === 'miles' ? 'Miles' : 'Meters'
}

export function unitAbbrev(unit: Unit): string {
  return unit === 'miles' ? 'mi' : 'm'
}

// Convert whatever a trainer reads off the machine's screen into real meters.
export function toMeters(machineName: string, displayed: number): number {
  const unit = machineUnit(machineName)
  if (unit === null) throw new Error('Unknown machine')
  return unit === 'miles' ? displayed * METERS_PER_MILE : displayed
}
