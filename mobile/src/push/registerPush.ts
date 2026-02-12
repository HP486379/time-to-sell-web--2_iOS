import * as Application from 'expo-application'
import * as SecureStore from 'expo-secure-store'

const INSTALL_ID_KEY = 'timetosell_install_id'

const resolveApiBase = (): string => {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  const raw = env?.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000'
  return raw.replace(/\/$/, '')
}

async function getOrCreateInstallId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(INSTALL_ID_KEY)
  if (existing) return existing

  const generated =
    Application.getIosIdForVendorAsync
      ? (await Application.getIosIdForVendorAsync()) ?? `install-${Date.now()}`
      : `install-${Date.now()}`

  await SecureStore.setItemAsync(INSTALL_ID_KEY, generated)
  return generated
}

export async function registerPushToken(expoPushToken: string): Promise<void> {
  const installId = await getOrCreateInstallId()
  const apiBase = resolveApiBase()

  const res = await fetch(`${apiBase}/api/push/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      install_id: installId,
      expo_push_token: expoPushToken,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`push register failed: ${res.status} ${text}`)
  }

  console.log('[push] register 成功 install_id=', installId)
}
