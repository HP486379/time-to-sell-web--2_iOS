import Constants from 'expo-constants'
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesOffering, type PurchasesPackage } from 'react-native-purchases'

const IOS_PUBLIC_SDK_KEY = Constants.expoConfig?.extra?.revenuecatPublicApiKey ?? ''
const IAP_DEBUG_ENABLED = false

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

const INDEX_TO_PRODUCT_ID = (runtimeExtra.revenuecatProductIds ?? {}) as Partial<
  Record<AppIndexType, string>
>

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
  iosPublicSdkKeySource: IOS_PUBLIC_SDK_KEY_SOURCE,
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

export function getLastPurchaseFailure(): {
  reason: PurchaseFailureReason
  message?: string
} {
  if (lastPurchaseFailureReason === 'none') return { reason: 'none' }
  return {
    reason: lastPurchaseFailureReason,
    message: PURCHASE_FAILURE_MESSAGE[lastPurchaseFailureReason],
  }
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

function debugLog(...args: unknown[]) {
  if (!IAP_DEBUG_ENABLED) return
  console.log(...args)
}

function debugWarn(...args: unknown[]) {
  if (!IAP_DEBUG_ENABLED) return
  console.warn(...args)
}

function debugError(...args: unknown[]) {
  if (!IAP_DEBUG_ENABLED) return
  console.error(...args)
}

function iapLog(step: string, message: string, payload?: unknown, debugLogger?: IapDebugLogger) {
  const text = payload === undefined ? `[IAP] ${step} ${message}` : `[IAP] ${step} ${message} ${JSON.stringify(payload)}`
  debugLog(`[IAP] ${step} ${message}`, payload ?? '')
  if (!IAP_DEBUG_ENABLED) return
  debugLogger?.(text)
}

function iapError(step: string, message: string, error: unknown, debugLogger?: IapDebugLogger) {
  const text = `[IAP] ${step} ${message} error=${formatErrorMessage(error)}`
  debugError(`[IAP] ${step} ${message}`, error)
  if (!IAP_DEBUG_ENABLED) return
  debugLogger?.(text)
}

// Keep exactly one sanitizeDebugValue helper in this module.
function sanitizeDebugValue(value: unknown, maxLength = 200): string {
  const text = value === undefined || value === null ? '' : String(value)
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

function rcDebugLog(debugLogger: IapDebugLogger | undefined, message: string, value?: unknown) {
  const safeMessage = sanitizeDebugValue(message, 80)
  const safeValue = value === undefined ? undefined : sanitizeDebugValue(value, 200)
  if (safeValue === undefined) {
    debugLog(`[RC_DEBUG] ${safeMessage}`)
    if (!IAP_DEBUG_ENABLED) return
    debugLogger?.(`RC DEBUG ${safeMessage}`)
    return
  }

  debugLog(`[RC_DEBUG] ${safeMessage}:`, safeValue)
  if (!IAP_DEBUG_ENABLED) return
  debugLogger?.(`RC DEBUG ${safeMessage}=${safeValue}`)
}

export async function configureRevenueCat(debugLogger?: IapDebugLogger): Promise<boolean> {
  debugLog('RC API KEY =', Constants.expoConfig?.extra?.revenuecatPublicApiKey)
  debugLog('[RC_DEBUG] executionEnvironment:', Constants.executionEnvironment)
  debugLog('[RC_DEBUG] isDevice:', Constants.isDevice)
  debugLog('[RC_DEBUG] __DEV__:', __DEV__)
  rcDebugLog(debugLogger, 'executionEnvironment', String(Constants.executionEnvironment ?? ''))
  rcDebugLog(debugLogger, 'isDevice', String(Constants.isDevice))
  rcDebugLog(debugLogger, '__DEV__', String(__DEV__))
  if (!Constants.executionEnvironment || Constants.executionEnvironment === 'storeClient') {
    debugWarn('[RC_DEBUG] POSSIBLE EXPO GO / PREVIEW MODE')
    rcDebugLog(debugLogger, 'warning', 'POSSIBLE EXPO GO / PREVIEW MODE')
  }
  Purchases.setLogLevel(LOG_LEVEL.DEBUG)

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
    return true
  }

  const productIdKeys = Object.keys(INDEX_TO_PRODUCT_ID)
  iapLog(
    'step-7',
    'resolved revenuecat config state',
    {
      revenuecatPublicApiKeyEmpty: !IOS_PUBLIC_SDK_KEY,
      revenuecatPublicApiKeySource: IOS_PUBLIC_SDK_KEY_SOURCE,
      revenuecatPublicApiKeyPrefix: IOS_PUBLIC_SDK_KEY ? IOS_PUBLIC_SDK_KEY.slice(0, 5) : null,
      revenuecatProductIdsEmpty: productIdKeys.length === 0,
      revenuecatProductIdKeys: productIdKeys,
      candidatePathHasValue: {
        expoConfigExtraRevenuecatPublicApiKey:
          typeof runtimeExtra.revenuecatPublicApiKey === 'string' &&
          runtimeExtra.revenuecatPublicApiKey.length > 0,
        expoConfigExtraExpoPublicRevenuecatIosApiKey:
          typeof runtimeExtra.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY === 'string' &&
          runtimeExtra.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY.length > 0,
        processEnvExpoPublicRevenuecatIosApiKey:
          typeof (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
            ?.env?.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY === 'string' &&
          ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
            ?.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.length ?? 0) > 0,
      },
    },
    debugLogger,
  )

  if (!IOS_PUBLIC_SDK_KEY) {
    iapLog('step-7', 'resolved iOS SDK key is empty', { isEmpty: true }, debugLogger)
    iapLog('step-7', 'configureRevenueCat failed because key is missing', undefined, debugLogger)
    debugError('[revenuecat] revenuecatPublicApiKey is missing in app config extra')
    return false
  }

  iapLog('step-7', 'resolved iOS SDK key state', { isEmpty: false, key: IOS_PUBLIC_SDK_KEY }, debugLogger)
  const keyPrefix = IOS_PUBLIC_SDK_KEY.slice(0, 5)
  debugLog('[revenuecat] key prefix:', keyPrefix)
  if (keyPrefix !== 'appl_') {
    debugWarn('[revenuecat] key prefix is not appl_ (please verify iOS Public SDK Key)')
  }

  try {
    iapLog('step-7', 'configureRevenueCat start', { keyPrefix, apiKey: IOS_PUBLIC_SDK_KEY }, debugLogger)
    rcDebugLog(debugLogger, 'configure', 'start')
    debugLog('[RC_DEBUG] calling Purchases.configure with key:', IOS_PUBLIC_SDK_KEY)
    await Purchases.configure({ apiKey: IOS_PUBLIC_SDK_KEY })
    debugLog('[RC_DEBUG] Purchases.configure called')
    debugLog('[RC_DEBUG] configure done')
    rcDebugLog(debugLogger, 'configure', 'done')
    debugLog('[RC_DEBUG] calling getOfferings')
    rcDebugLog(debugLogger, 'getOfferings', 'start')
    await Purchases.getOfferings()
    debugLog('[RC_DEBUG] offerings result: success')
    rcDebugLog(debugLogger, 'getOfferings', 'success')
    configured = true
    iapLog('step-7', 'configureRevenueCat success', undefined, debugLogger)
    debugLog('[revenuecat] configured successfully')
    return true
  } catch (error) {
    const errorDetails = (typeof error === 'object' && error !== null ? error : {}) as {
      code?: unknown
      domain?: unknown
      message?: unknown
    }
    rcDebugLog(debugLogger, 'getOfferings', 'failed')
    rcDebugLog(debugLogger, 'errorCode', errorDetails.code)
    rcDebugLog(debugLogger, 'errorDomain', errorDetails.domain)
    rcDebugLog(debugLogger, 'errorMessage', errorDetails.message ?? formatErrorMessage(error))
    iapError('step-7', 'configureRevenueCat failed', error, debugLogger)
    debugError('[revenuecat] configure failed', error)
    return false
  }
}

export async function getCustomerInfoSafe(debugLogger?: IapDebugLogger): Promise<CustomerInfo | null> {
  if (!configured) {
    const ok = await configureRevenueCat(debugLogger)
    if (!ok) return null
  }
  try {
    iapLog('step-11', 'getCustomerInfoSafe start', undefined, debugLogger)
    const customerInfo = await Purchases.getCustomerInfo()
    iapLog(
      'step-11',
      'getCustomerInfoSafe success',
      { activeEntitlements: Object.keys(customerInfo.entitlements.active) },
      debugLogger,
    )
    return customerInfo
  } catch (error) {
    iapError('step-11', 'getCustomerInfo failed', error, debugLogger)
    debugError('[revenuecat] getCustomerInfo failed', error)
    return null
  }
}

export async function getDefaultOfferingSafe(debugLogger?: IapDebugLogger): Promise<PurchasesOffering | null> {
  if (!configured) {
    const ok = await configureRevenueCat(debugLogger)
    if (!ok) return null
  }

  try {
    iapLog('step-8', 'getDefaultOfferingSafe start', undefined, debugLogger)
    debugLog('[RC_DEBUG] calling getOfferings')
    const offerings = await Purchases.getOfferings()
    const current = offerings.current ?? null
    const packages = current?.availablePackages ?? []

    setPurchaseTraceSnapshot({
      step: 'offering',
      offeringsStatus: current ? 'OK' : 'NULL',
      pkgCount: packages.length,
      availablePackageIdentifiers: packages.map((pkg) => pkg.identifier),
      offeringErrorCode: 'NULL',
      offeringErrorDomain: 'NULL',
      offeringErrorUserInfo: 'NULL',
      offeringErrorMessage: 'NULL',
      offeringUnderlyingErrorMessage: 'NULL',
      iosPublicSdkKeyPrefix: IOS_PUBLIC_SDK_KEY.slice(0, 5) || 'NULL',
      iosPublicSdkKeySource: IOS_PUBLIC_SDK_KEY_SOURCE,
    })

    rcDebugLog(
      debugLogger,
      'getOfferings',
      current ? `success packages=${packages.length}` : 'success current=NULL',
    )

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
    debugLog('[revenuecat] offerings fetched', { hasCurrent: !!current, count: Object.keys(offerings.all).length })
    return current
  } catch (error) {
    setLastPurchaseFailureReason('offerings_unavailable')
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
      iosPublicSdkKeySource: IOS_PUBLIC_SDK_KEY_SOURCE,
    })

    rcDebugLog(debugLogger, 'getOfferings', `failed ${formatRevenueCatErrorDetails(error)}`)
    iapError('step-8', 'getDefaultOfferingSafe failed', error, debugLogger)
    debugError('[revenuecat] getOfferings failed', error)
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
    const byProductId =
      offering.availablePackages.find((pkg) => pkg.product.identifier === targetProductId) ?? null

    iapLog(
      'step-9',
      'product id mapping lookup',
      { indexType, targetProductId, found: !!byProductId },
      debugLogger,
    )

    if (byProductId) return byProductId
  }

  const byEntitlement =
    offering.availablePackages.find(
      (pkg) => pkg.product.identifier === entitlementId || pkg.identifier === entitlementId,
    ) ?? null

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

