import axios from 'axios'

const DEFAULT_API_BASE_URL = 'https://mai-rishi-kun.onrender.com'

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

