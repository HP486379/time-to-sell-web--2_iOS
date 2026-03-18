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

export type PurchaseFailureReason =
  | 'none'
  | 'configure_failed'
  | 'offerings_unavailable'
  | 'package_not_found'
  | 'store_unavailable'
  | 'user_cancelled'
  | 'unknown_error'

const PURCHASE_FAILURE_MESSAGE: Record<Exclude<PurchaseFailureReason, 'none'>, string> = {
  configure_failed: '購入処理でエラーが発生しました',
  offerings_unavailable: '購入商品を取得できませんでした',
  package_not_found: '購入商品を取得できませんでした',
  store_unavailable: 'App内課金を利用できません',
  user_cancelled: '購入がキャンセルされました',
  unknown_error: '購入処理でエラーが発生しました',
}

let lastPurchaseFailureReason: PurchaseFailureReason = 'none'

type PurchaseTraceSnapshot = {
  step: string
  failureReason: PurchaseFailureReason
  offeringsStatus: 'OK' | 'NULL'
  pkgCount: number
  availablePackageIdentifiers: string[]
  targetPackageIdentifier: string
  targetProductIdentifier: string
  offeringErrorCode: string
  offeringErrorDomain: string
  offeringErrorUserInfo: string
  offeringErrorMessage: string
  offeringUnderlyingErrorMessage: string
  iosPublicSdkKeyPrefix: string
  iosPublicSdkKeySource: string
}

let lastPurchaseTraceSnapshot: PurchaseTraceSnapshot = {
  step: 'init',
  failureReason: 'none',
  offeringsStatus: 'NULL',
  pkgCount: 0,
  availablePackageIdentifiers: [],
  targetPackageIdentifier: 'NULL',
  targetProductIdentifier: 'NULL',
  offeringErrorCode: 'NULL',
  offeringErrorDomain: 'NULL',
  offeringErrorUserInfo: 'NULL',
  offeringErrorMessage: 'NULL',
  offeringUnderlyingErrorMessage: 'NULL',
  iosPublicSdkKeyPrefix: IOS_PUBLIC_SDK_KEY.slice(0, 5) || 'NULL',
  iosPublicSdkKeySource: IOS_PUBLIC_SDK_KEY_SOURCE || 'none',
}

function setPurchaseTraceSnapshot(patch: Partial<PurchaseTraceSnapshot>) {
  lastPurchaseTraceSnapshot = {
    ...lastPurchaseTraceSnapshot,
    ...patch,
  }
}

export function getLastPurchaseTraceSnapshot(): PurchaseTraceSnapshot {
  return lastPurchaseTraceSnapshot
}

function setLastPurchaseFailureReason(reason: PurchaseFailureReason) {
  lastPurchaseFailureReason = reason
}

export function getLastPurchaseFailure(): { reason: PurchaseFailureReason; message?: string } {
  if (lastPurchaseFailureReason === 'none') return { reason: 'none' }
  return { reason: lastPurchaseFailureReason, message: PURCHASE_FAILURE_MESSAGE[lastPurchaseFailureReason] }
}

function iapTrace(message: string, payload?: unknown) {
  if (payload === undefined) {
    console.log(`[IAP_TRACE] ${message}`)
    return
  }
  console.log(`[IAP_TRACE] ${message}`, payload)
}

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

