import Constants from 'expo-constants'
import Purchases, { type CustomerInfo, type PurchasesOffering, type PurchasesPackage } from 'react-native-purchases'

const IOS_PUBLIC_SDK_KEY = Constants.expoConfig?.extra?.revenuecatPublicApiKey ?? ''

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

function iapLog(step: string, message: string, payload?: unknown) {
  if (payload === undefined) {
    console.log(`[IAP] ${step} ${message}`)
    return
  }
  console.log(`[IAP] ${step} ${message}`, payload)
}

function iapError(step: string, message: string, error: unknown) {
  console.error(`[IAP] ${step} ${message}`, error)
}

export async function configureRevenueCat(): Promise<boolean> {
  if (configured) {
    iapLog('step-7', 'configureRevenueCat skipped because already configured')
    return true
  }
  if (!IOS_PUBLIC_SDK_KEY) {
    iapLog('step-7', 'configureRevenueCat failed because key is missing')
    console.error('[revenuecat] revenuecatPublicApiKey is missing in app.json (expo.extra.revenuecatPublicApiKey)')
    return false
  }

  const keyPrefix = IOS_PUBLIC_SDK_KEY.slice(0, 5)
  console.log('[revenuecat] key prefix:', keyPrefix)
  if (keyPrefix !== 'appl_') {
    console.warn('[revenuecat] key prefix is not appl_ (please verify iOS Public SDK Key)')
  }

  try {
    iapLog('step-7', 'configureRevenueCat start', { keyPrefix })
    await Purchases.configure({ apiKey: IOS_PUBLIC_SDK_KEY })
    configured = true
    iapLog('step-7', 'configureRevenueCat success')
    console.log('[revenuecat] configured successfully')
    return true
  } catch (error) {
    iapError('step-7', 'configureRevenueCat failed', error)
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
  if (!ok) {
    iapLog('step-8', 'getDefaultOfferingSafe skipped because configureRevenueCat failed')
    return null
  }
  try {
    iapLog('step-8', 'getDefaultOfferingSafe start')
    const offerings = await Purchases.getOfferings()
    const current = offerings.current ?? null
    const packages = current?.availablePackages ?? []
    iapLog('step-8', 'getDefaultOfferingSafe result', {
      hasCurrent: !!current,
      packagesCount: packages.length,
      packageIdentifiers: packages.map((pkg) => pkg.identifier),
      productIdentifiers: packages.map((pkg) => pkg.product.identifier),
    })
    console.log('[revenuecat] offerings fetched', { hasCurrent: !!current, count: Object.keys(offerings.all).length })
    return current
  } catch (error) {
    iapError('step-8', 'getDefaultOfferingSafe failed', error)
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
  iapLog('step-7', 'purchaseIndex called', { indexType })
  iapLog('step-7', 'indexType to entitlement mapping snapshot', INDEX_TO_ENTITLEMENT)
  const entitlementId = INDEX_TO_ENTITLEMENT[indexType]
  if (!entitlementId) {
    iapLog('step-7', 'purchase skipped because selected index is free', { indexType })
    console.log('[revenuecat] free index selected, purchase not required', { indexType })
    return getCustomerInfoSafe()
  }

  const ok = await configureRevenueCat()
  if (!ok) {
    iapLog('step-7', 'purchaseIndex aborted because configureRevenueCat failed', { indexType, entitlementId })
    return null
  }

  try {
    const offering = await getDefaultOfferingSafe()
    const packages = offering?.availablePackages ?? []
    iapLog('step-8', 'default offering packages for purchase flow', {
      indexType,
      entitlementId,
      packagesCount: packages.length,
      packageIdentifiers: packages.map((pkg) => pkg.identifier),
      productIdentifiers: packages.map((pkg) => pkg.product.identifier),
    })

    const targetPackage = findPackageByEntitlement(offering, entitlementId)
    if (!targetPackage) {
      iapLog('step-9', 'target package not found', { indexType, entitlementId })
      console.error('[revenuecat] target package not found in default offering', { indexType, entitlementId })
      return await getCustomerInfoSafe()
    }

    iapLog('step-9', 'target package resolved', {
      indexType,
      entitlementId,
      packageIdentifier: targetPackage.identifier,
      productIdentifier: targetPackage.product.identifier,
    })

    iapLog('step-10', 'calling purchasePackage', {
      packageIdentifier: targetPackage.identifier,
      productIdentifier: targetPackage.product.identifier,
    })
    await Purchases.purchasePackage(targetPackage)
    iapLog('step-10', 'purchasePackage resolved successfully', { indexType, entitlementId })
    console.log('[revenuecat] purchase success', { indexType, entitlementId })
  } catch (error: unknown) {
    const cancelled = typeof error === 'object' && error !== null && 'userCancelled' in error
      ? Boolean((error as { userCancelled?: boolean }).userCancelled)
      : false
    if (cancelled) {
      iapLog('step-10', 'purchase cancelled by user', { indexType, entitlementId })
      console.log('[revenuecat] purchase cancelled', { indexType, entitlementId })
    } else {
      iapError('step-10', 'purchase failed', error)
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
