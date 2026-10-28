import { createHmac, timingSafeEqual } from 'node:crypto'

export const ACCOUNT_SESSION_COOKIE = 'rh_account_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30

type Payload = {
  userId: string
  exp: number
}

function getSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return secret
}

function sign(value: string) {
  return createHmac('sha256', getSecret()).update(value).digest('base64url')
}

export function createAccountSession(userId: string) {
  const payload: Payload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${sign(encoded)}`
}

export function readAccountSession(value: string | undefined | null) {
  if (!value) return null
  const separator = value.lastIndexOf('.')
  if (separator <= 0) return null

  const encoded = value.slice(0, separator)
  const receivedSignature = value.slice(separator + 1)
  const expectedSignature = sign(encoded)
  const received = Buffer.from(receivedSignature)
  const expected = Buffer.from(expectedSignature)

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Payload
    if (!payload?.userId || !/^[0-9a-f-]{20,}$/i.test(payload.userId)) return null
    if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null
    return payload.userId
  } catch {
    return null
  }
}

export const accountSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: MAX_AGE_SECONDS,
}
