import type { BacktestRequest, BacktestResult } from './types/apis'

const apiBase =
  import.meta.env.VITE_API_BASE ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000')

export async function runBacktest(payload: BacktestRequest): Promise<BacktestResult> {
  const res = await fetch(`${apiBase}/api/backtest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Backtest failed: ${res.status} ${text}`)
  }

  return res.json()
}
