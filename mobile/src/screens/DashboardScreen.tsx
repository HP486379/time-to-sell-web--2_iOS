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
  if (WEBVIEW_DEBUG) {
    console.log('[dashboard-webview]', ...args)
  }
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
  const [entitlementLoading, setEntitlementLoading] = useState(true)

  const uri = useMemo(() => WEB_DASHBOARD_URL, [])

  const entitlementFlags = useMemo(() => buildEntitlementFlags(customerInfo), [customerInfo])

  const injectedBeforeContentLoad = useMemo(() => {
    const payload = JSON.stringify(entitlementFlags)
    const loadingPayload = JSON.stringify(entitlementLoading)
    return `
      (function () {
        var flags = ${payload};
        var loading = ${loadingPayload};
        window.__TIMETOSELL_ENTITLEMENT__ = Object.assign(window.__TIMETOSELL_ENTITLEMENT__ || {}, flags);
        window.__TIMETOSELL_ENTITLEMENT_LOADING__ = loading;
        Object.keys(flags).forEach(function (key) {
          window.localStorage.setItem('timetosell_entitlement_' + key, String(!!flags[key]));
        });
        window.localStorage.setItem('timetosell_entitlement_loading', String(loading));
        window.__TIMETOSELL_NATIVE__ = window.__TIMETOSELL_NATIVE__ || {};
        window.__TIMETOSELL_NATIVE__.purchaseIndex = function(indexType) {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PURCHASE_INDEX', indexType: indexType }));
        };
        window.__TIMETOSELL_NATIVE__.restorePurchases = function() {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'RESTORE_PURCHASES' }));
        };
      })();
      true;
    `
  }, [entitlementFlags, entitlementLoading])

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

  const injectEntitlementLoadingToCurrentPage = useCallback((loading: boolean) => {
    webRef.current?.injectJavaScript(`
      (function () {
        window.__TIMETOSELL_ENTITLEMENT_LOADING__ = ${JSON.stringify(loading)};
        window.localStorage.setItem('timetosell_entitlement_loading', String(${JSON.stringify(loading)}));
      })();
      true;
    `)
  }, [])

  const syncRevenueCatState = useCallback(async () => {
    setEntitlementLoading(true)
    injectEntitlementLoadingToCurrentPage(true)

    try {
      const configured = await configureRevenueCat()
      if (!configured) {
        setCustomerInfo(null)
        injectEntitlementsToCurrentPage(buildEntitlementFlags(null))
        return
      }

      await getDefaultOfferingSafe()
      const info = await getCustomerInfoSafe()
      setCustomerInfo(info)
      injectEntitlementsToCurrentPage(buildEntitlementFlags(info))
    } catch (error) {
      console.error('[dashboard-webview] syncRevenueCatState failed', error)
      setCustomerInfo(null)
      injectEntitlementsToCurrentPage(buildEntitlementFlags(null))
    } finally {
      setEntitlementLoading(false)
      injectEntitlementLoadingToCurrentPage(false)
    }
  }, [injectEntitlementLoadingToCurrentPage, injectEntitlementsToCurrentPage])

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
      const data = JSON.parse(event.nativeEvent.data ?? '{}') as { type?: string; indexType?: AppIndexType }
      if (data.type === 'PURCHASE_INDEX' && data.indexType) {
        const nextInfo = await purchaseIndex(data.indexType)
        setCustomerInfo(nextInfo)
        const flags = buildEntitlementFlags(nextInfo)
        injectEntitlementsToCurrentPage(flags)
        webRef.current?.injectJavaScript(
          `window.dispatchEvent(new CustomEvent('${PURCHASE_EVENT_NAME}', { detail: ${JSON.stringify({
            ok: true,
            indexType: data.indexType,
          })} })); true;`,
        )
      } else if (data.type === 'RESTORE_PURCHASES') {
        const nextInfo = await restorePurchasesSafe()
        setCustomerInfo(nextInfo)
        const flags = buildEntitlementFlags(nextInfo)
        injectEntitlementsToCurrentPage(flags)
        webRef.current?.injectJavaScript(
          `window.dispatchEvent(new CustomEvent('${RESTORE_EVENT_NAME}', { detail: ${JSON.stringify({ ok: true })} })); true;`,
        )
      }
    } catch (error) {
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
    Linking.openURL(request.url).catch((err) => {
      debugLog('external-open-failed', { url: request.url, err })
    })
    return false
  }, [])

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
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webview: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.20)',
    gap: 8,
  },
  loadingText: {
    color: '#4B5563',
    fontSize: 13,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
})
