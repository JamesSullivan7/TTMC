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
// converts kilometers, that no key leaks into the shipped bundle, and that a
// burst of concurrent logs produces no write conflicts.
import { readdir, readFile } from 'node:fs/promises'

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
// The two above hardcode the worldTour prefix. This one takes a full path, so
// the people:* functions and the does-it-even-exist sweep can use it too.
async function call(kind, path, args) {
  const r = await fetch(CONVEX + '/api/' + kind, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, args, format: 'json' }) })
  return { http: r.status, ...(await r.json()) }
}
const ok = (r) => r.status === 'success'
const denied = (r) => r.status === 'error'
const missing = (r) => JSON.stringify(r).includes('Could not find function')

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
const overKm = await mut('logEntry', { machine: 'Assault Bike', amount: 70, key: LOG })
check('rejects over-cap in KM', denied(overKm))

console.log('\n\x1b[1mC · UNIT CONVERSION (the silent-bug class)\x1b[0m')
const bike = await mut('logEntry', { machine: 'Assault Bike', amount: 2.08, key: LOG })
check('2.08 km on the bike -> 2080 m', ok(bike) && bike.value.meters === 2080, JSON.stringify(bike.value))
const bike2 = await mut('logEntry', { machine: 'Assault Bike', amount: 12.4, key: LOG })
check('12.4 km -> 12400 m', ok(bike2) && bike2.value.meters === 12400, JSON.stringify(bike2.value))
const row = await mut('logEntry', { machine: 'Row', amount: 2000, key: LOG })
check('2000 m on the rower stays 2000 m', ok(row) && row.value.meters === 2000, JSON.stringify(row.value))
const runner = await mut('logEntry', { machine: 'Assault Runner', amount: 1800, key: LOG })
check('runner reads METERS not km', ok(runner) && runner.value.meters === 1800, JSON.stringify(runner.value))
check('journey == real (MULTIPLIER is 1)', ok(row) && row.value.journeyMeters === row.value.meters)

console.log('\n\x1b[1mD · QUERIES + SITE\x1b[0m')
const sum = await qry('getSummary', {})
check('getSummary is public', ok(sum))
check('byMachine covers all 5 machines', ok(sum) && Object.keys(sum.value.byMachine).length === 5)
const recent = await qry('getRecent', {})
check('getRecent preserves the typed unit', ok(recent) && recent.value.some((e) => e.unit === 'km' && e.input === 2.08))
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
// The original bug: logEntry read the whole entries table, so every writer held
// every row in its read set and 35 at once produced ~14% OptimisticConcurrency
// failures. The running total is computed client-side now, and the limiter is
// sharded for the same reason.
//
// This deliberately does NOT assert zero conflicts, and the version that did
// was wrong - it passed by luck. Each writer still patches one of RATE_SHARDS
// counter rows, so at 30-way concurrency two writers land on the same row
// often. That is the birthday problem, not a defect, and no sharded counter can
// promise zero. Measured over five consecutive bursts on dev: 0-1 per burst,
// around 3%, against the 14% that started all this.
//
// Rate-limited rejections are counted apart from conflicts, because those are
// the limiter working rather than the write path failing. The 60s window is
// shared across runs and resetChallenge does not clear it, so a second burst
// inside a minute is throttled and tells you nothing - the section says so
// rather than failing and sending you hunting.
const N = 30
const res = await Promise.all(Array.from({ length: N }, (_, i) =>
  mut('logEntry', { machine: 'Row', amount: 900 + i, key: LOG })))
const conflicts = res.filter((r) => JSON.stringify(r).includes('OptimisticConcurrency')).length
const throttled = res.filter((r) => JSON.stringify(r).includes('at once')).length
const succeeded = res.filter(ok).length

// Nothing may vanish: every write is a success, a throttle, or a conflict.
check('all ' + N + ' writes accounted for',
  succeeded + throttled + conflicts === N,
  succeeded + ' ok + ' + throttled + ' throttled + ' + conflicts + ' conflicts')
check('write conflicts stay rare under ' + N + '-way concurrency',
  conflicts <= 1, conflicts + '/' + N + ' - if this climbs, check logEntry is not reading the entries table again')

if (throttled > 0) {
  console.log('  \x1b[33m!\x1b[0m ' + throttled + '/' + N + ' throttled - the 60s window is still open from an'
    + ' earlier run, so "landed" below is not meaningful. Wait a minute and re-run.')
} else {
  check(N + ' concurrent logs: ' + succeeded + '/' + N + ' landed', succeeded >= N - 1, succeeded + '/' + N)
}

console.log('\n\x1b[1mG \u00b7 EVERY FUNCTION THE APP CALLS ANSWERS HERE\x1b[0m')
// The check that was missing, and the reason it has to work this way.
//
// The Convex backend and the Vercel frontend deploy by SEPARATE commands, so
// shipping a build that calls a function nobody deployed is one forgotten step
// away - and it fails at a member's phone, not at deploy time.
//
// Existence cannot be probed negatively. Over the HTTP API a missing function
// and a function that merely rejected your arguments are indistinguishable:
// both answer {"status":"error","errorMessage":"... Server Error"} with HTTP
// 200, and the "Could not find function" text appears only in the CLI. A check
// looking for that string passes against a deployment missing every function
// on this list, which is worse than having no check at all.
//
// So each one is called with arguments that MUST succeed. A success is proof
// the function is deployed and answering.
//
// The list is derived from the source; the arguments are written by hand. Add
// an api.x.y call to the app without adding a smoke for it here and this
// section fails - which is the only thing that keeps a list like this honest.
const srcDir = new URL('../src/', import.meta.url)
const srcFiles = (await readdir(srcDir)).filter((f) => /\.tsx?$/.test(f) && !f.includes('.test.'))
const referenced = new Set()
for (const f of srcFiles) {
  const text = await readFile(new URL(f, srcDir), 'utf8')
  for (const m of text.matchAll(/api\.([a-zA-Z]+)\.([a-zA-Z]+)/g)) referenced.add(m[1] + ':' + m[2])
}

