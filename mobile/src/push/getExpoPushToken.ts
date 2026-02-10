import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'

export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[push] 実機ではないため Push Token 取得をスキップ')
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('[push] 通知権限が未許可のため token 取得不可')
    return null
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data
  return token
}
