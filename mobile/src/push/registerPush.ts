import * as Application from 'expo-application'

const BACKEND_URL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_BACKEND_URL ?? 'https://time-to-sell-web-ios.onrender.com'

function buildBackendUrl(path: string): string {
  const base = BACKEND_URL.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

export async function registerPushToken(expoPushToken: string): Promise<void> {
  const appVersion = Application.nativeApplicationVersion ?? undefined

  const res = await fetch(buildBackendUrl('/api/push/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: expoPushToken,
      platform: 'ios',
      appVersion,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`push register failed: ${res.status} ${text}`)
  }

  console.log('[push] register 成功 token=', expoPushToken, 'backend=', BACKEND_URL)
}
