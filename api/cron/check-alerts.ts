import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kv } from '@vercel/kv'

const ALERT_THRESHOLD = 65

const BACKEND_URL =
  process.env.BACKEND_URL ?? 'https://time-to-sell-web-ios.onrender.com'

interface PushTokenEntry {
  expo_push_token: string
  index_type: string
  paid: boolean
  registered_at: string
}

interface EvaluateResponse {
  scores?: {
    total?: number
    [key: string]: unknown
  }
  [key: string]: unknown
}

interface ExpoPushMessage {
  to: string
  sound: string
  title: string
  body: string
}

interface NotificationState {
  previous_score: number | null
  above_threshold: boolean
  last_notified_at: string | null
  updated_at: string
}

// Cache of fetched scores per index_type to avoid duplicate API calls
const scoreCache = new Map<string, number | null>()

async function getScore(indexType: string): Promise<number | null> {
  if (scoreCache.has(indexType)) {
    return scoreCache.get(indexType) ?? null
  }
  try {
    const res = await fetch(`${BACKEND_URL}/api/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        total_quantity: 1,
        avg_cost: 0,
        index_type: indexType,
        score_ma: 20,
      }),
    })
    if (!res.ok) {
      scoreCache.set(indexType, null)
      return null
    }
    const data = (await res.json()) as EvaluateResponse
    const total = data?.scores?.total
    const score = typeof total === 'number' ? total : null
    scoreCache.set(indexType, score)
    return score
  } catch {
    scoreCache.set(indexType, null)
    return null
  }
}

async function sendExpoPushNotifications(
  messages: ExpoPushMessage[]
): Promise<void> {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error(`[push] Expo API error: ${res.status} ${text}`)
  }
}

function parseUserIdFromPushTokenKey(key: string): string | null {
  const prefix = 'push_token:'
  if (!key.startsWith(prefix)) return null
  const userId = key.slice(prefix.length)
  return userId || null
}

function buildNotificationStateKey(userId: string, indexType: string): string {
  return `push_state:${userId}:${indexType}`
}

async function loadNotificationState(
  userId: string,
  indexType: string
): Promise<NotificationState> {
  const raw = await kv.get<string | NotificationState>(buildNotificationStateKey(userId, indexType))
  if (!raw) {
    return {
      previous_score: null,
      above_threshold: false,
      last_notified_at: null,
      updated_at: new Date(0).toISOString(),
    }
  }

  const parsed =
    typeof raw === 'string' ? (JSON.parse(raw) as Partial<NotificationState>) : (raw as Partial<NotificationState>)

  return {
    previous_score: typeof parsed.previous_score === 'number' ? parsed.previous_score : null,
    above_threshold: parsed.above_threshold === true,
    last_notified_at:
      typeof parsed.last_notified_at === 'string' ? parsed.last_notified_at : null,
    updated_at: typeof parsed.updated_at === 'string' ? parsed.updated_at : new Date(0).toISOString(),
  }
}

async function saveNotificationState(
  userId: string,
  indexType: string,
  state: NotificationState
): Promise<void> {
  await kv.set(buildNotificationStateKey(userId, indexType), JSON.stringify(state))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret to prevent unauthorized invocations
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.authorization
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  // Retrieve all registered push token keys from KV
  const keys = await kv.keys('push_token:*')
  if (!keys.length) {
    return res.status(200).json({ ok: true, sent: 0, message: 'No registered tokens' })
  }

  // Load all token entries and build per-user/index push messages.
  // Scores are fetched once per unique index_type via the scoreCache.
  const messages: ExpoPushMessage[] = []
  const decisionLogs: Array<Record<string, unknown>> = []
  for (const key of keys) {
    try {
      const raw = await kv.get<string>(key)
      if (!raw) continue

      const userId = parseUserIdFromPushTokenKey(key)
      if (!userId) {
        decisionLogs.push({
          key,
          notified: false,
          reason: 'invalid_push_token_key',
        })
        continue
      }

      const entry: PushTokenEntry =
        typeof raw === 'string' ? (JSON.parse(raw) as PushTokenEntry) : (raw as PushTokenEntry)

      if (!entry.expo_push_token) {
        decisionLogs.push({
          userId,
          indexType: entry.index_type ?? 'SP500',
          notified: false,
          reason: 'missing_expo_push_token',
        })
        continue
      }

      const indexType = entry.index_type ?? 'SP500'
      const score = await getScore(indexType)
      const previousState = await loadNotificationState(userId, indexType)

      if (score === null) {
        decisionLogs.push({
          userId,
          indexType,
          score: null,
          previousAboveThreshold: previousState.above_threshold,
          notified: false,
          reason: 'score_unavailable',
        })
        continue
      }

      const isAboveThreshold = score > ALERT_THRESHOLD
      const shouldNotify = !previousState.above_threshold && isAboveThreshold
      const reason = shouldNotify
        ? 'sent'
        : !isAboveThreshold
          ? 'below_threshold'
          : 'already_above_threshold'

      if (shouldNotify) {
        messages.push({
          to: entry.expo_push_token,
          sound: 'default',
          title: '売り時くん通知',
          body: `${indexType} の総合スコアが 65 を超えました（現在 ${score.toFixed(1)}）`,
        })
      }

      await saveNotificationState(userId, indexType, {
        previous_score: score,
        above_threshold: isAboveThreshold,
        last_notified_at: shouldNotify
          ? new Date().toISOString()
          : previousState.last_notified_at,
        updated_at: new Date().toISOString(),
      })

      decisionLogs.push({
        userId,
        indexType,
        score,
        previousAboveThreshold: previousState.above_threshold,
        currentAboveThreshold: isAboveThreshold,
        notified: shouldNotify,
        reason,
      })
    } catch (err) {
      decisionLogs.push({
        key,
        notified: false,
        reason: 'entry_processing_error',
        error: String(err),
      })
      continue
    }
  }

  for (const log of decisionLogs) {
    console.log('[push][decision]', JSON.stringify(log))
  }

  if (!messages.length) {
    return res.status(200).json({ ok: true, sent: 0 })
  }

  await sendExpoPushNotifications(messages)

  return res.status(200).json({ ok: true, sent: messages.length })
}
