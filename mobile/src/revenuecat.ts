import Constants from 'expo-constants'
import Purchases, { type CustomerInfo, type PurchasesOffering, type PurchasesPackage } from 'react-native-purchases'

const IOS_PUBLIC_SDK_KEY =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? ''

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

const INDEX_TO_PRODUCT_ID = (Constants.expoConfig?.extra?.revenuecatProductIds ?? {}) as Partial<Record<AppIndexType, string>>

export type IapDebugLogger = (line: string) => void

let configured = false

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message)
  }
  return String(error)
}

function iapLog(step: string, message: string, payload?: unknown, debugLogger?: IapDebugLogger) {
  const text = payload === undefined ? `[IAP] ${step} ${message}` : `[IAP] ${step} ${message} ${JSON.stringify(payload)}`
  console.log(`[IAP] ${step} ${message}`, payload ?? '')
  debugLogger?.(text)
}

function iapError(step: string, message: string, error: unknown, debugLogger?: IapDebugLogger) {
  const text = `[IAP] ${step} ${message} error=${formatErrorMessage(error)}`
  console.error(`[IAP] ${step} ${message}`, error)
  debugLogger?.(text)
}

export async function configureRevenueCat(debugLogger?: IapDebugLogger): Promise<boolean> {
  if (configured) {
    iapLog('step-7', 'configureRevenueCat skipped because already configured', undefined, debugLogger)
    return true
  }

  const productIdKeys = Object.keys(INDEX_TO_PRODUCT_ID)
  iapLog('step-7', 'resolved revenuecat config state', {
    revenuecatPublicApiKeyEmpty: !IOS_PUBLIC_SDK_KEY,
    revenuecatProductIdsEmpty: productIdKeys.length === 0,
    revenuecatProductIdKeys: productIdKeys,
  }, debugLogger)

  if (!IOS_PUBLIC_SDK_KEY) {
    iapLog('step-7', 'resolved iOS SDK key is empty', { isEmpty: true }, debugLogger)
    iapLog('step-7', 'configureRevenueCat failed because key is missing', undefined, debugLogger)
    console.error('[revenuecat] revenuecatPublicApiKey is missing in app config extra')
    return false
  }

  iapLog('step-7', 'resolved iOS SDK key state', { isEmpty: false, key: IOS_PUBLIC_SDK_KEY }, debugLogger)
  const keyPrefix = IOS_PUBLIC_SDK_KEY.slice(0, 5)
  console.log('[revenuecat] key prefix:', keyPrefix)
  if (keyPrefix !== 'appl_') {
    console.warn('[revenuecat] key prefix is not appl_ (please verify iOS Public SDK Key)')
  }

  try {
    iapLog('step-7', 'configureRevenueCat start', { keyPrefix, apiKey: IOS_PUBLIC_SDK_KEY }, debugLogger)
    await Purchases.configure({ apiKey: IOS_PUBLIC_SDK_KEY })
    configured = true
    iapLog('step-7', 'configureRevenueCat success', undefined, debugLogger)
    console.log('[revenuecat] configured successfully')
    return true
  } catch (error) {
    iapError('step-7', 'configureRevenueCat failed', error, debugLogger)
    console.error('[revenuecat] configure failed', error)
    return false
  }
}

export async function getCustomerInfoSafe(debugLogger?: IapDebugLogger): Promise<CustomerInfo | null> {
  const ok = await configureRevenueCat(debugLogger)
  if (!ok) return null
  try {
    return await Purchases.getCustomerInfo()
  } catch (error) {
    iapError('step-11', 'getCustomerInfo failed', error, debugLogger)
    console.error('[revenuecat] getCustomerInfo failed', error)
    return null
  }
}

