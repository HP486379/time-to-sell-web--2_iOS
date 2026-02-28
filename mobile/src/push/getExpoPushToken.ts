import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'

export type PushTokenResult = {
  token: string | null
  reason: string |null
}

function resolveProjectId(): string | null {
  const fromExpoConfig = Constants.expoConfig?.extra?.eas?.projectId
  const fromEasConfig = Constants.easConfig?.projectId
  return fromExpoConfig ?? fromEasConfig ?? null
}

export async function getExpoPushTokenDetailed(): Promise<PushTokenResult> {
  try {
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

    let finalStatus: Notifications.PermissionStatus

    try {
      const perm = await Notifications.getPermissionsAsync()
      finalStatus = perm.status
    } catch (e) {
      return { token: null, reason: `通知権限の取得に失敗しました: ${String(e)}` }
    }

    if (finalStatus !== 'granted') {
      try {
        const req = await Notifications.requestPermissionsAsync()
        finalStatus = req.status
      } catch (e) {
        return { token: null, reason: `通知権限のリクエストに失敗しました: ${String(e)}` }
      }
    }

    if (finalStatus !== 'granted') {
      return {
        token: null,
        reason: `通知権限が許可されていません（status: ${finalStatus}）。`,
      }
    }

    try {
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
      return { token, reason: null }
    } catch (e) {
      return { token: null, reason: `Expo Push Token の取得に失敗しました: ${String(e)}` }
    }
  } catch (e) {
    // ここまで来たら想定外。絶対に落とさない。
    return { token: null, reason: `push初期化で想定外エラー: ${String(e)}` }
  }
}

export async function getExpoPushToken(): Promise<string | null> {
  const { token, reason } = await getExpoPushTokenDetailed()
  if (!token && reason) {
    console.log(`[push] token 取得不可: ${reason}`)
  }
  return token
}