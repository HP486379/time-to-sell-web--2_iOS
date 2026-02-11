import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'

export type PushTokenResult = {
  token: string | null
  reason: string | null
}

export async function getExpoPushTokenDetailed(): Promise<PushTokenResult> {
  if (!Device.isDevice) {
    return { token: null, reason: '実機ではないため Push Token を取得できません。' }
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    return {
      token: null,
      reason: `通知権限が許可されていません（status: ${finalStatus}）。iOS設定から通知を許可してください。`,
    }
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data
  return { token, reason: null }
}

export async function getExpoPushToken(): Promise<string | null> {
  const { token, reason } = await getExpoPushTokenDetailed()
  if (!token && reason) {
    console.log(`[push] token 取得不可: ${reason}`)
  }
  return token
}
