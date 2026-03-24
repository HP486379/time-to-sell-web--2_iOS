import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import type {
  ShouldStartLoadRequest,
  WebViewErrorEvent,
  WebViewMessageEvent,
} from 'react-native-webview/lib/WebViewTypes'
import type { CustomerInfo } from 'react-native-purchases'
import {
  buildEntitlementFlags,
  configureRevenueCat,
  getCustomerInfoSafe,
  getDefaultOfferingSafe,
  getLastPurchaseFailure,
  getLastPurchaseTraceSnapshot,
  isIndexUnlocked,
  purchaseIndex,
  restorePurchasesSafe,
  type AppIndexType,
  type IapDebugLogger,
} from '../revenuecat'

const WEB_DASHBOARD_URL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_DASHBOARD_URL ?? 'https://time-to-sell-web-ios.vercel.app/'

const WEBVIEW_DEBUG = false

const IAP_DEBUG = true
const IAP_TRACE_MAX_LINES = 20

const ALLOWED_HOSTS = new Set(['time-to-sell-web-ios.vercel.app'])

const PURCHASE_EVENT_NAME = 'timetosell:purchase-result'
const RESTORE_EVENT_NAME = 'timetosell:restore-result'

function debugLog(...args: unknown[]) {
  if (WEBVIEW_DEBUG) console.log('[dashboard-webview]', ...args)
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message)
  }
  return String(error)
}

function showIapTraceFailureAlert(snapshot: {
  step: string
  failureReason: string
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
}) {
  Alert.alert(
    'IAP TRACE',
    [
      'IAP_TRACE_UI',
      `step=${snapshot.step}`,
      `reason=${snapshot.failureReason}`,
      `offerings=${snapshot.offeringsStatus}`,
      `pkgCount=${snapshot.pkgCount}`,
      `targetPkg=${snapshot.targetPackageIdentifier}`,
      `productId=${snapshot.targetProductIdentifier}`,
      `packages=${snapshot.availablePackageIdentifiers.join(',')}`,
      `error.code=${snapshot.offeringErrorCode}`,
      `error.domain=${snapshot.offeringErrorDomain}`,
      `error.userInfo=${snapshot.offeringErrorUserInfo}`,
      `error.message=${snapshot.offeringErrorMessage}`,
      `error.underlyingErrorMessage=${snapshot.offeringUnderlyingErrorMessage}`,
      `sdkKeyPrefix=${snapshot.iosPublicSdkKeyPrefix}`,
      `sdkKeySource=${snapshot.iosPublicSdkKeySource}`,
    ].join('\n'),
  )
}

function isAllowedInWebView(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol.startsWith('http') && ALLOWED_HOSTS.has(parsed.host)
  } catch {
    return false
  }
}

