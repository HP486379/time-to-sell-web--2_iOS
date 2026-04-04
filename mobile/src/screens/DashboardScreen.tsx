import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
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
  syncSinglePurchaseToBackend,
  syncPurchasesToBackend,
  type AppIndexType,
} from '../revenuecat'
import { getOrCreateUserId } from '../push/registerPush'

const WEB_DASHBOARD_URL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_DASHBOARD_URL ?? 'https://time-to-sell-web-ios.vercel.app/'

const WEBVIEW_DEBUG = false

const ALLOWED_HOSTS = new Set(['time-to-sell-web-ios.vercel.app'])

const PURCHASE_EVENT_NAME = 'timetosell:purchase-result'
const RESTORE_EVENT_NAME = 'timetosell:restore-result'

function debugLog(...args: unknown[]) {
  if (__DEV__ && WEBVIEW_DEBUG) {
    console.log('[dashboard-webview]', ...args)
  }
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message)
  }
  return String(error)
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
  const latestStateAppliedAtRef = useRef<number>(0)
  const syncRequestIdRef = useRef<number>(0)
  const revenueCatReadyRef = useRef<boolean>(false)

  const [webViewKey, setWebViewKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('通信環境を確認して再読み込みしてください。')
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null)
  const [purchaseChecked, setPurchaseChecked] = useState<boolean>(false)

  const logIapError = useCallback((step: string, message: string, error: unknown) => {
    if (__DEV__) console.error(`[IAP] ${step} ${message} error=${formatErrorMessage(error)}`, error)
  }, [])

  const uri = useMemo(() => WEB_DASHBOARD_URL, [])

  const entitlementFlags = useMemo(() => buildEntitlementFlags(customerInfo), [customerInfo])
  const injectedBeforeContentLoad = useMemo(() => {
    const payload = JSON.stringify(entitlementFlags)
    return `
      (function () {
        var flags = ${payload};
        window.__TIMETOSELL_ENTITLEMENT__ = Object.assign(window.__TIMETOSELL_ENTITLEMENT__ || {}, flags);
        Object.keys(flags).forEach(function (key) {
          window.localStorage.setItem('timetosell_entitlement_' + key, String(!!flags[key]));
        });
        window.__TIMETOSELL_NATIVE__ = window.__TIMETOSELL_NATIVE__ || {};
        window.__TIMETOSELL_NATIVE__.purchaseIndex = function(indexType) {
          if (!window.ReactNativeWebView) {
            return;
          }
          try {
            var purchasePayload = { type: 'PURCHASE_INDEX', indexType };
            var message = JSON.stringify(purchasePayload);
            window.ReactNativeWebView.postMessage(message);
          } catch (error) {}
        };
        window.__TIMETOSELL_NATIVE__.restorePurchases = function() {
          if (!window.ReactNativeWebView) {
            return;
          }
          var message = JSON.stringify({ type: 'RESTORE_PURCHASES' });
          window.ReactNativeWebView.postMessage(message);
        };
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

  const applyCustomerInfoToState = useCallback(
    (info: CustomerInfo | null) => {
      setCustomerInfo(info)
      injectEntitlementsToCurrentPage(buildEntitlementFlags(info))
    },
    [injectEntitlementsToCurrentPage],
  )

  const syncRevenueCatState = useCallback(async () => {
    if (!revenueCatReadyRef.current) {
      return
    }

    const syncRequestId = ++syncRequestIdRef.current
    const syncStartedAt = Date.now()

    try {
      await getDefaultOfferingSafe()
      const info = await getCustomerInfoSafe()

      if (syncRequestId !== syncRequestIdRef.current) {
        return
      }

      if (syncStartedAt < latestStateAppliedAtRef.current) {
        return
      }

      applyCustomerInfoToState(info)
      latestStateAppliedAtRef.current = Date.now()
    } catch (error) {
      logIapError('step-5', 'syncRevenueCatState failed', error)
      if (WEBVIEW_DEBUG) console.error('[dashboard-webview] syncRevenueCatState failed', error)
      applyCustomerInfoToState(null)
    } finally {
      setPurchaseChecked(true)
    }
  }, [applyCustomerInfoToState, logIapError])

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      try {
        await configureRevenueCat()

        await new Promise((resolve) => setTimeout(resolve, 500))

        if (!isMounted) return
        revenueCatReadyRef.current = true
        await syncRevenueCatState()
      } catch (error) {
        logIapError('step-0', 'initialization failed', error)
        if (isMounted) {
          setPurchaseChecked(true)
        }
      }
    }

    void init()

    return () => {
      isMounted = false
      revenueCatReadyRef.current = false
    }
  }, [logIapError, syncRevenueCatState])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && revenueCatReadyRef.current) {
        void syncRevenueCatState()
      }
    })
    return () => sub.remove()
  }, [syncRevenueCatState])

  const handleWebViewMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      try {
        const rawData = event.nativeEvent.data ?? ''
        if (!rawData) return

        const data = JSON.parse(rawData) as {
          type?: string
          indexType?: AppIndexType
        }

        if (data.type === 'PURCHASE_INDEX' && data.indexType) {
          let unlocked = false
          try {
            const purchaseResult = await purchaseIndex(data.indexType)
            const nextInfo = purchaseResult.customerInfo
            latestStateAppliedAtRef.current = Date.now()
            applyCustomerInfoToState(nextInfo)

            await new Promise((resolve) => setTimeout(resolve, 400))
            const secondInfo = await getCustomerInfoSafe()
            latestStateAppliedAtRef.current = Date.now()
            applyCustomerInfoToState(secondInfo)

            const finalInfo = secondInfo ?? nextInfo
            unlocked = isIndexUnlocked(data.indexType, finalInfo)
            if (!purchaseResult.transactionId || !purchaseResult.productId) {
              unlocked = false
              Alert.alert('購入', '購入に失敗しました。')
            } else {
              const userId = await getOrCreateUserId()
              const synced = await syncSinglePurchaseToBackend(
                userId,
                purchaseResult.productId,
                purchaseResult.transactionId,
              )
              if (!synced) {
                unlocked = false
                Alert.alert('購入', '購入に失敗しました。')
              } else {
                Alert.alert('購入', unlocked ? '購入が完了しました。' : '購入に失敗しました。')
              }
            }
          } catch (purchaseError) {
            logIapError('step-10', 'purchase failed', purchaseError)
            Alert.alert('購入', '購入に失敗しました。')
          }

          webRef.current?.injectJavaScript(`
          window.dispatchEvent(
            new CustomEvent(${JSON.stringify(PURCHASE_EVENT_NAME)}, {
              detail: ${JSON.stringify({
                ok: unlocked,
                indexType: data.indexType,
              })}
            })
          );
          true;
        `)
        } else if (data.type === 'RESTORE_PURCHASES') {
          let restoreOk = true
          try {
            const nextInfo = await restorePurchasesSafe()
            if (!nextInfo) {
              restoreOk = false
              Alert.alert('復元失敗', '復元に失敗しました。')
            } else {
              applyCustomerInfoToState(nextInfo)
              const userId = await getOrCreateUserId()
              await syncPurchasesToBackend(nextInfo, userId)
              Alert.alert('復元完了')
            }
          } catch (restoreError) {
            restoreOk = false
            logIapError('step-6b', 'restore/sync failed', restoreError)
            Alert.alert('復元失敗', '復元に失敗しました。')
          }

          webRef.current?.injectJavaScript(`
          window.dispatchEvent(
            new CustomEvent(${JSON.stringify(RESTORE_EVENT_NAME)}, {
              detail: ${JSON.stringify({ ok: restoreOk })}
            })
          );
          true;
        `)
        }
      } catch (error) {
        logIapError('step-4', 'message handling failed', error)
        if (WEBVIEW_DEBUG) console.error('[dashboard-webview] message handling failed', error)
      }
    },
    [applyCustomerInfoToState, logIapError],
  )

  const onWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      void handleWebViewMessage(event)
    },
    [handleWebViewMessage],
  )

  const handleRestorePress = useCallback(async () => {
    try {
      const userId = await getOrCreateUserId()
      const info = await restorePurchasesSafe()
      if (!info) {
        Alert.alert('復元失敗', '復元に失敗しました。')
        return
      }

      applyCustomerInfoToState(info)
      await syncPurchasesToBackend(info, userId)
      Alert.alert('復元完了')
    } catch (e) {
      Alert.alert('復元失敗', '復元に失敗しました。')
      if (__DEV__) {
        console.error('[IAP] restore error', e)
      }
    }
  }, [applyCustomerInfoToState])

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
    Linking.openURL(request.url).catch((err) =>
      debugLog('external-open-failed', { url: request.url, err }),
    )
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

      <View style={styles.purchaseActionArea}>
        <Pressable style={styles.restoreButton} onPress={handleRestorePress}>
          <Text style={styles.restoreButtonText}>購入の復元</Text>
        </Pressable>
      </View>
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
  retryButton: {
    marginTop: 8,
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  purchaseActionArea: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  restoreButton: {
    alignSelf: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  restoreButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
})
