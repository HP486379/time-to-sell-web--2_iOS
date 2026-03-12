import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
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
  isIndexUnlocked,
  purchaseIndex,
  restorePurchasesSafe,
  type AppIndexType,
} from '../revenuecat'

const WEB_DASHBOARD_URL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_DASHBOARD_URL ?? 'https://time-to-sell-web-ios.vercel.app/'

const WEBVIEW_DEBUG =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_WEBVIEW_DEBUG === '1'

const ALLOWED_HOSTS = new Set(['time-to-sell-web-ios.vercel.app'])

const PURCHASE_EVENT_NAME = 'timetosell:purchase-result'
const RESTORE_EVENT_NAME = 'timetosell:restore-result'

function debugLog(...args: unknown[]) {
  if (WEBVIEW_DEBUG) console.log('[dashboard-webview]', ...args)
}

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
  const [webViewKey, setWebViewKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('通信環境を確認して再読み込みしてください。')
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null)

  const [isUnlocked, setIsUnlocked] = useState<boolean>(false)
  const [purchaseChecked, setPurchaseChecked] = useState<boolean>(false)

  const uri = useMemo(() => WEB_DASHBOARD_URL, [])

  const entitlementFlags = useMemo(() => buildEntitlementFlags(customerInfo), [customerInfo])

  const injectedBeforeContentLoad = useMemo(() => {
    const payload = JSON.stringify(entitlementFlags)
    return `
      (function () {
        console.log('[IAP] step-1 web bridge injection started');
        var flags = ${payload};
        window.__TIMETOSELL_ENTITLEMENT__ = Object.assign(window.__TIMETOSELL_ENTITLEMENT__ || {}, flags);
        Object.keys(flags).forEach(function (key) {
          window.localStorage.setItem('timetosell_entitlement_' + key, String(!!flags[key]));
        });
        window.__TIMETOSELL_NATIVE__ = window.__TIMETOSELL_NATIVE__ || {};
        window.__TIMETOSELL_NATIVE__.purchaseIndex = function(indexType) {
          console.log('[IAP] step-2 window.__TIMETOSELL_NATIVE__.purchaseIndex called', { indexType: indexType });
          if (!window.ReactNativeWebView) {
            console.warn('[IAP] step-3 ReactNativeWebView bridge missing, PURCHASE_INDEX skipped');
            return;
          }
          var message = JSON.stringify({ type: 'PURCHASE_INDEX', indexType: indexType });
          console.log('[IAP] step-3 sending PURCHASE_INDEX message', message);
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PURCHASE_INDEX', indexType: indexType }));
        };
        window.__TIMETOSELL_NATIVE__.restorePurchases = function() {
          console.log('[IAP] step-2b window.__TIMETOSELL_NATIVE__.restorePurchases called');
          if (!window.ReactNativeWebView) {
            console.warn('[IAP] step-3b ReactNativeWebView bridge missing, RESTORE_PURCHASES skipped');
            return;
          }
          var message = JSON.stringify({ type: 'RESTORE_PURCHASES' });
          console.log('[IAP] step-3b sending RESTORE_PURCHASES message', message);
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'RESTORE_PURCHASES' }));
        };
        console.log('[IAP] step-1 web bridge injection completed');
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
      iapLog('step-5', 'syncRevenueCatState started')
      const configured = await configureRevenueCat()
      if (!configured) {
        iapLog('step-5', 'configureRevenueCat failed, fallback to free entitlements')
        console.error('[dashboard-webview] RevenueCat configure failed. fallback to free entitlements')
        setCustomerInfo(null)
        injectEntitlementsToCurrentPage(buildEntitlementFlags(null))
        return
      }

      iapLog('step-5', 'configureRevenueCat succeeded')
      await getDefaultOfferingSafe()
      const info = await getCustomerInfoSafe()
      setCustomerInfo(info)
      injectEntitlementsToCurrentPage(buildEntitlementFlags(info))
    } catch (error) {
      iapError('step-5', 'syncRevenueCatState failed', error)
      console.error('[dashboard-webview] syncRevenueCatState failed', error)
      setCustomerInfo(null)
      injectEntitlementsToCurrentPage(buildEntitlementFlags(null))
    } finally {
      setPurchaseChecked(true)
    }
  }, [injectEntitlementsToCurrentPage])

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
      iapLog('step-4', 'WebView message received (raw)', rawData)
      if (!rawData) {
        iapLog('step-4', 'WebView message skipped because raw data is empty')
        return
      }

      // IAP停止点の切り分けメモ:
      // - step-2/3 が出ない: Web側から purchaseIndex 呼び出し未到達 or bridge未生成。
      // - step-4 が出ない: WebView postMessage 未送信。
      // - step-6 以降が出ない: PURCHASE_INDEX 以外のmessage/パース失敗。
      // - step-8 以降が出ない: RevenueCat設定やoffering/package解決で停止。
      const data = JSON.parse(event.nativeEvent.data ?? '{}') as { type?: string; indexType?: AppIndexType }
      if (data.type === 'PURCHASE_INDEX' && data.indexType) {
        iapLog('step-6', 'PURCHASE_INDEX received', data)
        const nextInfo = await purchaseIndex(data.indexType)
        iapLog('step-10', 'purchaseIndex resolved', { indexType: data.indexType, hasCustomerInfo: !!nextInfo })
        setCustomerInfo(nextInfo)
        const flags = buildEntitlementFlags(nextInfo)
        injectEntitlementsToCurrentPage(flags)
        const unlocked = isIndexUnlocked(data.indexType, nextInfo)
        webRef.current?.injectJavaScript(
          `window.dispatchEvent(new CustomEvent('${PURCHASE_EVENT_NAME}', { detail: ${JSON.stringify({
            ok: unlocked,
            indexType: data.indexType,
          })} })); true;`,
        )
      } else if (data.type === 'RESTORE_PURCHASES') {
        iapLog('step-6b', 'RESTORE_PURCHASES received', data)
        const nextInfo = await restorePurchasesSafe()
        setCustomerInfo(nextInfo)
        const flags = buildEntitlementFlags(nextInfo)
        injectEntitlementsToCurrentPage(flags)
        webRef.current?.injectJavaScript(
          `window.dispatchEvent(new CustomEvent('${RESTORE_EVENT_NAME}', { detail: ${JSON.stringify({ ok: true })} })); true;`,
        )
      } else {
        iapLog('step-6', 'message ignored because type/indexType did not match purchase flow', data)
      }
    } catch (error) {
      iapError('step-4', 'message handling failed', error)
      console.error('[dashboard-webview] message handling failed', error)
    }
  }, [injectEntitlementsToCurrentPage])

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
        onMessage={handleWebViewMessage}
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
})