export async function purchaseIndex(
  indexType: AppIndexType,
  debugLogger?: IapDebugLogger,
): Promise<CustomerInfo | null> {
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
    iosPublicSdkKeySource: IOS_PUBLIC_SDK_KEY_SOURCE,
  })

  const entitlementId = INDEX_TO_ENTITLEMENT[indexType]
  const expectedProductId = INDEX_TO_PRODUCT_ID[indexType]
  iapLog('step-7', 'purchase mapping summary', { requestedIndexType: indexType, mappedProductId: expectedProductId, expectedEntitlementId: entitlementId }, debugLogger)
  if (!entitlementId) {
    iapLog('step-7', 'purchase skipped because selected index is free', { indexType }, debugLogger)
    debugLog('[revenuecat] free index selected, purchase not required', { indexType })
    return getCustomerInfoSafe(debugLogger)
  }

  if (!configured) {
    const ok = await configureRevenueCat(debugLogger)
    if (!ok) return null
  }

  let latestCustomerInfo: CustomerInfo | null = null

  try {
    const offering = await getDefaultOfferingSafe(debugLogger)
    const packages = offering?.availablePackages ?? []

    iapLog(
      'step-8',
      'default offering packages for purchase flow',
      {
        indexType,
        entitlementId,
        expectedProductId,
        packagesCount: packages.length,
        packageIdentifiers: packages.map((pkg) => pkg.identifier),
        productIdentifiers: packages.map((pkg) => pkg.product.identifier),
      },
      debugLogger,
    )

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
      iapLog('step-9', 'target package not found', { indexType, entitlementId }, debugLogger)
      debugError('[revenuecat] target package not found in default offering', { indexType, entitlementId })
      return await getCustomerInfoSafe(debugLogger)
    }

    const canMakePaymentsResult = await Purchases.canMakePayments()
    iapTrace('canMakePayments checked', { canMakePaymentsResult })

    if (!canMakePaymentsResult) {
      setLastPurchaseFailureReason('store_unavailable')
      setPurchaseTraceSnapshot({
        step: 'can_make_payments',
        failureReason: 'store_unavailable',
      })
      iapTrace('store unavailable / cannot make payments', { indexType, entitlementId })
      iapError(
        'step-10',
        'purchase blocked because canMakePayments=false',
        new Error('StoreKit payments are disabled on this device/account'),
        debugLogger,
      )
      return await getCustomerInfoSafe(debugLogger)
    }
    await Purchases.purchasePackage(targetPackage)
    iapLog('step-10', 'purchasePackage resolved successfully', { indexType, entitlementId }, debugLogger)
    debugLog('[revenuecat] purchase success', { indexType, entitlementId })

    iapLog('step-11', 'getCustomerInfo started after purchase success', undefined, debugLogger)
    latestCustomerInfo = await Purchases.getCustomerInfo()
    const activeKeys = Object.keys(latestCustomerInfo.entitlements.active ?? {})
    iapLog('step-11', `PURCHASE SUCCESS product=${targetPackage.product.identifier}`, undefined, debugLogger)
    iapLog('step-11', `ACTIVE KEYS=${activeKeys.join(',')}`, undefined, debugLogger)
    iapLog('step-11', 'ACTIVE ENTITLEMENTS', latestCustomerInfo.entitlements.active, debugLogger)
    iapLog('step-11', 'UNLOCK MAP AFTER PURCHASE', buildEntitlementFlags(latestCustomerInfo), debugLogger)
    iapLog('step-11', 'post-purchase entitlement comparison', {
      requestedIndexType: indexType,
      mappedProductId: expectedProductId,
      expectedEntitlementId: entitlementId,
      activeEntitlementKeys: activeKeys,
    }, debugLogger)
  } catch (error: unknown) {
    const cancelled =
      typeof error === 'object' && error !== null && 'userCancelled' in error
        ? Boolean((error as { userCancelled?: boolean }).userCancelled)
        : false

    if (cancelled) {
      setLastPurchaseFailureReason('user_cancelled')
      setPurchaseTraceSnapshot({
        step: 'purchase_catch',
        failureReason: 'user_cancelled',
      })
      iapTrace('purchase catch classified', { reason: 'userCancelled' })
      iapLog('step-10', 'purchase cancelled by user', { indexType, entitlementId }, debugLogger)
      debugLog('[revenuecat] purchase cancelled', { indexType, entitlementId })
    } else {
      setLastPurchaseFailureReason('unknown_error')
      setPurchaseTraceSnapshot({
        step: 'purchase_catch',
        failureReason: 'unknown_error',
      })

      const rcError = error as {
        code?: unknown
        userInfo?: unknown
        underlyingErrorMessage?: unknown
      }

      iapTrace('purchase catch classified', {
        reason: 'unknown error',
        code: rcError.code,
        underlyingErrorMessage: rcError.underlyingErrorMessage,
      })
      iapError('step-10', 'purchase failed', error, debugLogger)
      debugError('[revenuecat] purchase failed', { indexType, entitlementId, error })
    }
  }

  if (latestCustomerInfo) return latestCustomerInfo
  return await getCustomerInfoSafe(debugLogger)
}

export async function restorePurchasesSafe(debugLogger?: IapDebugLogger): Promise<CustomerInfo | null> {
  if (!configured) {
    const ok = await configureRevenueCat(debugLogger)
    if (!ok) return null
  }

  try {
    await Purchases.restorePurchases()
    iapLog('step-r1', 'restore purchases success', undefined, debugLogger)
    debugLog('[revenuecat] restore purchases success')
  } catch (error) {
    iapError('step-r1', 'restore purchases failed', error, debugLogger)
    debugError('[revenuecat] restore purchases failed', error)
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
    nikkei_unlock: isIndexUnlocked('NIKKEI', customerInfo),
  }
}
