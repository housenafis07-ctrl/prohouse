import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse, type WebAuthnCredential } from '@simplewebauthn/server'
import { NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, accountSessionCookieOptions, createAccountSession, readAccountSessionIssuedAt } from '@/utils/auth/account-session'

const CHALLENGE_TTL_MS = 5 * 60 * 1000

export function passkeyRequestContext(request: Request) {
  const requestUrl = new URL(request.url)
  const host = (request.headers.get('host') || requestUrl.host).toLowerCase()
  const originHeader = request.headers.get('origin')
  if (!originHeader) throw new Error('PASSKEY_ORIGIN_REQUIRED')
  const originUrl = new URL(originHeader)
  if (originUrl.host.toLowerCase() !== host || originUrl.protocol !== 'https:' && originUrl.hostname !== 'localhost') {
    throw new Error('PASSKEY_ORIGIN_NOT_ALLOWED')
  }
  const hostname = originUrl.hostname.toLowerCase()
  const allowedHost = hostname === 'royalhouse.uz' || hostname === 'www.royalhouse.uz' || hostname === 'localhost' || hostname.endsWith('.vercel.app')
  if (!allowedHost) throw new Error('PASSKEY_HOST_NOT_ALLOWED')
  const rpID = hostname === 'www.royalhouse.uz' ? 'royalhouse.uz' : hostname
  return { origin: originUrl.origin, rpID }
}

export async function currentPasskeyUserId() {
  const store = await cookies()
  const { readAccountSession } = await import('@/utils/auth/account-session')
  return readAccountSession(store.get(ACCOUNT_SESSION_COOKIE)?.value)
}

export async function savePasskeyChallenge(input: { challenge: string; userId: string; phone?: string; purpose: 'registration' | 'authentication'; origin: string; rpID: string }) {
  const db = serviceClient()
  const { error } = await db.from('passkey_challenges').insert({
    challenge: input.challenge,
    user_id: input.userId,
    phone: input.phone || null,
    purpose: input.purpose,
    expected_origin: input.origin,
    expected_rp_id: input.rpID,
    expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
  })
  if (error) throw error
}

export async function consumePasskeyChallenge(input: { userId: string; purpose: 'registration' | 'authentication'; phone?: string }) {
  const db = serviceClient()
  let query = db.from('passkey_challenges')
    .update({ consumed_at: new Date().toISOString() })
    .eq('user_id', input.userId)
    .eq('purpose', input.purpose)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
  if (input.phone) query = query.eq('phone', input.phone)
  const { data, error } = await query.select('challenge,expected_origin,expected_rp_id').order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  if (!data) throw new Error('PASSKEY_CHALLENGE_EXPIRED')
  return data
}

export async function registrationOptions(request: Request, userId: string) {
  const { origin, rpID } = passkeyRequestContext(request)
  const db = serviceClient()
  const [{ data: profile, error: profileError }, { data: credentials, error: credentialsError }] = await Promise.all([
    db.from('profiles').select('phone,full_name').eq('id', userId).maybeSingle(),
    db.from('passkey_credentials').select('credential_id,transports').eq('user_id', userId),
  ])
  if (profileError) throw profileError
  if (credentialsError) throw credentialsError
  if (!profile?.phone) throw new Error('PHONE_AUTH_REQUIRED')
  const options = await generateRegistrationOptions({
    rpName: 'RoyalHouse',
    rpID,
    userID: new Uint8Array(Buffer.from(userId.replace(/-/g, ''), 'hex')),
    userName: profile.phone,
    userDisplayName: profile.full_name || profile.phone,
    attestationType: 'none',
    excludeCredentials: (credentials || []).map((item: any) => ({ id: item.credential_id, transports: item.transports || [] })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
      authenticatorAttachment: 'platform',
    },
    timeout: 60000,
  })
  await savePasskeyChallenge({ challenge: options.challenge, userId, purpose: 'registration', origin, rpID })
  return options
}

export async function verifyPasskeyRegistration(request: Request, userId: string, response: any, friendlyName?: string) {
  const db = serviceClient()
  const challenge = await consumePasskeyChallenge({ userId, purpose: 'registration' })
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: challenge.expected_origin,
    expectedRPID: challenge.expected_rp_id,
    requireUserVerification: true,
  })
  if (!verification.verified || !verification.registrationInfo) throw new Error('PASSKEY_REGISTRATION_NOT_VERIFIED')
  const credential = verification.registrationInfo.credential
  const { error } = await db.from('passkey_credentials').insert({
    credential_id: credential.id,
    user_id: userId,
    public_key: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: response?.response?.transports || [],
    device_type: verification.registrationInfo.credentialDeviceType,
    backed_up: verification.registrationInfo.credentialBackedUp,
    friendly_name: (friendlyName || '').trim().slice(0, 60) || null,
  })
  if (error) throw error
  return { verified: true }
}