export async function getDefaultOfferingSafe(debugLogger?: IapDebugLogger): Promise<PurchasesOffering | null> {
  const ok = await configureRevenueCat(debugLogger)
  if (!ok) {
    iapLog('step-8', 'getDefaultOfferingSafe skipped because configureRevenueCat failed', undefined, debugLogger)
    return null
  }
  try {
    iapLog('step-8', 'getDefaultOfferingSafe start', undefined, debugLogger)
    const offerings = await Purchases.getOfferings()
    const current = offerings.current ?? null
    const packages = current?.availablePackages ?? []
    iapLog(
      'step-8',
      'getDefaultOfferingSafe result',
      {
        hasCurrent: !!current,
        packagesCount: packages.length,
        packageIdentifiers: packages.map((pkg) => pkg.identifier),
        productIdentifiers: packages.map((pkg) => pkg.product.identifier),
      },
      debugLogger,
    )
    console.log('[revenuecat] offerings fetched', { hasCurrent: !!current, count: Object.keys(offerings.all).length })
    return current
  } catch (error) {
    iapError('step-8', 'getDefaultOfferingSafe failed', error, debugLogger)
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

function findPackageForIndex(
  offering: PurchasesOffering | null,
  indexType: AppIndexType,
  entitlementId: EntitlementId,
  debugLogger?: IapDebugLogger,
): PurchasesPackage | null {
  if (!offering) return null

  const targetProductId = INDEX_TO_PRODUCT_ID[indexType]
  if (targetProductId) {
    const byProductId = offering.availablePackages.find((pkg) => pkg.product.identifier === targetProductId) ?? null
    iapLog('step-9', 'product id mapping lookup', { indexType, targetProductId, found: !!byProductId }, debugLogger)
    if (byProductId) return byProductId
  }

  const byEntitlement =
    offering.availablePackages.find((pkg) => pkg.product.identifier === entitlementId || pkg.identifier === entitlementId) ?? null
  if (byEntitlement) return byEntitlement

  if (offering.availablePackages.length === 1) {
    const fallbackPackage = offering.availablePackages[0]
    iapLog(
      'step-9',
      'fallback to single available package',
      {
        indexType,
        entitlementId,
        packageIdentifier: fallbackPackage.identifier,
        productIdentifier: fallbackPackage.product.identifier,
      },
      debugLogger,
    )
    return fallbackPackage
  }

  return null
}

export async function purchaseIndex(indexType: AppIndexType, debugLogger?: IapDebugLogger): Promise<CustomerInfo | null> {
  iapLog('step-7', 'purchaseIndex called', { indexType }, debugLogger)
  iapLog('step-7', 'indexType to entitlement mapping snapshot', INDEX_TO_ENTITLEMENT, debugLogger)
  iapLog('step-7', 'indexType to productId mapping snapshot', INDEX_TO_PRODUCT_ID, debugLogger)
  const entitlementId = INDEX_TO_ENTITLEMENT[indexType]
  if (!entitlementId) {
    iapLog('step-7', 'purchase skipped because selected index is free', { indexType }, debugLogger)
    console.log('[revenuecat] free index selected, purchase not required', { indexType })
    return getCustomerInfoSafe(debugLogger)
  }

  const ok = await configureRevenueCat(debugLogger)
  if (!ok) {
    iapLog('step-7', 'purchaseIndex aborted because configureRevenueCat failed', { indexType, entitlementId }, debugLogger)
    return null
  }

  try {
    const offering = await getDefaultOfferingSafe(debugLogger)
    const packages = offering?.availablePackages ?? []
    iapLog(
      'step-8',
      'default offering packages for purchase flow',
      {
        indexType,
        entitlementId,
        packagesCount: packages.length,
        packageIdentifiers: packages.map((pkg) => pkg.identifier),
        productIdentifiers: packages.map((pkg) => pkg.product.identifier),
      },
      debugLogger,
    )

    const targetPackage = findPackageForIndex(offering, indexType, entitlementId, debugLogger)
    if (!targetPackage) {
      iapLog('step-9', 'target package not found', { indexType, entitlementId }, debugLogger)
      console.error('[revenuecat] target package not found in default offering', { indexType, entitlementId })
      return await getCustomerInfoSafe(debugLogger)
    }

    iapLog(
      'step-9',
      'target package resolved',
      {
        indexType,
        entitlementId,
        packageIdentifier: targetPackage.identifier,
        productIdentifier: targetPackage.product.identifier,
      },
      debugLogger,
    )

    iapLog(
      'step-10',
      'calling purchasePackage',
      {
        packageIdentifier: targetPackage.identifier,
        productIdentifier: targetPackage.product.identifier,
      },
      debugLogger,
    )
    iapLog(
      'step-9',
      'target package resolved',
      {
        indexType,
        entitlementId,
        packageIdentifier: targetPackage.identifier,
        productIdentifier: targetPackage.product.identifier,
      },
      debugLogger,
    )

    iapLog(
      'step-10',
      'calling purchasePackage',
      {
        packageIdentifier: targetPackage.identifier,
        productIdentifier: targetPackage.product.identifier,
      },
      debugLogger,
    )

    const canMakePaymentsResult = await Purchases.canMakePayments()
    iapLog('step-10', 'canMakePayments result', { canMakePayments: canMakePaymentsResult }, debugLogger)
    if (!canMakePaymentsResult) {
      iapError('step-10', 'purchase blocked because canMakePayments=false', new Error('StoreKit payments are disabled on this device/account'), debugLogger)
      return await getCustomerInfoSafe(debugLogger)
    }

    iapLog(
      'step-9',
      'target package resolved',
      {
        indexType,
        entitlementId,
        packageIdentifier: targetPackage.identifier,
        productIdentifier: targetPackage.product.identifier,
      },
      debugLogger,
    )

    iapLog(
      'step-10',
      'calling purchasePackage',
      {
        packageIdentifier: targetPackage.identifier,
        productIdentifier: targetPackage.product.identifier,
      },
      debugLogger,
    )
    await Purchases.purchasePackage(targetPackage)
    iapLog('step-10', 'purchasePackage resolved successfully', { indexType, entitlementId }, debugLogger)
    console.log('[revenuecat] purchase success', { indexType, entitlementId })
  } catch (error: unknown) {
    const cancelled = typeof error === 'object' && error !== null && 'userCancelled' in error
      ? Boolean((error as { userCancelled?: boolean }).userCancelled)
      : false
    if (cancelled) {
      iapLog('step-10', 'purchase cancelled by user', { indexType, entitlementId }, debugLogger)
      console.log('[revenuecat] purchase cancelled', { indexType, entitlementId })
    } else {
      const rcError = error as { code?: unknown; userInfo?: unknown; underlyingErrorMessage?: unknown }
      iapLog('step-10', 'purchase failure details', {
        indexType,
        entitlementId,
        code: rcError?.code,
        underlyingErrorMessage: rcError?.underlyingErrorMessage,
        userInfo: rcError?.userInfo,
      }, debugLogger)
      iapError('step-10', 'purchase failed', error, debugLogger)
      console.error('[revenuecat] purchase failed', { indexType, entitlementId, error })
    }
  }

  return await getCustomerInfoSafe(debugLogger)
}

export async function restorePurchasesSafe(debugLogger?: IapDebugLogger): Promise<CustomerInfo | null> {
  const ok = await configureRevenueCat(debugLogger)
  if (!ok) return null

  try {
    await Purchases.restorePurchases()
    iapLog('step-r1', 'restore purchases success', undefined, debugLogger)
    console.log('[revenuecat] restore purchases success')
  } catch (error) {
    iapError('step-r1', 'restore purchases failed', error, debugLogger)
    console.error('[revenuecat] restore purchases failed', error)
  }

  return await getCustomerInfoSafe(debugLogger)
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