// Functions with no caller in the UI, which this scan would therefore never
// see. They are reached from the CLI and from launch day instead, and one of
// them - isAdmin - is what stage 1 of the launch wizard uses to decide whether
// the gym is allowed to go live. When the testing-tools row was taken out of
// the trainer panel these three lost their only api.* reference and their
// coverage disappeared with it, silently, which is precisely the failure this
// section exists to prevent.
for (const path of ['worldTour:isAdmin', 'worldTour:simulateDay', 'worldTour:resetChallenge']) {
  referenced.add(path)
}

// A spare entry to hand to deleteEntry, so its smoke is a real round trip.
// logEntry does not return the row it inserted, so the id comes back off the
// recent list instead.
await mut('logEntry', { machine: 'Row', amount: 250, key: LOG })
const spareList = await qry('getRecent', {})
const spareId = spareList.value?.[0]?.id

const SMOKE = {
  'people:listPeople':        ['query',    {}],
  'people:peopleWithTotals':  ['query',    {}],
  // A junk id must answer null rather than throwing - see section H.
  'people:personStats':       ['query',    { id: 'smoke-probe' }],
  'people:pledge':            ['mutation', { firstName: 'Smoke', lastName: 'Probe' + Date.now(), meters: 150000 }],
  'worldTour:getSummary':     ['query',    {}],
  'worldTour:getRecent':      ['query',    {}],
  'worldTour:getDaily':       ['query',    {}],
  'worldTour:getLogToken':    ['query',    { key: PIN }],
  'worldTour:isAdmin':        ['query',    { key: ADMIN }],
  'worldTour:verifyTrainer':  ['mutation', { key: PIN }],
  'worldTour:logEntry':       ['mutation', { machine: 'Row', amount: 100, key: LOG }],
  'worldTour:deleteEntry':    ['mutation', { id: spareId, key: PIN }],
  'worldTour:simulateDay':    ['mutation', { key: ADMIN }],
  'worldTour:resetChallenge': ['mutation', { key: ADMIN }],
}

const unsmoked = [...referenced].filter((r) => !SMOKE[r])
check('every function the app calls has a smoke check', unsmoked.length === 0, unsmoked.join(', '))

const smokePeople = []
for (const path of [...referenced].sort()) {
  const entry = SMOKE[path]
  if (!entry) continue
  const [kind, args] = entry
  const r = await call(kind, path, args)
  check('answers: ' + path, ok(r), JSON.stringify(r.errorMessage ?? '').slice(0, 90))
  if (path === 'people:pledge' && r.value?.id) smokePeople.push(r.value.id)
}

// resetChallenge above cleared the entries. The people are ours to clear up,
// because reset never touches people.
for (const id of smokePeople) {
  check('smoke person removed', ok(await call('mutation', 'people:removePerson', { id, key: PIN })))
}


console.log('\n\x1b[1mH \u00b7 PLEDGING, AND READING YOUR OWN METERS BACK\x1b[0m')
check('anyone can read the roster', ok(await call('query', 'people:listPeople', {})))

const TEST_FIRST = 'Acceptance'
const TEST_LAST = 'Probe' + Date.now()
const named = { firstName: TEST_FIRST, lastName: TEST_LAST }
check('rejects a pledge under the floor',
  denied(await call('mutation', 'people:pledge', { ...named, meters: 10 })))
check('rejects a pledge over the cap',
  denied(await call('mutation', 'people:pledge', { ...named, meters: 99000000 })))

const made = await call('mutation', 'people:pledge', { ...named, meters: 150000 })
check('a pledge lands', ok(made), JSON.stringify(made.value))
const personId = made.value?.id

// Pledges go up, never down: a mistyped small number must not be able to wipe
// out a real commitment.
const lowered = await call('mutation', 'people:pledge', { ...named, meters: 1000 })
check('a lower pledge does not lower the total',
  ok(lowered) && lowered.value?.pledgeMeters === 150000, JSON.stringify(lowered.value?.pledgeMeters))

const stats = await call('query', 'people:personStats', { id: personId })
check('personStats reads that person back, with no key',
  ok(stats) && stats.value?.pledgeMeters === 150000, JSON.stringify(stats.value?.pledgeMeters))

// The white-screen regression. A stored id outlives what it points at, and a
// rejected argument is rethrown during render - a blank page on a member's
// phone with no way out of it. It has to answer null, not error.
const junk = await call('query', 'people:personStats', { id: 'not-an-id-at-all' })
check('personStats answers null for a junk id rather than erroring',
  ok(junk) && junk.value === null, JSON.stringify(junk.value ?? junk.errorMessage))

// Leave nothing behind: resetChallenge clears entries, never people.
if (personId) {
  check('test person removed again',
    ok(await call('mutation', 'people:removePerson', { id: personId, key: PIN })))
}


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
