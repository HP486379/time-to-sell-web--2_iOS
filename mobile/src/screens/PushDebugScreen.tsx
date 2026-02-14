import { useEffect, useState } from 'react'
import { Alert, Button, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'

import { getExpoPushTokenDetailed } from '../push/getExpoPushToken'

export function PushDebugScreen() {
  const [token, setToken] = useState<string | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onGetToken = async () => {
    setLoading(true)
    try {
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

  const onCopy = async () => {
    if (!token) return
    await Clipboard.setStringAsync(token)
    Alert.alert('コピーしました')
  }

  useEffect(() => {
    onGetToken()
  }, [])

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Button title={loading ? '取得中...' : 'Push Tokenを取得'} onPress={onGetToken} disabled={loading} />
      <View style={styles.block}>
        <Text style={styles.label}>Expo Push Token</Text>
        <Text selectable style={styles.tokenText}>
          {token ?? '(token未取得)'}
        </Text>
      </View>

      {reason ? (
        <View style={styles.block}>
          <Text style={styles.errorTitle}>取得できない理由</Text>
          <Text style={styles.errorText}>{reason}</Text>
        </View>
      ) : null}

      <Button title="コピー" onPress={onCopy} disabled={!token} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
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
})
