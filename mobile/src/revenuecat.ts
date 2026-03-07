import Purchases, { type CustomerInfo, type PurchasesOffering, type PurchasesPackage } from 'react-native-purchases'

const IOS_PUBLIC_SDK_KEY =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_REVENUECAT_IOS_PUBLIC_SDK_KEY ?? ''

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

let configured = false

export async function configureRevenueCat(): Promise<boolean> {
  if (configured) return true
  if (!IOS_PUBLIC_SDK_KEY) {
    console.error('[revenuecat] EXPO_PUBLIC_REVENUECAT_IOS_PUBLIC_SDK_KEY が未設定です')
    return false
  }

  try {
    await Purchases.configure({ apiKey: IOS_PUBLIC_SDK_KEY })
    configured = true
    console.log('[revenuecat] configured')
    return true
  } catch (error) {
    console.error('[revenuecat] configure failed', error)
    return false
  }
}

export async function getCustomerInfoSafe(): Promise<CustomerInfo | null> {
  const ok = await configureRevenueCat()
  if (!ok) return null
  try {
    return await Purchases.getCustomerInfo()
  } catch (error) {
    console.error('[revenuecat] getCustomerInfo failed', error)
    return null
  }
}

export async function getDefaultOfferingSafe(): Promise<PurchasesOffering | null> {
  const ok = await configureRevenueCat()
  if (!ok) return null
  try {
    const offerings = await Purchases.getOfferings()
    const current = offerings.current ?? null
    console.log('[revenuecat] offerings fetched', { hasCurrent: !!current, count: Object.keys(offerings.all).length })
    return current
  } catch (error) {
    console.error('[revenuecat] getOfferings failed', error)
    return null
  }
}

export function isIndexUnlocked(indexType: AppIndexType, customerInfo: CustomerInfo | null): boolean {
  const entitlementId = INDEX_TO_ENTITLEMENT[indexType]
  if (!entitlementId) return true
  if (!customerInfo) return false
  return !!customerInfo.entitlements.active[entitlementId]
}

function findPackageByEntitlement(offering: PurchasesOffering | null, entitlementId: EntitlementId): PurchasesPackage | null {
  if (!offering) return null
  return (
    offering.availablePackages.find((pkg) => pkg.product.identifier === entitlementId || pkg.identifier === entitlementId) ??
    null
  )
}

export async function purchaseIndex(indexType: AppIndexType): Promise<CustomerInfo | null> {
  const entitlementId = INDEX_TO_ENTITLEMENT[indexType]
  if (!entitlementId) {
    console.log('[revenuecat] free index selected, purchase not required', { indexType })
    return getCustomerInfoSafe()
  }

  const ok = await configureRevenueCat()
  if (!ok) return null

  try {
    const offering = await getDefaultOfferingSafe()
    const targetPackage = findPackageByEntitlement(offering, entitlementId)
    if (!targetPackage) {
      console.error('[revenuecat] target package not found in default offering', { indexType, entitlementId })
      return await getCustomerInfoSafe()
    }

    await Purchases.purchasePackage(targetPackage)
    console.log('[revenuecat] purchase success', { indexType, entitlementId })
  } catch (error: unknown) {
    const cancelled = typeof error === 'object' && error !== null && 'userCancelled' in error
      ? Boolean((error as { userCancelled?: boolean }).userCancelled)
      : false
    if (cancelled) {
      console.log('[revenuecat] purchase cancelled', { indexType, entitlementId })
    } else {
      console.error('[revenuecat] purchase failed', { indexType, entitlementId, error })
    }
  }

  return await getCustomerInfoSafe()
}

export async function restorePurchasesSafe(): Promise<CustomerInfo | null> {
  const ok = await configureRevenueCat()
  if (!ok) return null

  try {
    await Purchases.restorePurchases()
    console.log('[revenuecat] restore purchases success')
  } catch (error) {
    console.error('[revenuecat] restore purchases failed', error)
  }

  return await getCustomerInfoSafe()
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
