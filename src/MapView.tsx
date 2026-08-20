import { useMemo } from 'react'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import statesTopo from 'us-atlas/states-10m.json'
import { ROUTE, BRAND, GOAL } from './config'
import { positionAt } from './geo'

// The map is drawn once and the SVG scales itself to whatever the container is.
// That is the whole reason this replaced a WebGL globe: no camera, no resize
// handling, no render loop, nothing to fail on a gym TV that has to sit there
// unattended for a month.
const W = 975
const H = 610

// The canonical albersUsa fit for a 975x610 frame. The same projection places
// the state shapes AND the route waypoints, so the two can never drift apart.
const projection = geoAlbersUsa().scale(1300).translate([W / 2, H / 2])
const toPath = geoPath(projection)

const topo = statesTopo as any

// Alaska and Hawaii are drawn by albersUsa as insets in the bottom-left. The
// route never goes near them, and keeping them would letterbox the map down to
// a thumbnail on a wide TV — so drop them and crop the frame to the lower 48.
const ALASKA = '02'
const HAWAII = '15'
const allStates = feature(topo, topo.objects.states) as any
const conus = {
  type: 'FeatureCollection',
  features: allStates.features.filter((f: any) => f.id !== ALASKA && f.id !== HAWAII),
}

const PAD = 14
const [[bx0, by0], [bx1, by1]] = toPath.bounds(conus as any)
const VIEW_BOX = [bx0 - PAD, by0 - PAD, bx1 - bx0 + PAD * 2, by1 - by0 + PAD * 2]
  .map((n) => n.toFixed(1))
  .join(' ')

function project(lat: number, lng: number): [number, number] | null {
  const p = projection([lng, lat])
  return p ? [p[0], p[1]] : null
}

function polyline(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  return 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')
}

// Milestone names are written to be shouted during a celebration. On the map
// they are just place names, so quiet them back down.
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
  const { landPath, borderPath } = useMemo(
    () => ({
      landPath: toPath(conus as any) ?? '',
      borderPath: toPath(mesh(topo, topo.objects.states, (a: any, b: any) => a !== b) as any) ?? '',
    }),
    []
  )

  const cur = positionAt(totalMeters)
  const curPt = project(cur.lat, cur.lng)

  const ghost = positionAt(Math.min(paceMeters, GOAL))
  const ghostPt = paceMeters > 0 ? project(ghost.lat, ghost.lng) : null

  // The full road, and the part of it we have covered. The travelled line is
  // built from the waypoints already passed plus the exact current position, so
  // it tracks the meter total rather than approximating it with a fraction of
  // the on-screen path length.
  const { fullLine, doneLine, stops } = useMemo(() => {
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

    return { fullLine: polyline(all), doneLine: polyline(done), stops: marks }
  }, [totalMeters, curPt?.[0], curPt?.[1]])

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
          <filter id="roadGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="logoClip">
            <circle cx="0" cy="0" r="15" />
          </clipPath>
        </defs>

        {/* The country */}
        <path d={landPath} fill="#111113" stroke="none" />
        <path d={borderPath} fill="none" stroke="#26262b" strokeWidth={0.7} />
        <path d={landPath} fill="none" stroke="#34343c" strokeWidth={1.1} />

        {/* The road still ahead */}
        <path
          d={fullLine}
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth={1.6}
          strokeDasharray="5 6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* The road behind us */}
        {doneLine && (
          <path
            d={doneLine}
            fill="none"
            stroke={BRAND.red}
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#roadGlow)"
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
            stroke={s.passed ? BRAND.red : '#4a4a52'}
            strokeWidth={s.major ? 2 : 1.3}
          />
        ))}

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
                fill={s.passed ? BRAND.pink : 'rgba(255,255,255,0.72)'}
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
              <animate attributeName="r" from="7" to="26" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.85" to="0" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle r="17" fill="#050505" stroke={BRAND.red} strokeWidth={2} />
            <image href="/logo-t.png" x={-15} y={-15} width={30} height={30} clipPath="url(#logoClip)" />
          </g>
        )}
      </svg>
    </div>
  )
}
