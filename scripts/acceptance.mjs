// End-to-end acceptance check against a LIVE deployment.
//
//   node scripts/acceptance.mjs <ADMIN_KEY> <LOG_TOKEN> <TRAINER_PIN>
//
// Writes a handful of real entries and then resets, so only run it against
// a deployment nobody is mid-challenge on. Recover the keys with:
//   npx convex env get ADMIN_KEY --prod
//   npx convex env get LOG_TOKEN --prod
//   npx convex env get TRAINER_PIN --prod
//
// It checks the permission tiers actually separate, that the Assault Bike
// converts miles, that no key leaks into the shipped bundle, and that a
// burst of concurrent logs produces no write conflicts.
const CONVEX = 'https://utmost-gopher-81.convex.cloud'
const SITE = 'https://tt-cross-country.vercel.app'
const ADMIN = process.argv[2]
const LOG = process.argv[3]
const PIN = process.argv[4]

let pass = 0, fail = 0
const fails = []
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log('  \x1b[32m✓\x1b[0m ' + name) }
  else { fail++; fails.push(name); console.log('  \x1b[31m✗ ' + name + '\x1b[0m ' + detail) }
}
async function mut(path, args) {
  const r = await fetch(CONVEX + '/api/mutation', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'worldTour:' + path, args, format: 'json' }) })
  return { http: r.status, ...(await r.json()) }
}
async function qry(path, args) {
  const r = await fetch(CONVEX + '/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'worldTour:' + path, args, format: 'json' }) })
  return { http: r.status, ...(await r.json()) }
}
const ok = (r) => r.status === 'success'
const denied = (r) => r.status === 'error'

console.log('\n\x1b[1mA · PERMISSION MATRIX\x1b[0m')
check('no key cannot log', denied(await mut('logEntry', { machine: 'Row', amount: 100 })))
check('no key cannot reset', denied(await mut('resetChallenge', {})))
check('wrong key cannot log', denied(await mut('logEntry', { machine: 'Row', amount: 100, key: 'wrong' })))
check('wrong key cannot reset', denied(await mut('resetChallenge', { key: 'wrong' })))
check('LOG token CAN log', ok(await mut('logEntry', { machine: 'Row', amount: 100, key: LOG })))
check('LOG token cannot reset', denied(await mut('resetChallenge', { key: LOG })))
check('LOG token cannot simulate', denied(await mut('simulateDay', { key: LOG })))
check('LOG token cannot read itself back', denied(await qry('getLogToken', { key: LOG })))
check('LOG token is not a trainer', denied(await mut('verifyTrainer', { key: LOG })))
check('ADMIN key passes verifyTrainer', ok(await mut('verifyTrainer', { key: ADMIN })))

// The trainer PIN is short enough to brute force, so what it CANNOT do
// matters more than what it can.
check('PIN logs in as trainer', ok(await mut('verifyTrainer', { key: PIN })))
check('PIN can log meters', ok(await mut('logEntry', { machine: 'Row', amount: 500, key: PIN })))
check('PIN can read the QR token', ok(await qry('getLogToken', { key: PIN })))
check('PIN CANNOT reset the challenge', denied(await mut('resetChallenge', { key: PIN })))
check('PIN CANNOT simulate a day', denied(await mut('simulateDay', { key: PIN })))
const pinAdmin = await qry('isAdmin', { key: PIN })
check('PIN does not report as admin', ok(pinAdmin) && pinAdmin.value === false)
const keyAdmin = await qry('isAdmin', { key: ADMIN })
check('ADMIN key reports as admin', ok(keyAdmin) && keyAdmin.value === true)
check('ADMIN key CAN log', ok(await mut('logEntry', { machine: 'Ski', amount: 100, key: ADMIN })))
const tok = await qry('getLogToken', { key: ADMIN })
check('ADMIN key can read the log token', ok(tok) && tok.value === LOG)

console.log('\n\x1b[1mB · INPUT VALIDATION\x1b[0m')
check('rejects unknown machine', denied(await mut('logEntry', { machine: 'Treadmill', amount: 100, key: LOG })))
check('rejects zero', denied(await mut('logEntry', { machine: 'Row', amount: 0, key: LOG })))
check('rejects negative', denied(await mut('logEntry', { machine: 'Row', amount: -500, key: LOG })))
const over = await mut('logEntry', { machine: 'Row', amount: 70000, key: LOG })
check('rejects over-cap in METERS', denied(over) )
const overMi = await mut('logEntry', { machine: 'Assault Bike', amount: 40, key: LOG })
check('rejects over-cap in MILES', denied(overMi))

console.log('\n\x1b[1mC · UNIT CONVERSION (the silent-bug class)\x1b[0m')
const bike = await mut('logEntry', { machine: 'Assault Bike', amount: 5, key: LOG })
check('5 mi on the bike -> 8047 m', ok(bike) && bike.value.meters === 8047, JSON.stringify(bike.value))
const bike2 = await mut('logEntry', { machine: 'Assault Bike', amount: 12.4, key: LOG })
check('12.4 mi -> 19956 m', ok(bike2) && bike2.value.meters === 19956, JSON.stringify(bike2.value))
const row = await mut('logEntry', { machine: 'Row', amount: 2000, key: LOG })
check('2000 m on the rower stays 2000 m', ok(row) && row.value.meters === 2000, JSON.stringify(row.value))
const runner = await mut('logEntry', { machine: 'Assault Runner', amount: 1800, key: LOG })
check('runner reads METERS not miles', ok(runner) && runner.value.meters === 1800, JSON.stringify(runner.value))
check('journey == real (MULTIPLIER is 1)', ok(row) && row.value.journeyMeters === row.value.meters)

console.log('\n\x1b[1mD · QUERIES + SITE\x1b[0m')
const sum = await qry('getSummary', {})
check('getSummary is public', ok(sum))
check('byMachine covers all 5 machines', ok(sum) && Object.keys(sum.value.byMachine).length === 5)
const recent = await qry('getRecent', {})
check('getRecent preserves the typed unit', ok(recent) && recent.value.some((e) => e.unit === 'miles' && e.input === 5))
for (const p of ['/', '/log', '/qr']) {
  const r = await fetch(SITE + p)
  check('site serves ' + p, r.status === 200)
}
const html = await fetch(SITE).then((r) => r.text())
const js = await fetch(SITE + html.match(/\/assets\/index-[\w-]+\.js/)[0]).then((r) => r.text())
check('bundle has NO admin key', !js.includes(ADMIN))
check('bundle has NO trainer PIN', !js.includes("'" + PIN + "'") && !js.includes('"' + PIN + '"'))
check('bundle has NO log token', !js.includes(LOG))
check('bundle points at PROD convex', js.includes('utmost-gopher-81'))
check('bundle has no DEV convex', !js.includes('fine-eagle-220'))

console.log('\n\x1b[1mE · CONCURRENCY (an end-of-class burst)\x1b[0m')
const N = 30
const res = await Promise.all(Array.from({ length: N }, (_, i) =>
  mut('logEntry', { machine: 'Row', amount: 900 + i, key: LOG })))
const conflicts = res.filter((r) => JSON.stringify(r).includes('OptimisticConcurrency')).length
const succeeded = res.filter(ok).length
check(N + ' concurrent logs: zero write conflicts', conflicts === 0, 'conflicts=' + conflicts)
check(N + ' concurrent logs: ' + succeeded + '/' + N + ' landed', succeeded === N, succeeded + '/' + N)

console.log('\n\x1b[1mF · CLEANUP\x1b[0m')
const reset = await mut('resetChallenge', { key: ADMIN })
check('admin reset works', ok(reset))
const after = await qry('getSummary', {})
check('production back to zero', ok(after) && after.value.entryCount === 0, JSON.stringify(after.value?.entryCount))

console.log('\n' + '─'.repeat(52))
console.log(fail === 0
  ? '\x1b[32m\x1b[1m  ALL ' + pass + ' CHECKS PASSED\x1b[0m'
  : '\x1b[31m\x1b[1m  ' + pass + ' passed, ' + fail + ' FAILED\x1b[0m\n  ' + fails.join('\n  '))
console.log('─'.repeat(52) + '\n')
process.exit(fail === 0 ? 0 : 1)
