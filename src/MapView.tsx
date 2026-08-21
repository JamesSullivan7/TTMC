import { useMemo } from 'react'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import statesTopo from 'us-atlas/states-10m.json'
import { ACTS, ROUTE, BRAND, GOAL } from './config'
import { STATE_CROSSINGS } from './stateCrossings'
import { positionAt } from './geo'

// The map is drawn once and the SVG scales itself to whatever the container is.
// That is the whole reason this replaced a WebGL globe: no camera, no resize
// handling, no render loop, nothing to fail on a gym TV that has to sit there
// unattended for a month.
//
// What motion there is comes from SVG's own <animate>, not React — the browser
// runs it on the compositor, so nothing re-renders and nothing is burning
// battery on a machine casting to a TV all day.
const W = 975
const H = 610

// ── The dials ───────────────────────────────────────────────────────────────
// The look, gathered in one place so it can be tuned without reading the
// drawing code. LIT_STRENGTH is the one to reach for first: raise it for
// bolder states, drop it toward 0.15 to make them a whisper.
const LAND = '#1e1e26' // states the road has not reached
const BORDER = '#3a3a46'
const COAST = '#5a5a6a'
const BACKDROP = '#07070a'
const LIT_STRENGTH = 0.3 // 0..1, how far a crossed state moves toward its act colour
const LIT_STRENGTH_CURRENT = 0.5 // the state we are standing in, brighter
const HALO = 0.2 // warm glow behind the country
const TAIL_METERS = 700_000 // how much of the recent road glows

// The canonical albersUsa fit for a 975x610 frame. The same projection places
// the state shapes AND the route waypoints, so they cannot drift apart.
const projection = geoAlbersUsa().scale(1300).translate([W / 2, H / 2])
const toPath = geoPath(projection)

const topo = statesTopo as any

// Alaska and Hawaii are drawn by albersUsa as insets in the bottom-left. The
// route never goes near them, and keeping them would letterbox the map down to
// a thumbnail on a wide TV — so drop them and crop the frame to the lower 48.
const allStates = feature(topo, topo.objects.states) as any
const conusFeatures = allStates.features.filter(
  (f: any) => f.id !== '02' && f.id !== '15' && Number(f.id) < 60
)
const conus = { type: 'FeatureCollection', features: conusFeatures }

const PAD = 14
const [[bx0, by0], [bx1, by1]] = toPath.bounds(conus as any)
const VIEW_BOX = [bx0 - PAD, by0 - PAD, bx1 - bx0 + PAD * 2, by1 - by0 + PAD * 2]
  .map((n) => n.toFixed(1))
  .join(' ')

// Shapes never change, so build every path string once for the life of the page.
const LAND_PATH = toPath(conus as any) ?? ''
const BORDER_PATH = toPath(mesh(topo, topo.objects.states, (a: any, b: any) => a !== b) as any) ?? ''
const STATE_SHAPES: { id: string; d: string }[] = conusFeatures.map((f: any) => ({
  id: String(f.id),
  d: toPath(f) ?? '',
}))

const crossingByStateId = new Map(STATE_CROSSINGS.map((c) => [c.id, c.m]))

// Blend a brand colour toward the unlit land, so a crossed state reads as a
// wash the route sits on top of rather than a block of poster colour.
function mixToward(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const base = parseInt(LAND.slice(1), 16)
  const ch = (shift: number) =>
    Math.round((((n >> shift) & 255) * amount + ((base >> shift) & 255) * (1 - amount)))
  return (
    '#' +
    [ch(16), ch(8), ch(0)].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')
  )
}

// Each act paints the states it carried the gym through, in the same three
// brand tones as the act bars — so by the end the country reads as a record of
// how the journey was made, not just how far it got.
const ACT_TINTS = [BRAND.darkRed, BRAND.red, BRAND.pink]
function tintFor(enteredAt: number): string {
  const i = ACTS.findIndex((a) => enteredAt >= a.from && enteredAt < a.to)
  return ACT_TINTS[i < 0 ? ACTS.length - 1 : i]
}

