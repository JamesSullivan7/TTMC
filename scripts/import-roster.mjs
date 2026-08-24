// Seed the member roster from the gym's export.
//
//   node scripts/import-roster.mjs members.csv <ADMIN_KEY> [--prod]
//
// The point of the roster is not the board — nobody appears there until they
// pledge. It is the join form: typing "ja" suggests the Jameses and Jacksons
// from the real list, so 182 members stay 182 rows instead of quietly becoming
// 210 because people spell themselves differently on a phone.
//
// Idempotent. Re-run it after the gym updates the list and it adds the new
// people, leaving everyone else — and every pledge already made — untouched.
//
// Accepts almost anything a gym export throws out:
//   First,Last            |  Name              |  "Sullivan, James"
//   first_name,last_name  |  Full Name         |  James Sullivan
// A header row is detected and skipped. Blank lines and stray quotes are fine.

import fs from 'node:fs'

const [file, key, ...rest] = process.argv.slice(2)
const prod = rest.includes('--prod')

if (!file || !key) {
  console.error('usage: node scripts/import-roster.mjs <file.csv> <ADMIN_KEY> [--prod]')
  process.exit(1)
}

const env = fs.readFileSync('.env.local', 'utf8')
const devUrl = (env.match(/^VITE_CONVEX_URL=(.+)$/m) || [])[1]?.trim().replace(/['"]/g, '')
const prodUrl = (env.match(/^PROD_CONVEX_URL=(.+)$/m) || [])[1]?.trim().replace(/['"]/g, '')
const url = prod ? prodUrl : devUrl
if (!url) {
  console.error(prod ? 'PROD_CONVEX_URL not in .env.local' : 'VITE_CONVEX_URL not in .env.local')
  process.exit(1)
}

// Split a CSV line, respecting quoted fields — "Sullivan, James" is one cell.
function cells(line) {
  const out = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++ } else quoted = !quoted
    } else if ((c === ',' || c === '\t') && !quoted) {
      out.push(cur); cur = ''
    } else cur += c
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

function splitName(parts) {
  if (parts.length >= 2 && parts[0] && parts[1]) {
    // "Sullivan, James" lands in one cell and is Last, First.
    if (parts[0].includes(',')) {
      const [l, f] = parts[0].split(',').map((s) => s.trim())
      if (f && l) return { firstName: f, lastName: l }
    }
    return { firstName: parts[0], lastName: parts[1] }
  }
  const whole = parts.find(Boolean) || ''
  if (whole.includes(',')) {
    const [l, f] = whole.split(',').map((s) => s.trim())
    if (f && l) return { firstName: f, lastName: l }
  }
  const words = whole.split(/\s+/).filter(Boolean)
  if (words.length < 2) return null
  // Everything after the first word is the surname, so "Mary Jo Van Dyke"
  // does not lose half of itself.
  return { firstName: words[0], lastName: words.slice(1).join(' ') }
}

const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim())
const names = []
const rejected = []
lines.forEach((line, i) => {
  const parts = cells(line)
  const joined = parts.join(' ').toLowerCase()
  if (i === 0 && /first|last|name|member|email/.test(joined) && !/\d/.test(joined)) return // header
  const n = splitName(parts)
  if (n && n.firstName && n.lastName) names.push(n)
  else rejected.push(`line ${i + 1}: ${line.slice(0, 60)}`)
})

console.log(`  parsed ${names.length} names from ${file}`)
if (rejected.length) {
  console.log(`  could not read ${rejected.length} line(s):`)
  rejected.slice(0, 10).forEach((r) => console.log('    ' + r))
}
if (!names.length) process.exit(1)

console.log('  first few:', names.slice(0, 3).map((n) => `${n.firstName} ${n.lastName}`).join(', '))
console.log(`  sending to ${prod ? 'PRODUCTION' : 'dev'} — ${url}`)

const res = await fetch(url + '/api/mutation', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: 'people:importRoster', args: { key, names }, format: 'json' }),
})
const body = await res.json()
if (body.status !== 'success') {
  console.error('  failed:', body.errorMessage || JSON.stringify(body))
  process.exit(1)
}
console.log(`  added ${body.value.added}, already present ${body.value.skipped}`)
