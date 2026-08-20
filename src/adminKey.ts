// The trainer's admin key. It gates every destructive mutation server-side and
// is deliberately NOT part of the bundle or the repo — a trainer types it once
// per device and it is cached here from then on.
const STORAGE_KEY = 'tt-admin-key'

export function getAdminKey(): string {
  return localStorage.getItem(STORAGE_KEY) ?? ''
}

export function setAdminKey(key: string) {
  localStorage.setItem(STORAGE_KEY, key)
}

export function clearAdminKey() {
  localStorage.removeItem(STORAGE_KEY)
}

// A stored key can stop working if it is rotated on the deployment. When that
// happens, drop the device back to member view rather than leaving dead buttons.
export function isAuthError(err: unknown): boolean {
  return /not authorized|ADMIN_KEY/i.test(String((err as Error)?.message ?? err))
}

// ── The member's log token ───────────────────────────────────────────────────
// Lower privilege than the admin key: it can log meters and nothing else. It
// arrives in the QR code on the machine, never in the bundle, and is kept so a
// member only has to scan once.
const LOG_TOKEN_KEY = 'tt-log-token'

export function getLogToken(): string {
  return localStorage.getItem(LOG_TOKEN_KEY) ?? ''
}

export function setLogToken(token: string) {
  localStorage.setItem(LOG_TOKEN_KEY, token)
}

// Whatever this device is allowed to log with. The gym computer has the admin
// key; a member's phone has the log token; the server accepts either.
export function getLogKey(): string {
  return getAdminKey() || getLogToken()
}
