import type { EvaluateRequest, EvaluateResponse } from './types/evaluate'

const localhostApiBase = 'http://localhost:8000'

const normalizeApiBase = (apiBaseUrl?: string): string => {
  if (!apiBaseUrl || apiBaseUrl.trim().length === 0) return localhostApiBase
  return apiBaseUrl.replace(/\/$/, '')
}

const resolveDefaultApiBase = (): string => {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  return normalizeApiBase(env?.EXPO_PUBLIC_API_BASE_URL)
}

const defaultApiBase = resolveDefaultApiBase()

export async function evaluateIndex(
  payload: EvaluateRequest,
  apiBaseUrl?: string,
): Promise<EvaluateResponse> {
  const base = normalizeApiBase(apiBaseUrl ?? defaultApiBase)
  const res = await fetch(`${base}/api/evaluate`, {
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
