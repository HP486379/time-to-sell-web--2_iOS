export type PushTokenResult = {
  token: string | null
  reason: string | null
}

export async function getExpoPushTokenDetailed(): Promise<PushTokenResult> {
  return {
    token: null,
    reason: 'push通知は現在一時的に無効化されています。',
  }
}

export async function getExpoPushToken(): Promise<string | null> {
  console.log('[push] disabled: getExpoPushToken skipped')
  return null
}
