import * as Application from 'expo-application'
import * as SecureStore from 'expo-secure-store'

const BACKEND_URL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_BACKEND_URL ?? 'https://time-to-sell-web-ios.onrender.com'

const INSTALL_ID_KEY = 'timetosell_install_id'

function buildBackendUrl(path: string): string {
  const base = BACKEND_URL.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

export async function getOrCreateInstallId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(INSTALL_ID_KEY)
  if (existing) return existing

  const fallback = `install-${Date.now()}`
  const idfv = Application.getIosIdForVendorAsync ? await Application.getIosIdForVendorAsync() : null
  const installId = idfv ?? fallback

  await SecureStore.setItemAsync(INSTALL_ID_KEY, installId)
  return installId
}

type RegisterPushResult = {
  ok: boolean
  registration?: unknown
}

export async function registerPushToken(expoPushToken: string): Promise<RegisterPushResult> {
  const installId = await getOrCreateInstallId()

  const res = await fetch(buildBackendUrl('/api/push/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      install_id: installId,
      expo_push_token: expoPushToken,
      index_type: 'SP500',
      threshold: 80,
      paid: false,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`push register failed: ${res.status} ${text}`)
  }

  const json = (await res.json()) as RegisterPushResult
  console.log('[push] register 成功 install_id=', installId, 'backend=', BACKEND_URL, 'appVersion=', Application.nativeApplicationVersion)
  return json
}

type PushTestPayload = {
  expoPushToken?: string
  installId?: string
}

export async function requestPushTest(payload: PushTestPayload): Promise<unknown> {
  const res = await fetch(buildBackendUrl('/api/push/test'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expo_push_token: payload.expoPushToken,
      install_id: payload.installId,
      title: '売り時くん テスト通知',
      body: 'Push Debug画面からのテスト通知です',
    }),
  })

  const text = await res.text()
  try {
    const json = JSON.parse(text) as unknown
    if (!res.ok) {
      throw new Error(`push test failed: ${res.status} ${JSON.stringify(json)}`)
    }
    return json
  } catch {
    if (!res.ok) {
      throw new Error(`push test failed: ${res.status} ${text}`)
    }
    return text
  }
}

export { BACKEND_URL }
