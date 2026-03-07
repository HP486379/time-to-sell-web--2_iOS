import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kv } from '@vercel/kv'

const DEFAULT_SCORE_THRESHOLD = 70

const BACKEND_URL =
  process.env.BACKEND_URL ?? 'https://time-to-sell-web-ios.onrender.com'

interface PushTokenEntry {
  expo_push_token: string
  index_type: string
  threshold: number
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

  // Load all token entries and build per-user push messages
  // Scores are fetched once per unique index_type via the scoreCache
  const messages: ExpoPushMessage[] = []
  for (const key of keys) {
    const raw = await kv.get<string>(key)
    if (!raw) continue

    const entry: PushTokenEntry =
      typeof raw === 'string' ? (JSON.parse(raw) as PushTokenEntry) : (raw as PushTokenEntry)

    if (!entry.expo_push_token) continue

    const indexType = entry.index_type ?? 'SP500'
    const score = await getScore(indexType)
    if (score === null) continue

    const userThreshold =
      typeof entry.threshold === 'number' ? entry.threshold : DEFAULT_SCORE_THRESHOLD
    if (score >= userThreshold) {
      messages.push({
        to: entry.expo_push_token,
        sound: 'default',
        title: '🔔 売り時アラート',
        body: `売り時スコアが ${score} に達しました。今が売り時かもしれません！`,
      })
    }
  }

  if (!messages.length) {
    return res.status(200).json({ ok: true, sent: 0 })
  }

  await sendExpoPushNotifications(messages)

  return res.status(200).json({ ok: true, sent: messages.length })
}

