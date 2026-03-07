export type RegisterPushResult = {
  ok: boolean
  [key: string]: unknown
}

export async function getOrCreateUserId(): Promise<string> {
  return 'push-disabled-user'
}

export async function registerPushToken(_expoPushToken: string): Promise<RegisterPushResult> {
  console.log('[push] disabled: registerPushToken skipped')
  return { ok: false, reason: 'push_disabled' }
}

export const BACKEND_URL = 'disabled'
