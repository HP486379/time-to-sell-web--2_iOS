export { INDEX_LABELS } from '../../../shared/types'
export type { IndexType } from '../../../shared/types'

import { INDEX_LABELS, type IndexType } from '../../../shared/types'
import { envFlagEnabled } from '../constants/env'

const appVariant = import.meta.env.VITE_APP_VARIANT
const isIosVariant = appVariant === 'ios'

export const PAID_FEATURES_ENABLED = !isIosVariant && envFlagEnabled(import.meta.env.VITE_PAID_FEATURES_ENABLED)

export const AVAILABLE_INDEX_TYPES: readonly IndexType[] = PAID_FEATURES_ENABLED
  ? (Object.keys(INDEX_LABELS) as IndexType[])
  : ['SP500']

export function normalizeIndexTypeForPlan(indexType: IndexType): IndexType {
  return AVAILABLE_INDEX_TYPES.includes(indexType) ? indexType : 'SP500'
}

export const PRICE_TITLE_MAP: Record<IndexType, string> = {
  SP500: 'S&P500 価格トレンド',
  sp500_jpy: 'S&P500（円建て） 価格トレンド',
  TOPIX: 'TOPIX（円建て） 価格トレンド',
  NIKKEI: '日経225（円建て） 価格トレンド',
  NIFTY50: 'NIFTY50（インド株）価格トレンド',
  ORUKAN: 'オルカン（全世界株式）価格トレンド',
  orukan_jpy: 'オルカン（全世界株式・円建て）価格トレンド',
}
