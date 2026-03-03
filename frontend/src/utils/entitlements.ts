import type { IndexType } from '../types/index'

const NIKKEI_UNLOCK_ENTITLEMENT_KEY = 'nikkei_unlock'
const NIKKEI_UNLOCK_LOCAL_STORAGE_KEY = 'timetosell_entitlement_nikkei_unlock'

const LOCKED_INDEX_TYPES: readonly IndexType[] = ['TOPIX', 'NIKKEI']

type EntitlementWindow = Window & {
  __TIMETOSELL_ENTITLEMENT__?: Record<string, boolean | undefined>
}

function readNikkeiUnlockFromWindow(): boolean | null {
  if (typeof window === 'undefined') return null
  const flag = (window as EntitlementWindow).__TIMETOSELL_ENTITLEMENT__?.[NIKKEI_UNLOCK_ENTITLEMENT_KEY]
  return typeof flag === 'boolean' ? flag : null
}

function readNikkeiUnlockFromLocalStorage(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(NIKKEI_UNLOCK_LOCAL_STORAGE_KEY) === 'true'
}

export function isNikkeiUnlocked(): boolean {
  const windowFlag = readNikkeiUnlockFromWindow()
  if (windowFlag !== null) return windowFlag
  return readNikkeiUnlockFromLocalStorage()
}

export function isIndexLocked(indexType: IndexType, nikkeiUnlocked: boolean): boolean {
  if (!LOCKED_INDEX_TYPES.includes(indexType)) return false
  return !nikkeiUnlocked
}

export const PURCHASE_NOTICE_MESSAGE =
  'TOPIX/日経225の利用にはアプリ内課金が必要です。購入後はアプリを再起動/再読み込みしてください。'
