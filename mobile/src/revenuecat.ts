import Constants from 'expo-constants'
import Purchases, { type CustomerInfo, type PurchasesOffering, type PurchasesPackage } from 'react-native-purchases'

const constantsWithLegacyManifest = Constants as typeof Constants & {
  manifest?: { extra?: Record<string, unknown> }
}

const runtimeExtra =
  (Constants.expoConfig?.extra as Record<string, unknown> | undefined) ??
  constantsWithLegacyManifest.manifest?.extra ??
  {}

const IOS_PUBLIC_SDK_KEY_CANDIDATES = {
  expoConfigExtra: (Constants.expoConfig?.extra as { revenuecatPublicApiKey?: unknown } | undefined)?.revenuecatPublicApiKey,
  manifestExtra: (constantsWithLegacyManifest.manifest?.extra as { revenuecatPublicApiKey?: unknown } | undefined)?.revenuecatPublicApiKey,
} as const

const IOS_PUBLIC_SDK_KEY =
  (typeof IOS_PUBLIC_SDK_KEY_CANDIDATES.expoConfigExtra === 'string' && IOS_PUBLIC_SDK_KEY_CANDIDATES.expoConfigExtra) ||
  (typeof IOS_PUBLIC_SDK_KEY_CANDIDATES.manifestExtra === 'string' && IOS_PUBLIC_SDK_KEY_CANDIDATES.manifestExtra) ||
  ''

const IOS_PUBLIC_SDK_KEY_SOURCE =
  typeof IOS_PUBLIC_SDK_KEY_CANDIDATES.expoConfigExtra === 'string' && IOS_PUBLIC_SDK_KEY_CANDIDATES.expoConfigExtra
    ? 'expoConfig.extra.revenuecatPublicApiKey'
    : typeof IOS_PUBLIC_SDK_KEY_CANDIDATES.manifestExtra === 'string' && IOS_PUBLIC_SDK_KEY_CANDIDATES.manifestExtra
      ? 'manifest.extra.revenuecatPublicApiKey'
      : 'none'

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

const INDEX_TO_PRODUCT_ID = (runtimeExtra.revenuecatProductIds ?? {}) as Partial<Record<AppIndexType, string>>

export type IapDebugLogger = (line: string) => void

let configured = false
let firstConfigureCallsite: string | null = null
let firstConfigureKeySource: string | null = null
let firstConfigureKeyPrefix: string | null = null
let firstConfigureKeySuffix: string | null = null
const REVENUECAT_CONFIGURE_CALLSITE = 'mobile/src/revenuecat.ts:configureRevenueCat'

const IAP_DEBUG_ENABLED = false

function debugConsoleLog(...args: unknown[]) {
  if (IAP_DEBUG_ENABLED) console.log(...args)
}

function debugConsoleWarn(...args: unknown[]) {
  if (IAP_DEBUG_ENABLED) console.warn(...args)
}

function debugConsoleError(...args: unknown[]) {
  if (IAP_DEBUG_ENABLED) console.error(...args)
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message)
  }
  return String(error)
}

function keyPrefix4(value: string): string {
  return value.slice(0, 4)
}

function keySuffix4(value: string): string {
  return value.slice(-4)
}

function iapLog(step: string, message: string, payload?: unknown, debugLogger?: IapDebugLogger) {
  const text = payload === undefined ? `[IAP] ${step} ${message}` : `[IAP] ${step} ${message} ${JSON.stringify(payload)}`
  debugConsoleLog(`[IAP] ${step} ${message}`, payload ?? '')
  if (IAP_DEBUG_ENABLED) debugLogger?.(text)
}

function iapError(step: string, message: string, error: unknown, debugLogger?: IapDebugLogger) {
  const text = `[IAP] ${step} ${message} error=${formatErrorMessage(error)}`
  debugConsoleError(`[IAP] ${step} ${message}`, error)
  if (IAP_DEBUG_ENABLED) debugLogger?.(text)
}

