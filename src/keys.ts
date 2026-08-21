// What this device is allowed to do, and how it proves it.
//
// Three tiers, defined server-side in convex/worldTour.ts:
//   log token   — a member's phone, from a machine QR. Log meters, nothing else.
//   trainer PIN — short, typed at the gym. Log for anyone, undo, print QRs.
//   admin key   — long and random. Reset or simulate the challenge, only.
//
// The trainer PIN is what gets cached here. The admin key deliberately is not:
// on a shared gym computer it is asked for at the moment it is needed and then
// forgotten, so walking away from an unlocked machine cannot hand someone the
// ability to wipe a month of work.

const TRAINER_KEY = 'tt-trainer-key'
const LOG_TOKEN_KEY = 'tt-log-token'

export function getTrainerKey(): string {
  return localStorage.getItem(TRAINER_KEY) ?? ''
}

export function setTrainerKey(key: string) {
  localStorage.setItem(TRAINER_KEY, key)
}

export function clearTrainerKey() {
  localStorage.removeItem(TRAINER_KEY)
}

// ── The member's log token ───────────────────────────────────────────────────
// Arrives in the QR code on the machine, never in the bundle, and is kept so a
// member only has to scan once.

export function getLogToken(): string {
  return localStorage.getItem(LOG_TOKEN_KEY) ?? ''
}

export function setLogToken(token: string) {
  localStorage.setItem(LOG_TOKEN_KEY, token)
}

// Whatever this device can log with. The gym computer has the trainer PIN; a
// member's phone has the log token; the server accepts either.
export function getLogKey(): string {
  return getTrainerKey() || getLogToken()
}

// A stored key can stop working if it is rotated on the deployment. When that
// happens, drop the device back to member view rather than leaving dead buttons.
export function isAuthError(err: unknown): boolean {
  return /not authorized|ADMIN_KEY|TRAINER_PIN/i.test(String((err as Error)?.message ?? err))
}
