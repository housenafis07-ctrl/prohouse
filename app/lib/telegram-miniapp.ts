import { createHmac, timingSafeEqual } from 'node:crypto'

export type TelegramWebAppUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

function getSecret() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured')
  return createHmac('sha256', 'WebAppData').update(token).digest()
}

export function validateTelegramInitData(initData: string, maxAgeSeconds = 86400) {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return null

  const authDate = Number(params.get('auth_date') || 0)
  if (!authDate || !Number.isFinite(authDate)) return null
  if (Math.abs(Math.floor(Date.now() / 1000) - authDate) > maxAgeSeconds) return null

  params.delete('hash')
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const expected = createHmac('sha256', getSecret()).update(dataCheckString).digest('hex')
  const actualBuffer = Buffer.from(hash, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null

  let user: TelegramWebAppUser | null = null
  const rawUser = params.get('user')
  if (rawUser) {
    try {
      const parsed = JSON.parse(rawUser)
      if (!parsed || typeof parsed.id !== 'number') return null
      user = parsed as TelegramWebAppUser
    } catch {
      return null
    }
  }
  if (!user) return null

  return { user, authDate }
}

export function telegramAuthPassword(telegramUserId: number) {
  const secret = process.env.TELEGRAM_AUTH_SECRET || process.env.TELEGRAM_BOT_TOKEN
  if (!secret) throw new Error('TELEGRAM_AUTH_SECRET or TELEGRAM_BOT_TOKEN is not configured')
  return createHmac('sha256', secret).update(`royalhouse:${telegramUserId}`).digest('hex')
}

export function telegramAuthEmail(telegramUserId: number) {
  return `telegram-${telegramUserId}@auth.royalhouse.uz`
}