export async function configureRevenueCat(debugLogger?: IapDebugLogger): Promise<boolean> {
  if (configured) {
    iapLog(
      'step-7',
      'configureRevenueCat skipped because already configured',
      {
        firstConfigureCallsite,
        resolvedKeySource: firstConfigureKeySource,
        resolvedKeyPrefix: firstConfigureKeyPrefix,
        resolvedKeySuffix: firstConfigureKeySuffix,
        alreadyConfiguredBeforeCall: true,
      },
      debugLogger,
    )
    // RevenueCat is already initialized, so treat this path as success to keep purchase flow running.
    return true
  }

  const productIdKeys = Object.keys(INDEX_TO_PRODUCT_ID)
  iapLog('step-7', 'resolved revenuecat config state', {
    revenuecatPublicApiKeyEmpty: !IOS_PUBLIC_SDK_KEY,
    revenuecatPublicApiKeySource: IOS_PUBLIC_SDK_KEY_SOURCE,
    revenuecatPublicApiKeyPrefix: IOS_PUBLIC_SDK_KEY ? IOS_PUBLIC_SDK_KEY.slice(0, 5) : null,
    revenuecatProductIdsEmpty: productIdKeys.length === 0,
    revenuecatProductIdKeys: productIdKeys,
    candidatePathHasValue: {
      expoConfigExtra: typeof IOS_PUBLIC_SDK_KEY_CANDIDATES.expoConfigExtra === 'string' && IOS_PUBLIC_SDK_KEY_CANDIDATES.expoConfigExtra.length > 0,
      manifestExtra: typeof IOS_PUBLIC_SDK_KEY_CANDIDATES.manifestExtra === 'string' && IOS_PUBLIC_SDK_KEY_CANDIDATES.manifestExtra.length > 0,
    },
  }, debugLogger)

  iapLog(
    'step-7',
    'configureRevenueCat success/failure criteria',
    {
      successConditions: ['already configured', 'api key exists and Purchases.configure succeeds'],
      failureConditions: ['api key missing', 'Purchases.configure throws'],
    },
    debugLogger,
  )

  if (!IOS_PUBLIC_SDK_KEY) {
    iapLog('step-7', 'resolved iOS SDK key is empty', { isEmpty: true }, debugLogger)
    iapLog('step-7', 'configureRevenueCat failed because key is missing', undefined, debugLogger)
    iapLog(
      'step-7',
      'configureRevenueCat returning false',
      {
        reason: 'missing_ios_public_sdk_key',
        revenuecatPublicApiKeySource: IOS_PUBLIC_SDK_KEY_SOURCE,
        candidatePathUndefined: {
          expoConfigExtra: IOS_PUBLIC_SDK_KEY_CANDIDATES.expoConfigExtra === undefined,
          manifestExtra: IOS_PUBLIC_SDK_KEY_CANDIDATES.manifestExtra === undefined,
        },
        candidatePathType: {
          expoConfigExtra: typeof IOS_PUBLIC_SDK_KEY_CANDIDATES.expoConfigExtra,
          manifestExtra: typeof IOS_PUBLIC_SDK_KEY_CANDIDATES.manifestExtra,
        },
      },
      debugLogger,
    )
    debugConsoleError('[revenuecat] revenuecatPublicApiKey is missing in expoConfig.extra/manifest.extra')
    return false
  }

  iapLog('step-7', 'resolved iOS SDK key state', { isEmpty: false, source: IOS_PUBLIC_SDK_KEY_SOURCE }, debugLogger)
  const keyPrefix = keyPrefix4(IOS_PUBLIC_SDK_KEY)
  const keySuffix = keySuffix4(IOS_PUBLIC_SDK_KEY)
  debugConsoleLog('[revenuecat] key prefix/suffix:', { keyPrefix, keySuffix })
  if (!IOS_PUBLIC_SDK_KEY.startsWith('appl_')) {
    debugConsoleWarn('[revenuecat] key prefix is not appl_ (please verify iOS Public SDK Key)')
  }

  try {
    iapLog(
      'step-7',
      'Purchases.configure about to execute',
      {
        firstConfigureCallsite: REVENUECAT_CONFIGURE_CALLSITE,
        resolvedKeySource: IOS_PUBLIC_SDK_KEY_SOURCE,
        resolvedKeyPrefix: keyPrefix,
        resolvedKeySuffix: keySuffix,
        alreadyConfiguredBeforeCall: configured,
      },
      debugLogger,
    )
    iapLog('step-7', 'configureRevenueCat start', { keyPrefix, source: IOS_PUBLIC_SDK_KEY_SOURCE }, debugLogger)
    await Purchases.configure({ apiKey: IOS_PUBLIC_SDK_KEY })
    firstConfigureCallsite = REVENUECAT_CONFIGURE_CALLSITE
    firstConfigureKeySource = IOS_PUBLIC_SDK_KEY_SOURCE
    firstConfigureKeyPrefix = keyPrefix
    firstConfigureKeySuffix = keySuffix
    iapLog(
      'step-7',
      'configured=true will be set after successful Purchases.configure',
      {
        firstConfigureCallsite,
        resolvedKeySource: firstConfigureKeySource,
        resolvedKeyPrefix: firstConfigureKeyPrefix,
        resolvedKeySuffix: firstConfigureKeySuffix,
        alreadyConfiguredBeforeCall: false,
      },
      debugLogger,
    )
    configured = true
    iapLog('step-7', 'configureRevenueCat success', undefined, debugLogger)
    debugConsoleLog('[revenuecat] configured successfully')
    return true
  } catch (error) {
    iapError('step-7', 'configureRevenueCat failed', error, debugLogger)
    iapLog(
      'step-7',
      'configureRevenueCat returning false',
      {
        reason: 'purchases_configure_threw',
        apiKeyPrefix: keyPrefix,
        errorMessage: formatErrorMessage(error),
      },
      debugLogger,
    )
    debugConsoleError('[revenuecat] configure failed', error)
    return false
  }
}

