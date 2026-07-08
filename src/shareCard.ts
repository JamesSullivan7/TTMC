import { Milestone, BRAND, fmt, CHALLENGE_DAYS } from './config'

// Renders a 1080×1080 branded share card for a milestone and downloads it.
export async function downloadShareCard(milestone: Milestone, day: number) {
  const size = 1080
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  await document.fonts.load('100px Anton')
  await document.fonts.load('700 40px Inter')

  // Background
  ctx.fillStyle = '#050505'
  ctx.fillRect(0, 0, size, size)
  const glow = ctx.createRadialGradient(size / 2, size / 2, 100, size / 2, size / 2, 760)
  glow.addColorStop(0, 'rgba(140,35,54,0.55)')
  glow.addColorStop(1, 'rgba(5,5,5,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, size, size)

  // Logo
  const logo = new Image()
  logo.src = '/logo-t.png'
  await new Promise((res) => {
    logo.onload = res
    logo.onerror = res
  })
  if (logo.naturalWidth > 0) ctx.drawImage(logo, size / 2 - 70, 70, 140, 140)

  ctx.textAlign = 'center'

  // Brand line
  ctx.fillStyle = BRAND.pink
  ctx.font = '700 34px Inter'
  ctx.save()
  ctx.letterSpacing = '14px'
  ctx.fillText('TULSA TRAINING', size / 2, 280)
  ctx.restore()

  const isFinish = milestone.kind === 'finish'
  ctx.fillStyle = '#ffffff'
  ctx.font = '600 38px Inter'
  ctx.fillText(isFinish ? 'WE JUST RODE' : 'WE JUST RODE TO', size / 2, 400)

  // Milestone name — wrapped, scaled to fit
  const name = milestone.name.toUpperCase()
  const words = name.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > 14 && line) {
      lines.push(line.trim())
      line = w
    } else {
      line = (line + ' ' + w).trim()
    }
  }
  if (line) lines.push(line.trim())
  const fontSize = lines.length > 2 ? 88 : lines.length === 2 ? 108 : 124
  ctx.font = `${fontSize}px Anton`
  ctx.fillStyle = BRAND.red
  const startY = 400 + 110
  lines.forEach((l, i) => {
    ctx.fillText(l, size / 2, startY + i * (fontSize + 14))
  })

  // Distance + day
  const statsY = startY + lines.length * (fontSize + 14) + 50
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 42px Inter'
  const dayPart = day > 0 ? ` · DAY ${Math.min(day, CHALLENGE_DAYS)} OF ${CHALLENGE_DAYS}` : ''
  ctx.fillText(`${fmt(milestone.m)} METERS${dayPart}`, size / 2, statsY)

  // Bottom bar
  ctx.fillStyle = BRAND.red
  ctx.fillRect(0, size - 110, size, 110)
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 36px Inter'
  ctx.save()
  ctx.letterSpacing = '8px'
  ctx.fillText('AROUND THE WORLD · SEPTEMBER 2026', size / 2, size - 42)
  ctx.restore()

  // Download
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) return
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `tt-world-tour-${milestone.m}.png`
  a.click()
  URL.revokeObjectURL(a.href)
}
