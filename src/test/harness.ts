import { getFunctionName } from 'convex/server'

// Shared rig for the page tests.
//
// The pure-logic tests run in node and stay fast; only the files that need a
// DOM opt in with a `@vitest-environment jsdom` docblock. This holds the two
// things every one of those files needs: somewhere to put fake query results,
// and a viewport you can move.

// ── Convex ──────────────────────────────────────────────────────────────────
// Keyed by "module:function" from getFunctionName, because `api.people.listPeople`
// is an anyApi proxy that hands back a fresh object on every access — comparing
// references would silently never match.
const results = new Map<string, unknown>()

export function setQuery(name: string, value: unknown) {
  results.set(name, value)
}

export function resetQueries() {
  results.clear()
}

// The shape vi.mock('convex/react') should return. A query with no result set
// stays `undefined`, which is exactly what useQuery does while loading — so a
// test that forgets to stub something sees the loading state rather than a
// crash, and says so.
export function convexReactMock() {
  return {
    useQuery: (ref: unknown, args: unknown) => {
      if (args === 'skip') return undefined
      return results.get(getFunctionName(ref as never))
    },
    useMutation: () => async () => undefined,
    useConvex: () => ({}),
  }
}

// ── The viewport ────────────────────────────────────────────────────────────
// jsdom has no matchMedia at all, so this is the whole implementation.
//
// It deliberately does NOT fire change events by default. That is not a
// shortcut — it is the failure this rig exists to reproduce. On the real gym
// TV the change event was measured firing zero times while matches had already
// flipped, which stranded the board in the phone layout. Tests that want the
// healthy path ask for it explicitly with fireChange.
type Listener = (e: { matches: boolean; media: string }) => void
const listeners = new Set<{ media: string; fn: Listener }>()

function matches(media: string): boolean {
  const max = /max-width:\s*(\d+)px/.exec(media)
  if (max) return window.innerWidth <= Number(max[1])
  const min = /min-width:\s*(\d+)px/.exec(media)
  if (min) return window.innerWidth >= Number(min[1])
  return false
}

export function installMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (media: string) => ({
      media,
      get matches() {
        if (staleReads > 0) {
          staleReads--
          return !matches(media)
        }
        return matches(media)
      },
      addEventListener: (_: string, fn: Listener) => listeners.add({ media, fn }),
      removeEventListener: (_: string, fn: Listener) => {
        for (const l of listeners) if (l.fn === fn) listeners.delete(l)
      },
      // The legacy pair, present so nothing throws if it is reached.
      addListener: (fn: Listener) => listeners.add({ media, fn }),
      removeListener: (fn: Listener) => {
        for (const l of listeners) if (l.fn === fn) listeners.delete(l)
      },
      onchange: null,
      dispatchEvent: () => true,
    }),
  })
}

/**
 * Move the viewport.
 *
 * @param width          new innerWidth
 * @param fireChange     also fire the matchMedia change event. Off by default,
 *                       which reproduces the browser behaviour that caused the
 *                       stranded-layout bug.
 * @param fireResize     also fire window resize. On by default, because a real
 *                       browser always does.
 */
export function setViewport(
  width: number,
  { fireChange = false, fireResize = true }: { fireChange?: boolean; fireResize?: boolean } = {}
) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })
  Object.defineProperty(document.documentElement, 'clientWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  if (fireChange) {
    for (const l of listeners) l.fn({ matches: matches(l.media), media: l.media })
  }
  if (fireResize) window.dispatchEvent(new Event('resize'))
}

// Stage the mount race: the very first read of `matches` reports the old
// viewport, every read after it reports the truth.
//
// This is the gap the sync() inside the effect exists to close. The state
// initializer reads the width once during render; if the window moves before
// the effect subscribes, the change event lands with no listener and the board
// keeps the answer it got from that first read forever.
let staleReads = 0
export function staleFirstRead(times = 1) {
  staleReads = times
}

export function resetViewport() {
  listeners.clear()
  staleReads = 0
}
