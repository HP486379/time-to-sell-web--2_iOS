import { useState, useEffect } from 'react'
import { getExpoPushToken } from '../push/getExpoPushToken'
import { registerPushToken } from '../push/registerPush'

type PushTokenState = {
  token: string | null
  registered: boolean
  error: string | null
}

export function usePushToken(): PushTokenState {
  const [token, setToken] = useState<string | null>(null)
  const [registered, setRegistered] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const pushToken = await getExpoPushToken()
        if (cancelled) return

        if (!pushToken) {
          return
        }

        setToken(pushToken)

        const result = await registerPushToken(pushToken)
        if (cancelled) return

        setRegistered(result.ok)
        if (!result.ok) {
          setError('Push tokenの登録に失敗しました')
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(String(e))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return { token, registered, error }
}