export function DashboardScreen() {
  const webRef = useRef<WebView>(null)
  const purchaseInProgressRef = useRef(false)
  const [webViewKey, setWebViewKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('通信環境を確認して再読み込みしてください。')
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null)

  const [isUnlocked, setIsUnlocked] = useState<boolean>(false)
  const [purchaseChecked, setPurchaseChecked] = useState<boolean>(false)
  const [iapDebugVisible, setIapDebugVisible] = useState<boolean>(IAP_DEBUG)
  const [rcDebugLines, setRcDebugLines] = useState<string[]>([])
  const [iapTraceLines, setIapTraceLines] = useState<string[]>([])

  const appendIapDebug = useCallback((line: string) => {
    if (!IAP_DEBUG) return
    const safeLine = line.length > 200 ? `${line.slice(0, 200)}…` : line
    const withTimestamp = `${new Date().toLocaleTimeString()} ${safeLine}`
    if (safeLine.includes('RC DEBUG')) {
      setRcDebugLines((prev) => [...prev, withTimestamp].slice(-IAP_TRACE_MAX_LINES))
      return
    }
    setIapTraceLines((prev) => [...prev, withTimestamp].slice(-IAP_TRACE_MAX_LINES))
  }, [])

  const iapDebugLogger: IapDebugLogger = useCallback((line: string) => {
    appendIapDebug(line)
  }, [appendIapDebug])

  const logIapError = useCallback((step: string, message: string, error: unknown) => {
    const line = `[IAP] ${step} ${message} error=${formatErrorMessage(error)}`
    appendIapDebug(line)
    if (IAP_DEBUG) console.error(`[IAP] ${step} ${message}`, error)
  }, [appendIapDebug])

  const uri = useMemo(() => WEB_DASHBOARD_URL, [])

  const entitlementFlags = useMemo(() => buildEntitlementFlags(customerInfo), [customerInfo])
  const iapDebugCount = rcDebugLines.length + iapTraceLines.length

  const injectedBeforeContentLoad = useMemo(() => {
    const payload = JSON.stringify(entitlementFlags)
    return `
      (function () {
        var IAP_DEBUG_ENABLED = ${IAP_DEBUG ? 'true' : 'false'};
        var emitIapDebug = function(step, message, payload) {
          if (!IAP_DEBUG_ENABLED || !window.ReactNativeWebView) return;
          var debugPayload = JSON.stringify({ type: 'IAP_DEBUG_LOG', step: step, message: message, payload: payload || null });
          window.ReactNativeWebView.postMessage(debugPayload);
        };
        emitIapDebug('step-1', 'web bridge injection started');
        var flags = ${payload};
        window.__TIMETOSELL_ENTITLEMENT__ = Object.assign(window.__TIMETOSELL_ENTITLEMENT__ || {}, flags);
        Object.keys(flags).forEach(function (key) {
          window.localStorage.setItem('timetosell_entitlement_' + key, String(!!flags[key]));
        });
        window.__TIMETOSELL_NATIVE__ = window.__TIMETOSELL_NATIVE__ || {};
        window.__TIMETOSELL_NATIVE__.purchaseIndex = function(indexType) {
          var tracePayload = { type: 'IAP_TRACE', stage: 'A', indexType: indexType, purchaseInProgress: !!window.__TIMETOSELL_PURCHASE_IN_PROGRESS__, targetIndexName: indexType };
          if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(tracePayload));
          emitIapDebug('step-2', 'window.__TIMETOSELL_NATIVE__.purchaseIndex called', { indexType: indexType });
          if (!window.ReactNativeWebView) {
            emitIapDebug('step-3', 'PURCHASE_INDEX skipped because ReactNativeWebView is missing');
            return;
          }
          try {
            var purchasePayload = { type: 'PURCHASE_INDEX', indexType };
            var message = JSON.stringify(purchasePayload);
            emitIapDebug('step-3', 'before PURCHASE_INDEX postMessage', purchasePayload);
            window.ReactNativeWebView.postMessage(message);
            emitIapDebug('step-3', 'after PURCHASE_INDEX postMessage', message);
          } catch (error) {
            emitIapDebug('step-3', 'PURCHASE_INDEX postMessage failed', String(error && error.message ? error.message : error));
          }
        };
        window.__TIMETOSELL_NATIVE__.restorePurchases = function() {
          emitIapDebug('step-2b', 'window.__TIMETOSELL_NATIVE__.restorePurchases called');
          if (!window.ReactNativeWebView) {
            return;
          }
          var message = JSON.stringify({ type: 'RESTORE_PURCHASES' });
          emitIapDebug('step-3b', 'sending RESTORE_PURCHASES message', message);
          window.ReactNativeWebView.postMessage(message);
        };
        emitIapDebug('step-1', 'web bridge injection completed');
      })();
      true;
    `
  }, [entitlementFlags])

  const injectEntitlementsToCurrentPage = useCallback((flags: Record<string, boolean>) => {
    const payload = JSON.stringify(flags)
    webRef.current?.injectJavaScript(`
      (function () {
        var flags = ${payload};
        window.__TIMETOSELL_ENTITLEMENT__ = Object.assign(window.__TIMETOSELL_ENTITLEMENT__ || {}, flags);
        Object.keys(flags).forEach(function (key) {
          window.localStorage.setItem('timetosell_entitlement_' + key, String(!!flags[key]));
        });
      })();
      true;
    `)
  }, [])

  const syncRevenueCatState = useCallback(async () => {
    try {
      appendIapDebug('[IAP] step-5 syncRevenueCatState started')
      await getDefaultOfferingSafe(iapDebugLogger)
      const info = await getCustomerInfoSafe(iapDebugLogger)
      setCustomerInfo(info)
      injectEntitlementsToCurrentPage(buildEntitlementFlags(info))
    } catch (error) {
      logIapError('step-5', 'syncRevenueCatState failed', error)
      if (WEBVIEW_DEBUG) console.error('[dashboard-webview] syncRevenueCatState failed', error)
      setCustomerInfo(null)
      injectEntitlementsToCurrentPage(buildEntitlementFlags(null))
    } finally {
      setPurchaseChecked(true)
    }
  }, [appendIapDebug, iapDebugLogger, injectEntitlementsToCurrentPage, logIapError])

  useEffect(() => {
    void configureRevenueCat(iapDebugLogger)
  }, [])

  useEffect(() => {
    void syncRevenueCatState()
  }, [syncRevenueCatState])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncRevenueCatState()
      }
    })
    return () => sub.remove()
  }, [syncRevenueCatState])

  const handleWebViewMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const rawData = event.nativeEvent.data ?? ''
      appendIapDebug(`[IAP] step-4 handleWebViewMessage raw=${rawData}`)
      if (!rawData) {
        appendIapDebug('[IAP] step-4 message skipped because raw data is empty')
        return
      }

      const data = JSON.parse(rawData) as { type?: string; indexType?: AppIndexType; step?: string; message?: string; payload?: unknown }

      if (data.type === 'IAP_TRACE') {
        console.log('[IAP_TRACE] webview bridge trace', data)
        return
      }

      if (data.type === 'IAP_DEBUG_LOG') {
        const suffix = data.payload === undefined || data.payload === null ? '' : ` ${JSON.stringify(data.payload)}`
        appendIapDebug(`[IAP] ${data.step ?? 'step-w'} ${data.message ?? 'web debug'}${suffix}`)
        return
      }

      if (data.type === 'PURCHASE_INDEX' && data.indexType) {
        appendIapDebug(`[IAP] step-6 PURCHASE_INDEX received indexType=${data.indexType}`)
        console.log('[IAP_TRACE] purchase button path entered', {
          stage: 'A',
          indexType: data.indexType,
          purchaseInProgress: purchaseInProgressRef.current,
          targetIndexName: data.indexType,
        })
        console.log('[IAP_TRACE] purchase request received', {
          stage: 'B',
          indexType: data.indexType,
          confirmResult: 'user_confirmed_inferred_by_PURCHASE_INDEX_message',
          earlyReturnAfterConfirm: false,
          purchaseInProgress: purchaseInProgressRef.current,
        })
        purchaseInProgressRef.current = true

        try {
          const nextInfo = await purchaseIndex(data.indexType, IAP_DEBUG ? iapDebugLogger : undefined)
          appendIapDebug(`[IAP] step-10 purchaseIndex resolved hasCustomerInfo=${String(!!nextInfo)}`)
          setCustomerInfo(nextInfo)
          const flags = buildEntitlementFlags(nextInfo)
          injectEntitlementsToCurrentPage(flags)
          const unlocked = isIndexUnlocked(data.indexType, nextInfo)
          const failure = getLastPurchaseFailure()
          const failureMessage = unlocked ? undefined : failure.message
          const traceSnapshot = getLastPurchaseTraceSnapshot()

          if (!unlocked && failure.reason !== 'none') {
            if (failure.reason === 'user_cancelled') {
              Alert.alert('IAP TRACE', 'IAP_TRACE_UI\nstep=purchase_catch\nreason=user_cancelled')
            } else {
              showIapTraceFailureAlert({
                step: traceSnapshot.step,
                failureReason: failure.reason,
                offeringsStatus: traceSnapshot.offeringsStatus,
                pkgCount: traceSnapshot.pkgCount,
                availablePackageIdentifiers: traceSnapshot.availablePackageIdentifiers,
                targetPackageIdentifier: traceSnapshot.targetPackageIdentifier,
                targetProductIdentifier: traceSnapshot.targetProductIdentifier,
                offeringErrorCode: traceSnapshot.offeringErrorCode,
                offeringErrorDomain: traceSnapshot.offeringErrorDomain,
                offeringErrorUserInfo: traceSnapshot.offeringErrorUserInfo,
                offeringErrorMessage: traceSnapshot.offeringErrorMessage,
                offeringUnderlyingErrorMessage: traceSnapshot.offeringUnderlyingErrorMessage,
                iosPublicSdkKeyPrefix: traceSnapshot.iosPublicSdkKeyPrefix,
                iosPublicSdkKeySource: traceSnapshot.iosPublicSdkKeySource,
              })
            }
          }

          webRef.current?.injectJavaScript(
            `window.dispatchEvent(new CustomEvent('${PURCHASE_EVENT_NAME}', { detail: ${JSON.stringify({
              ok: unlocked,
              indexType: data.indexType,
              failureReason: failure.reason,
              failureMessage,
            })} })); true;`,
          )
          console.log('[IAP_TRACE] purchase result dispatched', {
            stage: 'F',
            indexType: data.indexType,
            unlocked,
            failureReason: failure.reason,
            failureMessage,
          })
        } finally {
          purchaseInProgressRef.current = false
          console.log('[IAP_TRACE] purchaseInProgress released', { stage: 'H', purchaseInProgress: purchaseInProgressRef.current })
        }
      } else if (data.type === 'RESTORE_PURCHASES') {
        appendIapDebug('[IAP] step-6b RESTORE_PURCHASES received')
        const nextInfo = await restorePurchasesSafe(IAP_DEBUG ? iapDebugLogger : undefined)
        setCustomerInfo(nextInfo)
        const flags = buildEntitlementFlags(nextInfo)
        injectEntitlementsToCurrentPage(flags)
        webRef.current?.injectJavaScript(
          `window.dispatchEvent(new CustomEvent('${RESTORE_EVENT_NAME}', { detail: ${JSON.stringify({ ok: true })} })); true;`,
        )
      } else {
        appendIapDebug(`[IAP] step-6 message ignored type=${String(data.type)}`)
      }
    } catch (error) {
      logIapError('step-4', 'message handling failed', error)
      if (WEBVIEW_DEBUG) console.error('[dashboard-webview] message handling failed', error)
    }
  }, [appendIapDebug, iapDebugLogger, injectEntitlementsToCurrentPage, logIapError])

  const onWebViewMessage = useCallback((event: WebViewMessageEvent) => {
    appendIapDebug(`[IAP] step-4 onMessage received raw=${event.nativeEvent.data ?? ''}`)
    void handleWebViewMessage(event)
  }, [appendIapDebug, handleWebViewMessage])

  const retry = useCallback(() => {
    debugLog('retry', { uri })
    setHasError(false)
    setIsLoading(true)
    setErrorMessage('通信環境を確認して再読み込みしてください。')
    setWebViewKey((prev) => prev + 1)
  }, [uri])

  const handleWebViewError = useCallback((event: WebViewErrorEvent) => {
    const description = event.nativeEvent.description || 'ロードに失敗しました。'
    debugLog('onError', event.nativeEvent)
    setHasError(true)
    setIsLoading(false)
    setErrorMessage(description)
  }, [])

  const onShouldStartLoadWithRequest = useCallback((request: ShouldStartLoadRequest) => {
    if (!request.url) return false

    if (isAllowedInWebView(request.url)) {
      debugLog('allow-internal', request.url)
      return true
    }

    debugLog('open-external', request.url)
    Linking.openURL(request.url).catch((err) => debugLog('external-open-failed', { url: request.url, err }))
    return false
  }, [])

  if (!purchaseChecked) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.loadingOverlay, { position: 'relative' }]}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>課金状態を確認中...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <WebView
        ref={webRef}
        key={webViewKey}
        source={{ uri }}
        style={styles.webview}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        injectedJavaScriptBeforeContentLoaded={injectedBeforeContentLoad}
        onMessage={onWebViewMessage}
        pullToRefreshEnabled
        startInLoadingState
        allowsBackForwardNavigationGestures={Platform.OS === 'ios'}
        onLoadStart={({ nativeEvent }) => {
          debugLog('load-start', nativeEvent.url)
          setHasError(false)
          setIsLoading(true)
        }}
        onLoadEnd={({ nativeEvent }) => {
          debugLog('load-end', nativeEvent.url)
          setIsLoading(false)
        }}
        onHttpError={({ nativeEvent }) => {
          debugLog('http-error', nativeEvent)
          setHasError(true)
          setIsLoading(false)
          setErrorMessage(`HTTPエラー: ${nativeEvent.statusCode}`)
        }}
        onError={handleWebViewError}
      />

      {isLoading && !hasError && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      )}

      {hasError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>Dashboardの読み込みに失敗しました</Text>
          <Text style={styles.errorBody}>{errorMessage}</Text>
          <Pressable style={styles.retryButton} onPress={retry}>
            <Text style={styles.retryText}>再読み込み</Text>
          </Pressable>
        </View>
      )}

      {IAP_DEBUG && (
        <View style={styles.debugPanelWrapper}>
          <View style={styles.debugPanelHeader}>
            <Text style={styles.debugPanelTitle}>IAP Debug ({iapDebugCount})</Text>
            <View style={styles.debugPanelButtons}>
              <Pressable style={styles.debugButton} onPress={() => setIapDebugVisible((prev) => !prev)}>
                <Text style={styles.debugButtonText}>{iapDebugVisible ? '閉じる' : '開く'}</Text>
              </Pressable>
              <Pressable
                style={styles.debugButton}
                onPress={() => {
                  setRcDebugLines([])
                  setIapTraceLines([])
                }}
              >
                <Text style={styles.debugButtonText}>ログ消去</Text>
              </Pressable>
            </View>
          </View>
          {iapDebugVisible && (
            <ScrollView style={styles.debugPanelBody}>
              {rcDebugLines.length > 0 && (
                <>
                  <Text style={styles.debugSectionTitle}>RC DEBUG</Text>
                  {rcDebugLines.map((line, idx) => (
                    <Text key={`rc-${idx}-${line}`} style={styles.debugLine}>{line}</Text>
                  ))}
                  <Text style={styles.debugSectionTitle}>IAP TRACE</Text>
                </>
              )}
              {iapTraceLines.map((line, idx) => (
                <Text key={`${idx}-${line}`} style={styles.debugLine}>{line}</Text>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  webview: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.20)',
    gap: 8,
  },
  loadingText: { color: '#4B5563', fontSize: 13 },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  errorBody: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  retryButton: { marginTop: 8, backgroundColor: '#4F46E5', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  debugPanelWrapper: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(17,24,39,0.92)',
    borderRadius: 8,
    maxHeight: 220,
  },
  debugPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
  },
  debugPanelTitle: { color: '#F9FAFB', fontSize: 12, fontWeight: '700' },
  debugPanelButtons: { flexDirection: 'row', gap: 8 },
  debugButton: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#374151' },
  debugButtonText: { color: '#F9FAFB', fontSize: 11, fontWeight: '600' },
  debugPanelBody: { borderTopWidth: 1, borderTopColor: '#374151', paddingHorizontal: 10, paddingVertical: 8, maxHeight: 170 },
  debugSectionTitle: { color: '#FDE68A', fontSize: 11, fontWeight: '700', marginBottom: 6 },
  debugLine: { color: '#D1D5DB', fontSize: 10, marginBottom: 4 },
})
