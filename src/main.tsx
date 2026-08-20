import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import App from './App'
import LogPage from './LogPage'
import QrPage from './QrPage'
import './index.css'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

// Three surfaces, three audiences, no router library:
//   /      the gym TV and anyone watching
//   /log   a member's phone, reached by scanning a machine's QR code
//   /qr    a trainer printing those QR codes, once
//
// Vercel serves index.html for unknown paths (see vercel.json), so these are
// real URLs a QR code can point at rather than hash fragments.
function Route() {
  const path = window.location.pathname.replace(/\/+$/, '')
  if (path === '/log') return <LogPage />
  if (path === '/qr') return <QrPage />
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <Route />
    </ConvexProvider>
  </React.StrictMode>
)