function project(lat: number, lng: number): [number, number] | null {
  const p = projection([lng, lat])
  return p ? [p[0], p[1]] : null
}

function polyline(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  return 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')
}

// Milestone names are written to be shouted during a celebration. On the map
// they are just place names, so quieten them back down.
function mapLabel(name: string): string {
  const head = name.split('—')[0].split(', ')[0].trim()
  const isShouted = head === head.toUpperCase() && /[A-Z]/.test(head)
  if (!isShouted) return head
  return head
    .split('. ')[0]
    .replace(/\.$/, '')
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

type Props = {
  totalMeters: number
  paceMeters: number
}

export default function MapView({ totalMeters, paceMeters }: Props) {
  const cur = positionAt(totalMeters)
  const curPt = project(cur.lat, cur.lng)

  const ghost = positionAt(Math.min(paceMeters, GOAL))
  const ghostPt = paceMeters > 0 ? project(ghost.lat, ghost.lng) : null

  // The last state the road entered — the one the gym is standing in now.
  const currentStateId = useMemo(() => {
    let id: string | null = null
    for (const c of STATE_CROSSINGS) if (c.m <= totalMeters) id = c.id
    return id
  }, [totalMeters])

  // The full road, the part covered, and the most recent stretch of it.
  const { fullLine, doneLine, tailLine, stops } = useMemo(() => {
    const all: [number, number][] = []
    const done: [number, number][] = []
    const marks: { pt: [number, number]; name: string; passed: boolean; major?: boolean }[] = []

    for (const r of ROUTE) {
      const p = project(r.lat, r.lng)
      if (!p) continue
      all.push(p)
      const passed = r.m <= totalMeters
      if (passed) done.push(p)
      marks.push({ pt: p, name: r.name, passed, major: r.major })
    }
    if (curPt && totalMeters > 0 && totalMeters < GOAL) done.push(curPt)

    // Sampled rather than taken from waypoints, so the glow is the same length
    // whether the last stretch crossed six cities or none.
    const tail: [number, number][] = []
    if (totalMeters > 0) {
      const from = Math.max(0, totalMeters - TAIL_METERS)
      for (let m = from; m <= totalMeters; m += 20_000) {
        const q = positionAt(m)
        const p = project(q.lat, q.lng)
        if (p) tail.push(p)
      }
    }

    return {
      fullLine: polyline(all),
      doneLine: polyline(done),
      tailLine: polyline(tail),
      stops: marks,
    }
  }, [totalMeters, curPt?.[0], curPt?.[1]])

  const nextStop = stops.find((s) => !s.passed)

  return (
    <div className="absolute inset-0">
      <svg
        viewBox={VIEW_BOX}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        role="img"
        aria-label="Route map of the United States"
      >
        <defs>
          <filter id="roadGlow" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="tailGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="halo" cx="50%" cy="50%" r="62%">
            <stop offset="0%" stopColor={BRAND.darkRed} stopOpacity={HALO} />
            <stop offset="100%" stopColor={BRAND.darkRed} stopOpacity={0} />
          </radialGradient>
          <clipPath id="logoClip">
            <circle cx="0" cy="0" r="15" />
          </clipPath>
        </defs>

        <rect x={bx0 - PAD} y={by0 - PAD} width={bx1 - bx0 + PAD * 2} height={by1 - by0 + PAD * 2} fill={BACKDROP} />
        <rect x={bx0 - PAD} y={by0 - PAD} width={bx1 - bx0 + PAD * 2} height={by1 - by0 + PAD * 2} fill="url(#halo)" />

        {/* The country. A state fills in once the road reaches it, in the
            colour of the act that got us there. */}
        {STATE_SHAPES.map((s) => {
          const enteredAt = crossingByStateId.get(s.id)
          const lit = enteredAt !== undefined && enteredAt <= totalMeters
          const fill = !lit
            ? LAND
            : mixToward(tintFor(enteredAt!), s.id === currentStateId ? LIT_STRENGTH_CURRENT : LIT_STRENGTH)
          return <path key={s.id} d={s.d} fill={fill} />
        })}

        <path d={BORDER_PATH} fill="none" stroke={BORDER} strokeWidth={0.7} />
        <path d={LAND_PATH} fill="none" stroke={COAST} strokeWidth={1.3} />

        {/* The road still ahead. It drifts forward, which is the only thing on
            the map that says which way the journey is going. */}
        <path
          d={fullLine}
          fill="none"
          stroke="rgba(255,255,255,0.32)"
          strokeWidth={1.7}
          strokeDasharray="5 7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <animate attributeName="stroke-dashoffset" from="0" to="-24" dur="1.6s" repeatCount="indefinite" />
        </path>

        {/* The road behind us, and the most recent stretch of it glowing. */}
        {doneLine && (
          <path
            d={doneLine}
            fill="none"
            stroke={BRAND.red}
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#roadGlow)"
            opacity={0.75}
          />
        )}
        {tailLine && (
          <path
            d={tailLine}
            fill="none"
            stroke={BRAND.pink}
            strokeWidth={3.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#tailGlow)"
          />
        )}

        {/* Stops */}
        {stops.map((s, i) => (
          <circle
            key={i}
            cx={s.pt[0]}
            cy={s.pt[1]}
            r={s.major ? 4 : 2.6}
            fill={s.passed ? '#fff' : '#0d0d0d'}
            stroke={s.passed ? BRAND.red : '#55555f'}
            strokeWidth={s.major ? 2 : 1.3}
          />
        ))}

        {/* Where we are heading — otherwise the road ahead is a thin line
            across a lot of empty dark. */}
        {nextStop && (
          <circle cx={nextStop.pt[0]} cy={nextStop.pt[1]} r={5} fill="none" stroke={BRAND.pink} strokeWidth={1.4}>
            <animate attributeName="r" from="5" to="15" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.9" to="0" dur="2.4s" repeatCount="indefinite" />
          </circle>
        )}

        {/* Labels, majors only — all 24 stops labelled would be a wall of text */}
        {stops
          .filter((s) => s.major)
          .map((s, i) => {
            const flip = s.pt[0] > bx0 + (bx1 - bx0) * 0.72
            return (
              <text
                key={i}
                x={s.pt[0] + (flip ? -9 : 9)}
                y={s.pt[1] + 3.5}
                textAnchor={flip ? 'end' : 'start'}
                fontSize={12.5}
                fontWeight={800}
                fill={s.passed ? BRAND.pink : 'rgba(255,255,255,0.8)'}
                style={{ paintOrder: 'stroke', stroke: '#050505', strokeWidth: 3.5, letterSpacing: '0.03em' }}
              >
                {mapLabel(s.name)}
              </text>
            )
          })}

        {/* Where the pace ghost would be */}
        {ghostPt && <circle cx={ghostPt[0]} cy={ghostPt[1]} r={3.2} fill="rgba(255,255,255,0.85)" />}

        {/* Us */}
        {curPt && totalMeters > 0 && (
          <g transform={`translate(${curPt[0]},${curPt[1]})`}>
            <circle r="6" fill="none" stroke={BRAND.red} strokeWidth={1.6}>
              <animate attributeName="r" from="8" to="30" dur="2.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.85" to="0" dur="2.2s" repeatCount="indefinite" />
            </circle>
            <circle r="17" fill="#050505" stroke={BRAND.red} strokeWidth={2} />
            <image href="/logo-t.png" x={-15} y={-15} width={30} height={30} clipPath="url(#logoClip)" />
          </g>
        )}
      </svg>
    </div>
  )
}
