// Generates the postcard backdrops that are not photographs of a place.
//
// Why these are textless, when the wizard used to call them "number cards":
// Celebration draws the milestone name AND `fmt(milestone.m)} meters` on top of
// the postcard, over a radial wash that takes the image down to 28% at the
// centre and 6% at the edges. The postcard is a backdrop, not a card. A number
// printed into the image is a second number competing with the real one —
// which is exactly how halfway.jpg ended up showing "20 MILLION" behind a
// foreground reading 4,236,674, left over from the world-tour route.
//
// So these are atmosphere: dark, warm, high-contrast enough to survive the
// wash, and carrying no text at all.
//
// No image dependency. The browser already has canvas, so this serves a page
// that draws each backdrop and posts the JPEG back here to be written to disk.
//
//   node scripts/backdrops.mjs
//   → open http://localhost:5311 and it writes them itself
//
// Re-run any time; it overwrites.

import { createServer } from 'node:http'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'public/postcards'
const PORT = 5311
const W = 1920
const H = 1080

// Each backdrop belongs to a place on the route, so it is not generic texture —
// 6 million is the Ohio country before New York, 8 million is Missouri on the
// way home, 100 km to go is the final approach into Tulsa at night.
const CARDS = [
  { file: 'halfway.jpg', scene: 'road', hue: 'ember' },
  { file: '6-million.jpg', scene: 'hills', hue: 'ember' },
  { file: '8-million.jpg', scene: 'plains', hue: 'dusk' },
  { file: '100-to-go.jpg', scene: 'approach', hue: 'ember' },
]

const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>Backdrops</title>
<style>
  body { background:#0b0b0d; color:#eee; font:14px/1.6 system-ui, sans-serif; margin:0; padding:24px; }
  h1 { font-size:16px; letter-spacing:.2em; text-transform:uppercase; color:#F29BAB; }
  canvas { width:420px; height:236px; display:block; border-radius:8px; margin:10px 0 4px; }
  .row { display:inline-block; margin:0 18px 18px 0; vertical-align:top; }
  .name { font-family:ui-monospace, monospace; color:#8a8a93; font-size:12px; }
  #log { margin-top:16px; font-family:ui-monospace, monospace; color:#10B981; white-space:pre; }
</style>
<h1>Cross Country — postcard backdrops</h1>
<div id="out"></div>
<div id="log">rendering…</div>
<script>
const CARDS = ${JSON.stringify(CARDS)}
const W = ${W}, H = ${H}

const PALETTES = {
  // Kept in the family the rest of the app lives in: brand dark red and red,
  // against the same near-black the board uses.
  ember: { sky0:'#1a0508', sky1:'#3d0f18', glow:'#8C2336', hot:'#D93B58', ground:'#080608' },
  dusk:  { sky0:'#0a0710', sky1:'#2a1220', glow:'#6d1c30', hot:'#D93B58', ground:'#070609' },
}

function grain(ctx, amount) {
  // Film grain, drawn once. Without it the gradients band badly on a TV panel,
  // which is the most common way a generated backdrop reads as generated.
  const d = ctx.getImageData(0, 0, W, H)
  const p = d.data
  for (let i = 0; i < p.length; i += 4) {
    const n = (Math.random() - 0.5) * amount
    p[i] += n; p[i+1] += n; p[i+2] += n
  }
  ctx.putImageData(d, 0, 0)
}

function vignette(ctx) {
  const g = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, W*0.72)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.72)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

function sky(ctx, pal, horizon) {
  const g = ctx.createLinearGradient(0, 0, 0, horizon)
  g.addColorStop(0, pal.sky0)
  g.addColorStop(1, pal.sky1)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, horizon)

  // The sun already gone, low and centred — the light every one of these scenes
  // is lit by.
  const s = ctx.createRadialGradient(W/2, horizon, 0, W/2, horizon, W*0.42)
  s.addColorStop(0, pal.hot + 'cc')
  s.addColorStop(0.25, pal.glow + '99')
  s.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = s
  ctx.fillRect(0, 0, W, horizon + 40)
}

function stars(ctx, horizon, n) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * W
    const y = Math.random() * horizon * 0.75
    const r = Math.random() * 1.5 + 0.3
    ctx.fillStyle = 'rgba(255,235,240,' + (0.18 + Math.random() * 0.5) + ')'
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill()
  }
}

function ridge(ctx, yBase, amp, colour, seed) {
  ctx.fillStyle = colour
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, yBase)
  for (let x = 0; x <= W; x += 12) {
    const y = yBase
      + Math.sin((x + seed) * 0.0021) * amp
      + Math.sin((x + seed * 2) * 0.0057) * amp * 0.45
    ctx.lineTo(x, y)
  }
  ctx.lineTo(W, H)
  ctx.closePath(); ctx.fill()
}