export async function getCustomerInfoSafe(debugLogger?: IapDebugLogger): Promise<CustomerInfo | null> {
  const ok = await configureRevenueCat(debugLogger)
  if (!ok) {
    iapLog('step-11', 'getCustomerInfoSafe skipped because configureRevenueCat failed', { configureOk: ok }, debugLogger)
    return null
  }
  try {
    iapLog('step-11', 'getCustomerInfoSafe start', { configureOk: ok }, debugLogger)
    const customerInfo = await Purchases.getCustomerInfo()
    iapLog('step-11', 'getCustomerInfoSafe success', { activeEntitlements: Object.keys(customerInfo.entitlements.active) }, debugLogger)
    return customerInfo
  } catch (error) {
    iapError('step-11', 'getCustomerInfo failed', error, debugLogger)
    debugConsoleError('[revenuecat] getCustomerInfo failed', error)
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
    debugConsoleLog('[revenuecat] offerings fetched', { hasCurrent: !!current, count: Object.keys(offerings.all).length })
    return current
  } catch (error) {
    iapError('step-8', 'getDefaultOfferingSafe failed', error, debugLogger)
    debugConsoleError('[revenuecat] getOfferings failed', error)
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
    debugConsoleLog('[revenuecat] free index selected, purchase not required', { indexType })
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
      debugConsoleError('[revenuecat] target package not found in default offering', { indexType, entitlementId })
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
    debugConsoleLog('[revenuecat] purchase success', { indexType, entitlementId })
  } catch (error: unknown) {
    const cancelled = typeof error === 'object' && error !== null && 'userCancelled' in error
      ? Boolean((error as { userCancelled?: boolean }).userCancelled)
      : false
    if (cancelled) {
      iapLog('step-10', 'purchase cancelled by user', { indexType, entitlementId }, debugLogger)
      debugConsoleLog('[revenuecat] purchase cancelled', { indexType, entitlementId })
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
      debugConsoleError('[revenuecat] purchase failed', { indexType, entitlementId, error })
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
    debugConsoleLog('[revenuecat] restore purchases success')
  } catch (error) {
    iapError('step-r1', 'restore purchases failed', error, debugLogger)
    debugConsoleError('[revenuecat] restore purchases failed', error)
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
