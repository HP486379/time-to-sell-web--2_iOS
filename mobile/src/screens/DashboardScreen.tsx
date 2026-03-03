import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import type { ShouldStartLoadRequest, WebViewErrorEvent } from 'react-native-webview/lib/WebViewTypes'
import Constants from 'expo-constants'
import Purchases from 'react-native-purchases'

const WEB_DASHBOARD_URL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_DASHBOARD_URL ?? 'https://time-to-sell-web-ios.vercel.app/'

const WEBVIEW_DEBUG =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_WEBVIEW_DEBUG === '1'

const ALLOWED_HOSTS = new Set(['time-to-sell-web-ios.vercel.app'])

// RevenueCatのEntitlement ID（あなたのhookで使ってたやつ）
const ENTITLEMENT_ID = 'nikkei_unlock'

// app.json の extra から拾う（推奨）
const REVENUECAT_API_KEY =
  // @ts-ignore
  (Constants.expoConfig?.extra?.revenuecatPublicApiKey as string | undefined) ??
  // envでもOK
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_REVENUECAT_API_KEY ??
  'YOUR_REVENUECAT_PUBLIC_SDK_KEY'

function debugLog(...args: unknown[]) {
  if (WEBVIEW_DEBUG) console.log('[dashboard-webview]', ...args)
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

  // 課金状態
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false)
  const [purchaseChecked, setPurchaseChecked] = useState<boolean>(false)

  const uri = useMemo(() => WEB_DASHBOARD_URL, [])

  // RevenueCat 初期化 & entitlementチェック
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        if (!REVENUECAT_API_KEY || REVENUECAT_API_KEY === 'YOUR_REVENUECAT_PUBLIC_SDK_KEY') {
          console.warn('[RevenueCat] API key is not set. Unlock will be false.')
          if (!cancelled) {
            setIsUnlocked(false)
            setPurchaseChecked(true)
          }
          return
        }

        await Purchases.configure({ apiKey: REVENUECAT_API_KEY })

        const customerInfo = await Purchases.getCustomerInfo()
        const active = customerInfo?.entitlements?.active ?? {}
        const unlocked = Boolean(active[ENTITLEMENT_ID])

        debugLog('RevenueCat entitlement', { ENTITLEMENT_ID, unlocked })

        if (!cancelled) {
          setIsUnlocked(unlocked)
          setPurchaseChecked(true)
        }
      } catch (e) {
        console.log('[RevenueCat] error:', e)
        if (!cancelled) {
          setIsUnlocked(false)
          setPurchaseChecked(true)
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  // Webへ渡す：localStorage にフラグを書き込む（Web側が読む）
  const injectedBeforeLoad = useMemo(() => {
    const value = isUnlocked ? 'true' : 'false'
    // Web側で読むキー名（好きに変えてOK）
    return `
      (function () {
        try {
          localStorage.setItem('timetosell_entitlement_${ENTITLEMENT_ID}', '${value}');
          window.__TIMETOSELL_ENTITLEMENT__ = window.__TIMETOSELL_ENTITLEMENT__ || {};
          window.__TIMETOSELL_ENTITLEMENT__['${ENTITLEMENT_ID}'] = ${value};
        } catch (e) {}
      })();
      true;
    `
  }, [isUnlocked])

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

  // entitlementチェックが終わるまで WebView を出さない（これ大事。localStorage注入を確実にする）
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
        pullToRefreshEnabled
        startInLoadingState
        allowsBackForwardNavigationGestures={Platform.OS === 'ios'}
        injectedJavaScriptBeforeContentLoaded={injectedBeforeLoad}
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