export async function authenticationOptions(request: Request, phone: string) {
  const { origin, rpID } = passkeyRequestContext(request)
  const db = serviceClient()
  const { data: profile, error: profileError } = await db.from('profiles').select('id,phone').eq('phone', phone).maybeSingle()
  if (profileError) throw profileError
  if (!profile?.id) throw new Error('PASSKEY_NOT_AVAILABLE')
  const { data: credentials, error: credentialsError } = await db.from('passkey_credentials')
    .select('credential_id,transports').eq('user_id', profile.id)
  if (credentialsError) throw credentialsError
  if (!credentials?.length) throw new Error('PASSKEY_NOT_AVAILABLE')
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { count, error: rateLimitError } = await db.from('passkey_challenges')
    .select('challenge', { count: 'exact', head: true })
    .eq('user_id', profile.id).eq('purpose', 'authentication').gte('created_at', since)
  if (rateLimitError) throw rateLimitError
  if ((count || 0) >= 10) throw new Error('PASSKEY_RATE_LIMITED')
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map((item: any) => ({ id: item.credential_id, transports: item.transports || [] })),
    userVerification: 'required',
    timeout: 60000,
  })
  await savePasskeyChallenge({ challenge: options.challenge, userId: profile.id, phone, purpose: 'authentication', origin, rpID })
  return options
}

export async function verifyPasskeyAuthentication(userId: string, phone: string, response: any) {
  const db = serviceClient()
  const challenge = await consumePasskeyChallenge({ userId, phone, purpose: 'authentication' })
  const credentialId = String(response?.id || '')
  const { data: stored, error } = await db.from('passkey_credentials')
    .select('credential_id,user_id,public_key,counter,transports')
    .eq('credential_id', credentialId).eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!stored) throw new Error('PASSKEY_NOT_AVAILABLE')
  const credential: WebAuthnCredential = {
    id: stored.credential_id,
    publicKey: new Uint8Array(Buffer.from(stored.public_key, 'base64url')),
    counter: Number(stored.counter),
    transports: stored.transports || [],
  }
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: challenge.expected_origin,
    expectedRPID: challenge.expected_rp_id,
    credential,
    requireUserVerification: true,
  })
  if (!verification.verified) throw new Error('PASSKEY_AUTHENTICATION_NOT_VERIFIED')
  const { error: updateError } = await db.from('passkey_credentials').update({
    counter: verification.authenticationInfo.newCounter,
    last_used_at: new Date().toISOString(),
  }).eq('credential_id', stored.credential_id).eq('user_id', userId)
  if (updateError) throw updateError
  return { verified: true }
}

export async function issuePasskeyLoginSession(userId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !serviceKey || !publishableKey) throw new Error('SUPABASE_SERVER_CONFIG_MISSING')
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId)
  if (userError || !userData.user) throw new Error(userError?.message || 'AUTH_USER_NOT_FOUND')
  const phone = String(userData.user.user_metadata?.phone || '')
  const normalizedPhone = phone.replace(/\D/g, '')
  if (!normalizedPhone.startsWith('998') || normalizedPhone.length !== 12) throw new Error('PHONE_AUTH_REQUIRED')
  const email = userData.user.email || `${normalizedPhone}@test.royalhouse.local`
  const password = randomBytes(32).toString('base64url')
  const { error: passwordError } = await admin.auth.admin.updateUserById(userId, { password, email, email_confirm: true })
  if (passwordError) throw passwordError
  const authClient = createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: sessionData, error: signInError } = await authClient.auth.signInWithPassword({ email, password })
  if (signInError || !sessionData.session) throw new Error(signInError?.message || 'AUTH_SESSION_CREATE_FAILED')
  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  const cookieStore = await cookies()
  const serverAuth = createServerClient(url, publishableKey, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) { for (const item of cookiesToSet) response.cookies.set(item.name, item.value, item.options) },
    },
  })
  const { error: cookieError } = await serverAuth.auth.setSession({
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
  })
  if (cookieError) throw cookieError
  response.cookies.set(ACCOUNT_SESSION_COOKIE, createAccountSession(userId), accountSessionCookieOptions)
  return response
}

export function passkeyErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'PASSKEY_REQUEST_FAILED'
  const status = ['AUTH_REQUIRED', 'PHONE_AUTH_REQUIRED'].includes(message) ? 401
    : ['PASSKEY_NOT_AVAILABLE'].includes(message) ? 404
    : ['PASSKEY_CHALLENGE_EXPIRED'].includes(message) ? 410\n    : ['PASSKEY_RECENT_AUTH_REQUIRED', 'PASSKEY_RATE_LIMITED'].includes(message) ? 403
    : ['PASSKEY_ORIGIN_REQUIRED', 'PASSKEY_ORIGIN_NOT_ALLOWED', 'PASSKEY_HOST_NOT_ALLOWED'].includes(message) ? 400
    : 400
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}
