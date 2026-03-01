import axios from "axios"

const DEFAULT_API_BASE_URL = "https://mai-rishi-kun.onrender.com"

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  DEFAULT_API_BASE_URL

// URLを安全に連結
export function buildUrl(path: string): string {
  const normalizedBase = API_BASE_URL.replace(/\/$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

// ユーザーID生成（初回のみ）
function getOrCreateUserId(): string {
  const key = "tts_user_id"
  let id = localStorage.getItem(key)

  if (!id) {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      id = crypto.randomUUID()
    } else {
      // フォールバック（古い環境用）
      id = Math.random().toString(36).substring(2) + Date.now().toString(36)
    }
    localStorage.setItem(key, id)
  }

  return id
}

// axiosインスタンス作成
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// 🔥 全リクエストにX-User-Idを自動付与
apiClient.interceptors.request.use((config) => {
  const userId = getOrCreateUserId()

  if (!config.headers) {
    config.headers = {}
  }

  config.headers["X-User-Id"] = userId

  return config
})
