import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'

export type PushTokenResult = {
  token: string | null
  reason: string | null
}

function resolveProjectId(): string | null {
  const fromExpoConfig = Constants.expoConfig?.extra?.eas?.projectId
  const fromEasConfig = Constants.easConfig?.projectId
  return fromExpoConfig ?? fromEasConfig ?? null
}

export async function getExpoPushTokenDetailed(): Promise<PushTokenResult> {
  if (!Device.isDevice) {
    return { token: null, reason: '実機ではないため Push Token を取得できません。' }
  }

  const projectId = resolveProjectId()
  if (!projectId) {
    return {
      token: null,
      reason:
        'EAS projectId を取得できません。app.json/app.config と EAS Project 設定を確認してください（Constants.expoConfig.extra.eas.projectId または Constants.easConfig.projectId が必要です）。',
    }
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

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
  return { token, reason: null }
}

export async function getExpoPushToken(): Promise<string | null> {
  const { token, reason } = await getExpoPushTokenDetailed()
  if (!token && reason) {
    console.log(`[push] token 取得不可: ${reason}`)
  }
  return token
}
