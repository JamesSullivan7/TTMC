import { useEffect, useRef } from 'react'
import { Milestone, BRAND, fmt } from './config'
import { downloadShareCard } from './shareCard'

const CONFETTI_COLORS = ['#D93B58', '#F29BAB', '#8C2336', '#ffffff']

function Confetti({ count }: { count: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="confetti"
          style={{
            left: `${(i * 97) % 100}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDuration: `${2.6 + ((i * 37) % 30) / 10}s`,
            animationDelay: `${((i * 53) % 25) / 10}s`,
            transform: `rotate(${(i * 71) % 360}deg)`,
          }}
        />
      ))}
    </div>
  )
}

export default function Celebration({
  milestone,
  day,
  onDone,
}: {
  milestone: Milestone
  day: number
  onDone: () => void
}) {
  const isFinish = milestone.kind === 'finish' || milestone.kind === 'stretch'
  const big = isFinish || milestone.major
  const rootRef = useRef<HTMLDivElement>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (isFinish) return // finish stays until clicked
    const t = setTimeout(onDone, big ? 14_000 : 8_000)
    return () => clearTimeout(t)
  }, [milestone, isFinish, big, onDone])

  // Dismiss via a direct native listener — doesn't depend on React's delegated
  // event system, so a click on the kiosk always lands.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const h = () => onDoneRef.current()
    el.addEventListener('click', h)
    return () => el.removeEventListener('click', h)
  }, [])

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 cursor-pointer celeb-fade">
      {/* Postcard backdrop (if a photo exists for this milestone) */}
      {milestone.img && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${milestone.img})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
      {/* Brand wash on top — keeps text readable with or without a photo */}
      <div
        className="absolute inset-0"
        style={{
          background: milestone.img
            ? 'radial-gradient(ellipse at center, rgba(20,5,8,0.72) 0%, rgba(5,5,5,0.94) 80%)'
            : 'radial-gradient(ellipse at center, rgba(140,35,54,0.94) 0%, rgba(5,5,5,0.98) 75%)',
        }}
      />

      {big && <Confetti count={isFinish ? 90 : 40} />}

      <div className="relative h-full flex items-center justify-center">
        {/* Pulsing rings behind the content */}
        <div className="absolute w-72 h-72 flex items-center justify-center pointer-events-none">
          <div className="celeb-ring w-72 h-72" />
          <div className="celeb-ring w-72 h-72" style={{ animationDelay: '0.6s' }} />
        </div>

        <div className="relative text-center px-8 celeb-in max-w-5xl">
          <img
            src="/logo-t.png"
            alt=""
            className="w-16 h-16 mx-auto mb-4 rounded-full"
            style={{ border: `2px solid ${BRAND.red}`, boxShadow: `0 0 18px ${BRAND.red}77` }}
          />
          <div className="text-sm font-bold tracking-[0.5em] uppercase mb-3" style={{ color: BRAND.pink }}>
            {isFinish ? 'Final destination' : 'Milestone reached'}
          </div>
          <div
            className="font-display uppercase leading-none text-white"
            style={{ fontSize: isFinish ? 'clamp(3rem, 9vw, 7.5rem)' : 'clamp(2.2rem, 7vw, 5.5rem)' }}
          >
            {milestone.name}
          </div>
          <div className="mt-5 text-xl md:text-2xl font-black tabular-nums" style={{ color: BRAND.red }}>
            {fmt(milestone.m)} meters
          </div>
          {milestone.note && (
            <div className="mt-4 text-zinc-200 text-base md:text-lg max-w-2xl mx-auto">{milestone.note}</div>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation()
              downloadShareCard(milestone, day)
            }}
            className="mt-7 px-5 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest transition-all hover:opacity-80"
            style={{ background: BRAND.red, color: '#fff' }}
          >
            Save share card
          </button>

          <div className="mt-6 text-xs uppercase tracking-widest text-zinc-400">
            {isFinish ? 'Click anywhere to continue' : 'Tulsa Training — World Tour'}
          </div>
        </div>
      </div>
    </div>
  )
}
