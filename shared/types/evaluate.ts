import type { IndexType } from '../types'

export interface EvaluateRequest {
  total_quantity: number
  avg_cost: number
  index_type: IndexType | string
  score_ma: number
  request_id?: string
}

export interface EconomicEvent {
  name: string
  importance: number
  date: string
  source?: string | null
  description?: string | null
}

export interface PricePoint {
  date: string
  close: number
  ma20: number | null
  ma60: number | null
  ma200: number | null
}

export interface PeriodBreakdown {
  scores: {
    technical: number
    macro: number
    event_adjustment: number
  }
  technical_details: {
    d: number
    T_base: number
    T_trend: number
    T_conv_adj?: number
    technical_score_raw?: number
  }
  macro_details: {
    macro_M?: number
    M?: number
    p_r?: number
    p_cpi?: number
    p_vix?: number
  }
}

export interface EvaluateResponse {
  current_price: number
  market_value: number
  unrealized_pnl: number
  status: 'ready' | 'degraded' | 'error'
  reasons: string[]
  as_of: string
  request_id: string
  used_index_type: string
  source: string
  currency: string
  unit: string
  symbol: string
  scores: {
    technical: number
    macro: number
    event_adjustment: number
    total: number
    label: string
    period_total?: number
    [key: string]: unknown
  }
  period_scores?: {
    short: number
    mid: number
    long: number
    [key: string]: number
  }
  period_meta?: {
    short_window: number
    mid_window: number
    long_window: number
    [key: string]: number
  }
  period_breakdowns?: {
    short: PeriodBreakdown
    mid: PeriodBreakdown
    long: PeriodBreakdown
    [key: string]: PeriodBreakdown
  }
  technical_details: {
    d: number
    T_base: number
    T_trend: number
    T_conv_adj?: number
    convergence?: {
      side?: 'down_convergence' | 'up_convergence' | 'neutral'
      [key: string]: unknown
    }
    multi_ma?: {
      dev10?: number | null
      dev50?: number | null
      dev200?: number | null
      level?: number
      label?: string
      text?: string
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  macro_details: {
    p_r: number
    p_cpi: number
    p_vix: number
    M: number
    [key: string]: unknown
  }
  event_details: {
    E_adj: number
    R_max: number
    effective_event: EconomicEvent | null
    events?: EconomicEvent[]
    warning?: string
    [key: string]: unknown
  }
  price_series: PricePoint[]
  [key: string]: unknown
}
