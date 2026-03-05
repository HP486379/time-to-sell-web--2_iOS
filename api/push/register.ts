import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kv } from '@vercel/kv'

interface RegisterRequestBody {
  // New format (per problem statement)
  token?: string
  user_id?: string
  // Legacy format (used by existing mobile app)
  expo_push_token?: string
  install_id?: string
  // Optional metadata
  index_type?: string
  threshold?: number
  paid?: boolean
}

interface PushTokenEntry {
  expo_push_token: string
  index_type: string
  threshold: number
  paid: boolean
  registered_at: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const body = req.body as RegisterRequestBody

  // Support both new format (token/user_id) and legacy format (expo_push_token/install_id)
  const pushToken = body.token ?? body.expo_push_token
  const userId = body.user_id ?? body.install_id

  if (!pushToken || !userId) {
    return res.status(400).json({
      error: 'token and user_id are required (also accepted: expo_push_token and install_id)',
    })
  }

  const entry: PushTokenEntry = {
    expo_push_token: pushToken,
    index_type: body.index_type ?? 'SP500',
    threshold: body.threshold ?? 70,
    paid: body.paid ?? false,
    registered_at: new Date().toISOString(),
  }

  await kv.set(`push_token:${userId}`, JSON.stringify(entry)).catch((err: unknown) => {
    throw new Error(`Failed to save push token: ${String(err)}`)
  })

  return res.status(200).json({ ok: true })
}
