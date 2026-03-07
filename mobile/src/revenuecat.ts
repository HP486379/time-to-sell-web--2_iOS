const IOS_PUBLIC_SDK_KEY =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_REVENUECAT_IOS_PUBLIC_SDK_KEY ?? ''

const REVENUECAT_TEMP_DISABLED = true

type ActiveEntitlements = Record<string, unknown>

export type CustomerInfo = {
  entitlements: {
    active: ActiveEntitlements
  }
}

export type AppIndexType = 'SP500' | 'sp500_jpy' | 'TOPIX' | 'NIKKEI' | 'NIFTY50' | 'ORUKAN' | 'orukan_jpy'
export type EntitlementId =
  | 'sp500_jpy'
  | 'topix'
  | 'nikkei225'
  | 'nifty50'
  | 'allcountry'
  | 'allcountry_jpy'

export const INDEX_TO_ENTITLEMENT: Record<AppIndexType, EntitlementId | null> = {
  SP500: null,
  sp500_jpy: 'sp500_jpy',
  TOPIX: 'topix',
  NIKKEI: 'nikkei225',
  NIFTY50: 'nifty50',
  ORUKAN: 'allcountry',
  orukan_jpy: 'allcountry_jpy',
}

function shouldDisableRevenueCat(): boolean {
  if (REVENUECAT_TEMP_DISABLED) return true
  if (!IOS_PUBLIC_SDK_KEY) return true
  if (IOS_PUBLIC_SDK_KEY.startsWith('test_')) return true
  return false
}

export async function configureRevenueCat(): Promise<boolean> {
  try {
    if (shouldDisableRevenueCat()) {
      console.log('[revenuecat] disabled (temp-off or sdk-key missing/test_)')
      return false
    }

    // 一時無効化期間は configure を呼ばない（クラッシュ回避優先）
    return false
  } catch (error) {
    console.error('[revenuecat] configure fail (non-blocking)', error)
    return false
  }
}

export async function getCustomerInfoSafe(): Promise<CustomerInfo | null> {
  try {
    const ok = await configureRevenueCat()
    if (!ok) return null
    return null
  } catch (error) {
    console.error('[revenuecat] getCustomerInfo fail (non-blocking)', error)
    return null
  }
}

export async function getDefaultOfferingSafe(): Promise<null> {
  try {
    const ok = await configureRevenueCat()
    if (!ok) return null
    return null
  } catch (error) {
    console.error('[revenuecat] getOfferings fail (non-blocking)', error)
    return null
  }
}

export function isIndexUnlocked(indexType: AppIndexType, customerInfo: CustomerInfo | null): boolean {
  const entitlementId = INDEX_TO_ENTITLEMENT[indexType]
  if (!entitlementId) return true
  if (!customerInfo) return false
  return !!customerInfo.entitlements.active[entitlementId]
}

export async function purchaseIndex(indexType: AppIndexType): Promise<CustomerInfo | null> {
  try {
    const ok = await configureRevenueCat()
    if (!ok) {
      console.log('[revenuecat] purchase skipped (disabled)', { indexType })
      return null
    }
    return null
  } catch (error) {
    console.error('[revenuecat] purchase failed (non-blocking)', { indexType, error })
    return null
  }
}

export async function restorePurchasesSafe(): Promise<CustomerInfo | null> {
  try {
    const ok = await configureRevenueCat()
    if (!ok) {
      console.log('[revenuecat] restore skipped (disabled)')
      return null
    }
    return null
  } catch (error) {
    console.error('[revenuecat] restore failed (non-blocking)', error)
    return null
  }
}

export function buildEntitlementFlags(customerInfo: CustomerInfo | null): Record<string, boolean> {
  return {
    sp500_jpy: isIndexUnlocked('sp500_jpy', customerInfo),
    topix: isIndexUnlocked('TOPIX', customerInfo),
    nikkei225: isIndexUnlocked('NIKKEI', customerInfo),
    nifty50: isIndexUnlocked('NIFTY50', customerInfo),
    allcountry: isIndexUnlocked('ORUKAN', customerInfo),
    allcountry_jpy: isIndexUnlocked('orukan_jpy', customerInfo),
    // backward compatibility for existing web lock logic
    nikkei_unlock: isIndexUnlocked('NIKKEI', customerInfo),
  }
}
