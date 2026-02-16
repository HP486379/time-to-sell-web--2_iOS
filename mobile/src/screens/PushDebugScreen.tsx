import { useEffect, useState } from 'react'
import { Alert, Button, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'

import { getExpoPushTokenDetailed } from '../push/getExpoPushToken'
import { BACKEND_URL, getOrCreateInstallId, registerPushToken, requestPushTest } from '../push/registerPush'

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function PushDebugScreen() {
  const [token, setToken] = useState<string | null>(null)
  const [installId, setInstallId] = useState<string | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [registerResult, setRegisterResult] = useState<string>('')
  const [testResult, setTestResult] = useState<string>('')

  const onGetToken = async () => {
    setLoading(true)
    try {
      const nextInstallId = await getOrCreateInstallId()
      setInstallId(nextInstallId)

      const result = await getExpoPushTokenDetailed()
      setToken(result.token)
      setReason(result.reason)

      if (!result.token) {
        Alert.alert('Push Token取得失敗', result.reason ?? '通知許可 or 実機か確認してください')
      }
    } finally {
      setLoading(false)
    }
  }

  const onCopyToken = async () => {
    if (!token) return
    await Clipboard.setStringAsync(token)
    Alert.alert('Push Tokenをコピーしました')
  }

  const onCopyInstallId = async () => {
    if (!installId) return
    await Clipboard.setStringAsync(installId)
    Alert.alert('install_idをコピーしました')
  }

  const onRegister = async () => {
    if (!token) {
      Alert.alert('未取得', '先にPush Tokenを取得してください')
      return
    }

    try {
      const result = await registerPushToken(token)
      setRegisterResult(formatJson(result))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setRegisterResult(message)
      Alert.alert('register失敗', message)
    }
  }

  const onTest = async () => {
    try {
      const result = await requestPushTest({
        expoPushToken: token ?? undefined,
        installId: installId ?? undefined,
      })
      setTestResult(formatJson(result))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setTestResult(message)
      Alert.alert('test失敗', message)
    }
  }

  useEffect(() => {
    onGetToken()
  }, [])

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.caption}>Backend: {BACKEND_URL}</Text>
      <Button title={loading ? '取得中...' : 'Push Tokenを取得'} onPress={onGetToken} disabled={loading} />

      <View style={styles.block}>
        <Text style={styles.label}>Expo Push Token</Text>
        <Text selectable style={styles.tokenText}>
          {token ?? '(token未取得)'}
        </Text>
        <View style={styles.buttonSpacing}>
          <Button title="Push Tokenをコピー" onPress={onCopyToken} disabled={!token} />
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>install_id</Text>
        <Text selectable style={styles.tokenText}>
          {installId ?? '(install_id未取得)'}
        </Text>
        <View style={styles.buttonSpacing}>
          <Button title="install_idをコピー" onPress={onCopyInstallId} disabled={!installId} />
        </View>
      </View>

      {reason ? (
        <View style={styles.block}>
          <Text style={styles.errorTitle}>取得できない理由</Text>
          <Text style={styles.errorText}>{reason}</Text>
        </View>
      ) : null}

      <Button title="backend register 実行" onPress={onRegister} disabled={!token} />
      <Button title="backend test 実行" onPress={onTest} disabled={!token && !installId} />

      <View style={styles.block}>
        <Text style={styles.label}>Register Response</Text>
        <Text selectable style={styles.tokenText}>{registerResult || '(未実行)'}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>Test Response</Text>
        <Text selectable style={styles.tokenText}>{testResult || '(未実行)'}</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  caption: {
    color: '#6B7280',
    fontSize: 12,
  },
  block: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  label: {
    fontWeight: '700',
    marginBottom: 8,
  },
  tokenText: {
    fontSize: 12,
  },
  errorTitle: {
    fontWeight: '700',
    color: '#B91C1C',
    marginBottom: 6,
  },
  errorText: {
    color: '#7F1D1D',
  },
  buttonSpacing: {
    marginTop: 10,
  },
})
