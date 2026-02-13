export { INDEX_LABELS } from '../../../shared/types'
export type { IndexType } from '../../../shared/types'

import type { IndexType } from '../../../shared/types'

export const PRICE_TITLE_MAP: Record<IndexType, string> = {
  SP500: 'S&P500 価格トレンド',
  sp500_jpy: 'S&P500（円建て） 価格トレンド',
  TOPIX: 'TOPIX（円建て） 価格トレンド',
  NIKKEI: '日経225（円建て） 価格トレンド',
  NIFTY50: 'NIFTY50（インド株）価格トレンド',
  ORUKAN: 'オルカン（全世界株式）価格トレンド',
  orukan_jpy: 'オルカン（全世界株式・円建て）価格トレンド',
}
