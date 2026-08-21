import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import App from './App'
import LogPage from './LogPage'
import QrPage from './QrPage'
import JoinPage from './JoinPage'
import PledgePage from './PledgePage'
import { CHALLENGE_WINDOW } from './config'
import './index.css'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

// Five surfaces, five audiences, no router library:
//   /       anyone watching, and the trainer computer
//   /tv     the gym TV — display layout, locked, nothing to log in to
//   /pledge the pre-season board, forced (useful after the start too)
//   /join   a member's phone: claim your meters
//   /log    a member's phone: log what you did
//   /qr     a trainer printing the machine codes, once
//
// Vercel serves index.html for unknown paths (see vercel.json), so these are
// real URLs a QR code can point at rather than hash fragments.
// The gym TV, usually a cast tab. Before the challenge starts there is no
// journey to show, so it shows the pledge board and swaps itself over on the
// morning of the first — one URL cast once and never touched again.
//
// Checked on a timer rather than once at load: this tab will have been open
// for eleven days by the time the challenge starts, and nobody is going to be
// standing there at midnight to refresh it.
function GymTv() {
  const startsAt = CHALLENGE_WINDOW ? CHALLENGE_WINDOW.start.getTime() : 0
  const [started, setStarted] = React.useState(() => !CHALLENGE_WINDOW || Date.now() >= startsAt)

  React.useEffect(() => {
    if (started) return
    const t = setInterval(() => {
      if (Date.now() >= startsAt) setStarted(true)
    }, 15_000)
    return () => clearInterval(t)
  }, [started, startsAt])

  return started ? <App castMode /> : <PledgePage />
}

function Route() {
  const path = window.location.pathname.replace(/\/+$/, '')
  if (path === '/log') return <LogPage />
  if (path === '/qr') return <QrPage />
  if (path === '/join') return <JoinPage />
  if (path === '/pledge') return <PledgePage />
  if (path === '/tv') return <GymTv />
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <Route />
    </ConvexProvider>
  </React.StrictMode>
)
