import type { IndexType } from './index'

export interface BacktestRequest {
  start_date: string // "YYYY-MM-DD"
  end_date: string // "YYYY-MM-DD"
  initial_cash: number
  sell_threshold: number
  buy_threshold: number
  index_type: IndexType
  score_ma: number
}

export interface BacktestResult {
  summary?: {
    final_asset?: number
    buy_and_hold_asset?: number
    total_return?: number
    max_drawdown?: number
    final_value?: number
    buy_and_hold_final?: number
    total_return_pct?: number
    max_drawdown_pct?: number
    trade_count?: number
  }
  // Current API keys
  final_asset?: number
  buy_and_hold_asset?: number
  total_return?: number
  max_drawdown?: number
  // Backward-compatible legacy keys
  final_value: number
  buy_and_hold_final: number
  total_return_pct: number
  max_drawdown_pct: number
  trade_count: number
  cagr_pct?: number
  portfolio_history?: { date: string; value: number }[]
  buy_hold_history?: { date: string; value: number }[]
}
