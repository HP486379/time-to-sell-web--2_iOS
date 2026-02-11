import type { EvaluateRequest, EvaluateResponse } from './types/evaluate'

const defaultApiBase = 'http://localhost:8000'

const normalizeApiBase = (apiBaseUrl?: string): string => {
  if (!apiBaseUrl || apiBaseUrl.trim().length === 0) return defaultApiBase
  return apiBaseUrl.replace(/\/$/, '')
}

export async function evaluateIndex(
  payload: EvaluateRequest,
  apiBaseUrl?: string,
): Promise<EvaluateResponse> {
  const base = normalizeApiBase(apiBaseUrl)
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
