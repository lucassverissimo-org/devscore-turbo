import type { Credentials } from './types'

export const CONNECTION_SESSION_KEY = 'jira-timesheet.connection'

export function readConnectionSession(): Credentials | null {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem(CONNECTION_SESSION_KEY) || 'null'
    )
    if (
      saved &&
      ['cloud', 'data-center'].includes(saved.deployment) &&
      typeof saved.baseUrl === 'string' &&
      typeof saved.email === 'string' &&
      typeof saved.token === 'string' &&
      saved.baseUrl &&
      saved.token
    )
      return {
        deployment: saved.deployment,
        baseUrl: saved.baseUrl,
        email: saved.email,
        token: saved.token,
      }
  } catch {
    /* Storage can be unavailable or contain an invalid value. */
  }
  return null
}

export function saveConnectionSession(credentials: Credentials) {
  try {
    sessionStorage.setItem(CONNECTION_SESSION_KEY, JSON.stringify(credentials))
  } catch {
    /* The connection still works when browser storage is unavailable. */
  }
}

export function clearConnectionSession() {
  try {
    sessionStorage.removeItem(CONNECTION_SESSION_KEY)
  } catch {
    /* Storage can be unavailable. */
  }
}