function road(ctx, pal, horizon, widen) {
  // A road running to the vanishing point. The dashes down the middle are the
  // same device as the map's road ahead and the gauge track.
  ctx.fillStyle = pal.ground
  ctx.beginPath()
  ctx.moveTo(W/2 - 18, horizon)
  ctx.lineTo(W/2 + 18, horizon)
  ctx.lineTo(W/2 + widen, H)
  ctx.lineTo(W/2 - widen, H)
  ctx.closePath(); ctx.fill()

  // Verges catching the last of the light.
  ctx.strokeStyle = 'rgba(242,155,171,0.30)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(W/2 - 18, horizon); ctx.lineTo(W/2 - widen, H)
  ctx.moveTo(W/2 + 18, horizon); ctx.lineTo(W/2 + widen, H)
  ctx.stroke()

  let y = H, step = 96, len = 54
  while (y > horizon + 6) {
    const t = (y - horizon) / (H - horizon)
    ctx.fillStyle = 'rgba(255,240,240,' + (0.10 + t * 0.5) + ')'
    const w = Math.max(1.5, 11 * t)
    ctx.fillRect(W/2 - w/2, y - len * t, w, Math.max(2, len * t))
    y -= step * t + 14
  }
}

function draw(ctx, card) {
  const pal = PALETTES[card.hue]
  ctx.fillStyle = pal.sky0
  ctx.fillRect(0, 0, W, H)

  if (card.scene === 'road') {
    const hz = H * 0.52
    sky(ctx, pal, hz); stars(ctx, hz, 90)
    ridge(ctx, hz + 2, 7, 'rgba(6,5,7,0.96)', 40)
    road(ctx, pal, hz, W * 0.46)
  } else if (card.scene === 'hills') {
    const hz = H * 0.55
    sky(ctx, pal, hz); stars(ctx, hz, 60)
    ridge(ctx, hz - 6, 46, 'rgba(46,14,24,0.92)', 900)
    ridge(ctx, hz + 52, 62, 'rgba(24,8,13,0.95)', 300)
    ridge(ctx, hz + 150, 74, 'rgba(8,6,8,0.99)', 60)
  } else if (card.scene === 'plains') {
    const hz = H * 0.70
    sky(ctx, pal, hz); stars(ctx, hz, 190)
    ridge(ctx, hz, 9, 'rgba(9,7,10,0.97)', 500)
    // A fence line running out to nothing, which is what Missouri at night is.
    ctx.strokeStyle = 'rgba(242,155,171,0.16)'
    ctx.lineWidth = 2
    for (let i = 0; i < 26; i++) {
      const t = i / 26
      const x = W * 0.06 + t * W * 0.9
      const h = 16 + t * 92
      ctx.beginPath(); ctx.moveTo(x, hz + t * 40); ctx.lineTo(x, hz + t * 40 + h); ctx.stroke()
    }
  } else {
    const hz = H * 0.48
    sky(ctx, pal, hz); stars(ctx, hz, 70)
    ridge(ctx, hz + 2, 10, 'rgba(6,5,7,0.96)', 700)
    road(ctx, pal, hz, W * 0.52)
    // Town glow on the horizon — Tulsa, 100 km out.
    const g = ctx.createRadialGradient(W/2, hz, 0, W/2, hz, W*0.2)
    g.addColorStop(0, 'rgba(242,155,171,0.75)')
    g.addColorStop(0.4, 'rgba(217,59,88,0.35)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz + 30)
  }

  vignette(ctx)
  grain(ctx, 15)
}

;(async () => {
  const out = document.getElementById('out')
  const log = document.getElementById('log')
  const done = []
  for (const card of CARDS) {
    const c = document.createElement('canvas')
    c.width = W; c.height = H
    draw(c.getContext('2d'), card)
    const row = document.createElement('div')
    row.className = 'row'
    row.appendChild(c)
    const n = document.createElement('div')
    n.className = 'name'; n.textContent = card.file
    row.appendChild(n)
    out.appendChild(row)

    const dataUrl = c.toDataURL('image/jpeg', 0.92)
    const res = await fetch('/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: card.file, data: dataUrl.split(',')[1] }),
    })
    done.push(card.file + '  ' + (await res.text()))
    log.textContent = done.join('\\n')
  }
  log.textContent = done.join('\\n') + '\\n\\nAll written. You can close this.'
})()
</script>`

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/save') {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      try {
        const { file, data } = JSON.parse(body)
        if (!/^[a-z0-9._-]+\.jpg$/i.test(file)) throw new Error('bad filename')
        const buf = Buffer.from(data, 'base64')
        writeFileSync(join(DIR, file), buf)
        console.log(`wrote ${DIR}/${file}  ${(buf.length / 1024).toFixed(0)} KB`)
        res.end(`${(buf.length / 1024).toFixed(0)} KB`)
      } catch (e) {
        console.error('failed:', e.message)
        res.statusCode = 400
        res.end('failed: ' + e.message)
      }
    })
    return
  }
  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.end(PAGE)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Backdrop generator on http://localhost:${PORT}`)
  console.log('Open it; it draws and saves all four, then you can Ctrl-C.')
})
