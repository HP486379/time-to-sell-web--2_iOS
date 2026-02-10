export type IndexType =
  | 'SP500'
  | 'sp500_jpy'
  | 'TOPIX'
  | 'NIKKEI'
  | 'NIFTY50'
  | 'ORUKAN'
  | 'orukan_jpy'

export const INDEX_LABELS: Record<IndexType, string> = {
  SP500: 'S&P500',
  sp500_jpy: 'S&P500（円建て）',
  TOPIX: 'TOPIX',
  NIKKEI: '日経225',
  NIFTY50: 'NIFTY50（インド）',
  ORUKAN: 'オルカン（全世界株式）',
  orukan_jpy: 'オルカン（全世界株式・円建て）',
}

export type { EconomicEvent, EvaluateRequest, EvaluateResponse, PricePoint } from './types/evaluate'

export interface SyntheticNavResponse {
  asOf: string
  priceUsd: number
  usdJpy: number
  navJpy: number
  source: string
}

export interface FundNavResponse {
  asOf: string
  navJpy: number
  source: string
}