function stringifyUnknown(value: unknown): string {
  if (value === undefined || value === null) return 'NULL'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function getErrorField(error: unknown, key: string): unknown {
  if (typeof error === 'object' && error !== null && key in error) {
    return (error as Record<string, unknown>)[key]
  }
  return undefined
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
    setPurchaseTraceSnapshot({
      step: 'offering',
      offeringsStatus: !!current ? 'OK' : 'NULL',
      pkgCount: packages.length,
      availablePackageIdentifiers: packages.map((pkg) => pkg.identifier),
      offeringErrorCode: 'NULL',
      offeringErrorDomain: 'NULL',
      offeringErrorUserInfo: 'NULL',
      offeringErrorMessage: 'NULL',
      offeringUnderlyingErrorMessage: 'NULL',
      iosPublicSdkKeyPrefix: IOS_PUBLIC_SDK_KEY.slice(0, 5) || 'NULL',
      iosPublicSdkKeySource: IOS_PUBLIC_SDK_KEY_SOURCE || 'none',
    })
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
    setPurchaseTraceSnapshot({
      step: 'offering',
      failureReason: 'offerings_unavailable',
      offeringsStatus: 'NULL',
      pkgCount: 0,
      availablePackageIdentifiers: [],
      targetPackageIdentifier: 'NULL',
      targetProductIdentifier: 'NULL',
      offeringErrorCode: stringifyUnknown(getErrorField(error, 'code')),
      offeringErrorDomain: stringifyUnknown(getErrorField(error, 'domain')),
      offeringErrorUserInfo: stringifyUnknown(getErrorField(error, 'userInfo')),
      offeringErrorMessage: formatErrorMessage(error),
      offeringUnderlyingErrorMessage: stringifyUnknown(getErrorField(error, 'underlyingErrorMessage')),
      iosPublicSdkKeyPrefix: IOS_PUBLIC_SDK_KEY.slice(0, 5) || 'NULL',
      iosPublicSdkKeySource: IOS_PUBLIC_SDK_KEY_SOURCE || 'none',
    })
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

  setLastPurchaseFailureReason('none')
  setPurchaseTraceSnapshot({
    step: 'purchase_start',
    failureReason: 'none',
    offeringsStatus: 'NULL',
    pkgCount: 0,
    availablePackageIdentifiers: [],
    targetPackageIdentifier: 'NULL',
    targetProductIdentifier: 'NULL',
    offeringErrorCode: 'NULL',
    offeringErrorDomain: 'NULL',
    offeringErrorUserInfo: 'NULL',
    offeringErrorMessage: 'NULL',
    offeringUnderlyingErrorMessage: 'NULL',
    iosPublicSdkKeyPrefix: IOS_PUBLIC_SDK_KEY.slice(0, 5) || 'NULL',
    iosPublicSdkKeySource: IOS_PUBLIC_SDK_KEY_SOURCE || 'none',
  })

  const entitlementId = INDEX_TO_ENTITLEMENT[indexType]
  if (!entitlementId) {
    iapTrace('purchase skipped for free index', { indexType })
    return getCustomerInfoSafe(debugLogger)
  }

  const expectedProductId = INDEX_TO_PRODUCT_ID[indexType] ?? null
  iapTrace('package resolution precheck', { indexType, entitlementId, expectedProductId })

  const ok = await configureRevenueCat(debugLogger)
  if (!ok) {
    setLastPurchaseFailureReason('configure_failed')
    setPurchaseTraceSnapshot({ step: 'configure', failureReason: 'configure_failed', offeringsStatus: 'NULL', pkgCount: 0 })
    iapTrace('configureRevenueCat failed before purchase', { indexType, entitlementId })
    iapLog('step-7', 'purchaseIndex aborted because configureRevenueCat failed', { indexType, entitlementId }, debugLogger)
    return null
  }

  try {
    const offering = await getDefaultOfferingSafe(debugLogger)
    const packages = offering?.availablePackages ?? []
    const packageIdentifiers = packages.map((pkg) => pkg.identifier)
    iapTrace('offering lookup result', {
      indexType,
      entitlementId,
      offeringAvailable: !!offering,
      packageIdentifiers,
      productIdentifiers: packages.map((pkg) => pkg.product.identifier),
    })
    setPurchaseTraceSnapshot({
      step: 'offering',
      offeringsStatus: offering ? 'OK' : 'NULL',
      pkgCount: packages.length,
      availablePackageIdentifiers: packageIdentifiers,
    })

    if (!offering) {
      setLastPurchaseFailureReason('offerings_unavailable')
      setPurchaseTraceSnapshot({ step: 'offering', failureReason: 'offerings_unavailable', offeringsStatus: 'NULL', pkgCount: 0 })
      iapTrace('offerings unavailable', { indexType, entitlementId })
      return await getCustomerInfoSafe(debugLogger)
    }

    const targetPackage = findPackageForIndex(offering, indexType, entitlementId, debugLogger)
    const resolvedPackageIdentifier = targetPackage?.identifier ?? 'NULL'
    const resolvedProductIdentifier = targetPackage?.product.identifier ?? 'NULL'
    iapTrace('package resolution result', {
      indexType,
      entitlementId,
      found: !!targetPackage,
      targetPackageIdentifier: resolvedPackageIdentifier,
      targetProductIdentifier: resolvedProductIdentifier,
    })
    setPurchaseTraceSnapshot({
      step: 'package_resolve',
      targetPackageIdentifier: resolvedPackageIdentifier,
      targetProductIdentifier: resolvedProductIdentifier,
    })

    if (!targetPackage) {
      setLastPurchaseFailureReason('package_not_found')
      setPurchaseTraceSnapshot({ step: 'package_resolve', failureReason: 'package_not_found', targetPackageIdentifier: 'NULL', targetProductIdentifier: 'NULL' })
      iapTrace('package not found', { indexType, entitlementId, expectedProductId })
      return await getCustomerInfoSafe(debugLogger)
    }

    const canMakePaymentsResult = await Purchases.canMakePayments()
    iapTrace('canMakePayments checked', { canMakePaymentsResult })
    if (!canMakePaymentsResult) {
      setLastPurchaseFailureReason('store_unavailable')
      setPurchaseTraceSnapshot({ step: 'can_make_payments', failureReason: 'store_unavailable' })
      iapTrace('store unavailable / cannot make payments', { indexType, entitlementId })
      iapError('step-10', 'purchase blocked because canMakePayments=false', new Error('StoreKit payments are disabled on this device/account'), debugLogger)
      return await getCustomerInfoSafe(debugLogger)
    }

    iapTrace('purchasePackage about to call', {
      packageIdentifier: targetPackage.identifier,
      productIdentifier: targetPackage.product.identifier,
      packageIsDefined: !!targetPackage,
    })
    setPurchaseTraceSnapshot({ step: 'purchase_call' })

    const result = await Purchases.purchasePackage(targetPackage)
    const info = result.customerInfo ?? null
    setLastPurchaseFailureReason('none')
    setPurchaseTraceSnapshot({ step: 'purchase_success', failureReason: 'none' })
    iapTrace('purchasePackage success', {
      hasCustomerInfo: !!info,
      activeEntitlements: info ? Object.keys(info.entitlements.active) : [],
    })
    iapLog('step-10', 'purchasePackage resolved successfully', { indexType, entitlementId }, debugLogger)
  } catch (error: unknown) {
    const cancelled = typeof error === 'object' && error !== null && 'userCancelled' in error
      ? Boolean((error as { userCancelled?: boolean }).userCancelled)
      : false

    if (cancelled) {
      setLastPurchaseFailureReason('user_cancelled')
      setPurchaseTraceSnapshot({ step: 'purchase_catch', failureReason: 'user_cancelled' })
      iapTrace('purchase catch classified', { reason: 'userCancelled' })
      iapLog('step-10', 'purchase cancelled by user', { indexType, entitlementId }, debugLogger)
    } else {
      setLastPurchaseFailureReason('unknown_error')
      setPurchaseTraceSnapshot({ step: 'purchase_catch', failureReason: 'unknown_error' })
      const rcError = error as { code?: unknown; userInfo?: unknown; underlyingErrorMessage?: unknown }
      iapTrace('purchase catch classified', {
        reason: 'unknown error',
        code: rcError?.code,
        underlyingErrorMessage: rcError?.underlyingErrorMessage,
      })
      iapError('step-10', 'purchase failed', error, debugLogger)
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
