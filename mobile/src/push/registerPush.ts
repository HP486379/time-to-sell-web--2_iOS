import * as Application from 'expo-application'
import * as SecureStore from 'expo-secure-store'
import { DEFAULT_FREE_INDEX_TYPE } from '../constants/indexTypes'

const RAW_BACKEND_URL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_BACKEND_URL

const BACKEND_URL =
  RAW_BACKEND_URL && RAW_BACKEND_URL.trim().length > 0
    ? RAW_BACKEND_URL.trim()
    : 'https://time-to-sell-web-2-ios-api.vercel.app'

const USER_ID_KEY = 'timetosell_user_id'

function buildBackendUrl(path: string): string {
  const base = BACKEND_URL.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

export async function getOrCreateUserId(): Promise<string> {
  const fallback = `user-${Date.now()}`
  try {
    const existing = await SecureStore.getItemAsync(USER_ID_KEY)
    if (existing) return existing

    let idfv: string | null = null
    try {
      idfv = Application.getIosIdForVendorAsync ? await Application.getIosIdForVendorAsync() : null
    } catch {
      idfv = null
    }

    const userId = idfv ?? fallback
    try {
      await SecureStore.setItemAsync(USER_ID_KEY, userId)
    } catch {
      // 保存できなくても動かす（審査で落とさない）
    }
    return userId
  } catch {
    return fallback
  }
}

type RegisterPushResult = {
  ok: boolean
  [key: string]: unknown
}

/**
 * Expo Push Token をバックエンドに登録する。
 * - ネットワーク不良/Renderスリープを考慮し、15秒でタイムアウト
 * - AbortError は静かに失敗扱い（クラッシュ/操作時エラー回避）
 * - 204/空ボディ/非JSONレスポンスでも落ちない
 */
export async function registerPushToken(expoPushToken: string): Promise<RegisterPushResult> {
  const userId = await getOrCreateUserId()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(buildBackendUrl('/api/push/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: expoPushToken,
        user_id: userId,
        index_type: DEFAULT_FREE_INDEX_TYPE,
        threshold: 70,
        paid: false,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`push register failed: ${res.status} ${text}`)
    }

    // 204/空ボディ/非JSON対策
    const ct = res.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      const json = (await res.json()) as RegisterPushResult
      console.log(
        '[push] register 成功',
        { token: expoPushToken, user_id: userId, backend: BACKEND_URL, result: json },
      )
      return json
    }

    console.log(
      '[push] register 成功(非JSON)',
      { token: expoPushToken, user_id: userId, backend: BACKEND_URL, appVersion: Application.nativeApplicationVersion },
    )
    return { ok: true }
  } catch (e: any) {
    // Abort は「静かに失敗」でOK（審査で落とさない）
    const name = e?.name ?? ''
    if (name === 'AbortError') {
      console.log('[push] register timeout (aborted)')
      return { ok: false }
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

export { BACKEND_URL }
