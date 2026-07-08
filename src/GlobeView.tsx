import { useEffect, useRef } from 'react'
import Globe, { GlobeInstance } from 'globe.gl'
import { ROUTE, BRAND, GOAL } from './config'
import { positionAt } from './geo'

type Props = {
  totalMeters: number
  paceMeters: number
  flyToSignal: number // increment to make the camera fly to the current position
  follow?: boolean // replay mode: camera continuously tracks the current position
}

export default function GlobeView({ totalMeters, paceMeters, flyToSignal, follow }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeInstance | null>(null)
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const followTarget = useRef<{ lat: number; lng: number } | null>(null)

  // Init once
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const g = new Globe(el)
      .globeImageUrl('/earth-day.jpg')
      .backgroundColor('rgba(0,0,0,0)')
      .width(el.clientWidth)
      .height(el.clientHeight)
      .atmosphereColor('#88b6f2')
      .atmosphereAltitude(0.18)
      .arcStroke(0.65)
      .arcAltitudeAutoScale(0.35)
      .arcColor('color')
      .arcDashLength((d: any) => (d.done ? 1 : 0.35))
      .arcDashGap((d: any) => (d.done ? 0 : 0.18))
      .arcDashAnimateTime((d: any) => (d.active ? 2600 : 0))
      .labelText('text')
      .labelSize('size')
      .labelColor('color')
      .labelDotRadius(0)
      .labelAltitude(0.015)
      .ringColor(() => (t: number) => `rgba(217,59,88,${1 - t})`)
      .ringMaxRadius(4.5)
      .ringPropagationSpeed(2.5)
      .ringRepeatPeriod(900)
      .pointAltitude(0.005)
      .pointColor('color')
      .pointRadius('r')
      // The gym's logo travels the route and stamps every city it has passed.
      // Styled like round app icons; the traveling one is big, ringed, and glowing
      // so the trail of small faded stamps never competes with it.
      .htmlElement((d: any) => {
        const img = document.createElement('img')
        img.src = '/logo-t.png'
        const size = d.current ? 52 : 18
        img.style.width = `${size}px`
        img.style.height = `${size}px`
        img.style.borderRadius = '50%'
        img.style.border = d.current ? '2.5px solid #D93B58' : '1px solid rgba(217,59,88,0.5)'
        img.style.boxShadow = d.current
          ? '0 0 16px rgba(217,59,88,0.95), 0 0 5px rgba(0,0,0,0.9)'
          : '0 1px 4px rgba(0,0,0,0.85)'
        img.style.pointerEvents = 'none'
        img.style.transition = 'opacity 0.25s'
        img.dataset.base = d.current ? '1' : '0.65'
        return img
      })
      .htmlAltitude((d: any) => (d.current ? 0.02 : 0.006))
      .htmlElementVisibilityModifier((elm: HTMLElement, isVisible: boolean) => {
        elm.style.opacity = isVisible ? (elm.dataset.base ?? '1') : '0'
      })

    g.controls().autoRotate = true
    g.controls().autoRotateSpeed = 0.5
    g.controls().enableZoom = true
    g.controls().minDistance = 115 // globe radius is 100 — don't clip through it
    g.controls().maxDistance = 520
    g.controls().zoomSpeed = 0.6
    const start = positionAt(0)
    g.pointOfView({ lat: start.lat, lng: start.lng, altitude: 2.2 }, 0)

    globeRef.current = g
    // Handy for debugging on the gym computer: __globe.pointOfView({lat, lng, altitude})
    ;(window as any).__globe = g

    const onResize = () => {
      g.width(el.clientWidth)
      g.height(el.clientHeight)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(el)
    return () => {
      ro.disconnect()
      if (resumeTimer.current) clearTimeout(resumeTimer.current)
      g._destructor()
      globeRef.current = null
    }
  }, [])

  // Update route data whenever progress changes
  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    const cur = positionAt(totalMeters)
    const ghost = positionAt(Math.min(paceMeters, GOAL))

    // Build waypoint list with the current position spliced in
    const pts: { lat: number; lng: number; done: boolean }[] = []
    for (let i = 0; i < ROUTE.length; i++) {
      if (ROUTE[i].m <= totalMeters) {
        pts.push({ lat: ROUTE[i].lat, lng: ROUTE[i].lng, done: true })
      } else {
        if (totalMeters > 0 && totalMeters < GOAL) pts.push({ lat: cur.lat, lng: cur.lng, done: true })
        for (let j = i; j < ROUTE.length; j++) pts.push({ lat: ROUTE[j].lat, lng: ROUTE[j].lng, done: false })
        break
      }
    }
    if (totalMeters >= GOAL) pts.push({ lat: cur.lat, lng: cur.lng, done: true })

    const arcs = []
    for (let i = 0; i < pts.length - 1; i++) {
      const done = pts[i + 1].done
      arcs.push({
        startLat: pts[i].lat,
        startLng: pts[i].lng,
        endLat: pts[i + 1].lat,
        endLng: pts[i + 1].lng,
        color: done ? BRAND.red : 'rgba(255,255,255,0.55)',
        done,
        active: pts[i].done && !pts[i + 1].done,
      })
    }
    g.arcsData(arcs)

    const labels = ROUTE.filter((c) => c.major).map((c) => ({
      lat: c.lat,
      lng: c.lng,
      text: c.name.split('—')[0].split(',')[0].split('.')[0].trim(),
      size: 1.1,
      color: c.m <= totalMeters ? 'rgba(242,155,171,1)' : 'rgba(255,255,255,0.9)',
    }))
    g.labelsData(labels)

    // Logo stamps: one on every city already passed, plus the big traveling logo.
    const stamps: { lat: number; lng: number; current: boolean }[] = ROUTE.filter(
      (c) => c.m <= totalMeters
    ).map((c) => ({ lat: c.lat, lng: c.lng, current: false }))
    if (totalMeters > 0) stamps.push({ lat: cur.lat, lng: cur.lng, current: true })
    g.htmlElementsData(stamps)

    g.ringsData(totalMeters > 0 ? [{ lat: cur.lat, lng: cur.lng }] : [])
    g.pointsData(
      paceMeters > 0
        ? [{ lat: ghost.lat, lng: ghost.lng, color: 'rgba(255,255,255,0.85)', r: 0.32 }]
        : []
    )

    followTarget.current = cur
  }, [totalMeters, paceMeters, follow])

  // Replay camera: smooth per-frame pursuit of the current position. No tweens —
  // restarting a tween every data tick is what causes jerky back-and-forth motion.
  // Longitude delta always takes the shortest path, so the globe only ever rolls
  // eastward with the journey.
  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    if (!follow) {
      g.controls().autoRotate = true
      return
    }
    g.controls().autoRotate = false
    let raf = 0
    const step = () => {
      const tgt = followTarget.current
      const g2 = globeRef.current
      if (g2 && tgt) {
        const pov = g2.pointOfView()
        const dLng = ((tgt.lng - pov.lng + 540) % 360) - 180
        g2.pointOfView(
          {
            lat: pov.lat + (tgt.lat - pov.lat) * 0.06,
            lng: pov.lng + dLng * 0.06,
            altitude: pov.altitude + (1.5 - pov.altitude) * 0.05,
          },
          0
        )
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [follow])

  // Camera fly-to on demand (new entry / celebration), then resume rotation
  useEffect(() => {
    const g = globeRef.current
    if (!g || flyToSignal === 0) return
    const cur = positionAt(totalMeters)
    g.controls().autoRotate = false
    g.pointOfView({ lat: cur.lat, lng: cur.lng, altitude: 1.7 }, 1400)
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
    resumeTimer.current = setTimeout(() => {
      const g2 = globeRef.current
      if (g2) g2.controls().autoRotate = true
    }, 9000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToSignal])

  return <div ref={containerRef} className="absolute inset-0" />
}
