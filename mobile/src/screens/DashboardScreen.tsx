import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes'

const WEB_DASHBOARD_URL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_DASHBOARD_URL ?? 'https://time-to-sell-web-2.vercel.app/'

const ALLOWED_HOSTS = new Set(['time-to-sell-web-2.vercel.app'])

export function DashboardScreen() {
  const [webViewKey, setWebViewKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const uri = useMemo(() => WEB_DASHBOARD_URL, [])

  const retry = useCallback(() => {
    setHasError(false)
    setIsLoading(true)
    setWebViewKey((prev) => prev + 1)
  }, [])

  const onShouldStartLoadWithRequest = useCallback((request: ShouldStartLoadRequest) => {
    if (!request.url) return false

    try {
      const parsed = new URL(request.url)
      const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:'

      if (!isHttp) {
        Linking.openURL(request.url).catch(() => undefined)
        return false
      }

      if (ALLOWED_HOSTS.has(parsed.host)) {
        return true
      }

      Linking.openURL(request.url).catch(() => undefined)
      return false
    } catch {
      return false
    }
  }, [])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <WebView
        key={webViewKey}
        source={{ uri }}
        style={styles.webview}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        pullToRefreshEnabled
        startInLoadingState
        onLoadStart={() => {
          setHasError(false)
          setIsLoading(true)
        }}
        onLoadEnd={() => {
          setIsLoading(false)
        }}
        onError={() => {
          setHasError(true)
          setIsLoading(false)
        }}
      />

      {isLoading && !hasError && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      )}

      {hasError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>読み込みに失敗しました</Text>
          <Text style={styles.errorBody}>通信環境を確認して再読み込みしてください。</Text>
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
    backgroundColor: 'rgba(255,255,255,0.12)',
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
