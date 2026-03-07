import axios from 'axios'

const DEFAULT_API_BASE_URL = 'https://mai-rishi-kun.onrender.com'
const USER_ID_STORAGE_KEY = 'timetosell_user_id'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  DEFAULT_API_BASE_URL

export function buildUrl(path: string): string {
  const normalizedBase = API_BASE_URL.replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
})

function createRandomUserId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `uid-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return 'server-side-user'

  const existing = window.localStorage.getItem(USER_ID_STORAGE_KEY)
  if (existing && existing.length > 0) return existing

  const generated = createRandomUserId()
  window.localStorage.setItem(USER_ID_STORAGE_KEY, generated)
  return generated
}

apiClient.interceptors.request.use((config) => {
  const userId = getOrCreateUserId()
  config.headers = config.headers ?? {}
  config.headers['X-User-Id'] = userId
  return config
})

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const userId = getOrCreateUserId()
  const headers = new Headers(init?.headers ?? {})
  headers.set('X-User-Id', userId)

  return fetch(input, {
    ...init,
    headers,
  })
}
