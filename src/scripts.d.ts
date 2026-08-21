// The crossings test imports the generator so it can recompute from real
// geometry and catch a stale src/stateCrossings.ts.
declare module '*/state-crossings.mjs' {
  export function computeCrossings(step?: number): { id: string; name: string; m: number }[]
}
