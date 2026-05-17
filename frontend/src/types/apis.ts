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

export interface AccumulationBacktestRequest extends BacktestRequest {
  monthly_amount: number
  profit_take_pct: number
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
    final_equity?: number
    hold_equity?: number
    total_contributed?: number
    waiting_cash?: number
    deferred_contribution_count?: number
    reinvest_count?: number
    deferred_contribution_amount?: number
    hold_return?: number
  }
  diagnostics?: {
    sell_threshold?: number
    buy_threshold?: number
    score_samples?: {
      max_score?: number | null
      near_sell_threshold?: number
      days_score_above_sell_threshold?: number
      days_score_above_near_sell_threshold?: number
      days_score_below_buy_threshold?: number
    }
    accumulation_diagnostics?: {
      deferred_contribution_count?: number
      deferred_contribution_amount?: number
      no_trade_reason?: string
      top_score_dates?: { date: string; score: number; close: number }[]
    }
    index_specific_sell_adjustment_note?: string
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
  equity_curve?: { date: string; close: number; ma20?: number | null; ma60?: number | null; ma200?: number | null }[]
}