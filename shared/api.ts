import type { EvaluateRequest, EvaluateResponse } from './types/evaluate'

const ENV_API_BASE =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_API_BASE_URL

const RENDER_API_BASE = 'https://time-to-sell-web-ios.onrender.com'

const CANDIDATE_API_BASE = ENV_API_BASE ?? RENDER_API_BASE

const isForbiddenLocalBase = (value: string): boolean => {
  const lowered = value.toLowerCase()
  return (
    lowered.includes('localhost') ||
    lowered.includes('127.0.0.1') ||
    lowered.includes('192.168.')
  )
}

if (isForbiddenLocalBase(CANDIDATE_API_BASE)) {
  throw new Error('Forbidden API base URL. localhost / 127.0.0.1 / 192.168.* は使用できません。')
}

export const API_BASE = CANDIDATE_API_BASE

export function buildUrl(path: string) {
  const base = API_BASE.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

export async function evaluateIndex(payload: EvaluateRequest): Promise<EvaluateResponse> {
  const res = await fetch(buildUrl('/api/evaluate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Evaluate failed: ${res.status} ${text}`)
  }

  return (await res.json()) as EvaluateResponse
}
