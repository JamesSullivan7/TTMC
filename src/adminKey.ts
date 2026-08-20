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
