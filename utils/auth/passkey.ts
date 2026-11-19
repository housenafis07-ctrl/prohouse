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

export async function hasRecentPasskeyAuthentication() {
  const store = await cookies()
  const issuedAt = readAccountSessionIssuedAt(store.get(ACCOUNT_SESSION_COOKIE)?.value)
  return typeof issuedAt === 'number' && issuedAt >= Math.floor(Date.now() / 1000) - 15 * 60
}

export async function savePasskeyChallenge(input: { challenge: string; userId?: string | null; phone?: string; purpose: 'registration' | 'authentication'; origin: string; rpID: string }) {
  const db = serviceClient()
  const { error } = await db.schema('passkey_stage').from('passkey_challenges').insert({
    challenge: input.challenge,
    user_id: input.userId || null,
    phone: input.phone || null,
    purpose: input.purpose,
    expected_origin: input.origin,
    expected_rp_id: input.rpID,
    expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
  })
  if (error) throw error
}

export async function consumePasskeyChallenge(input: { userId?: string; purpose: 'registration' | 'authentication'; challenge: string; phone?: string; origin: string; rpID: string }) {
  const db = serviceClient()
  let query = db.schema('passkey_stage').from('passkey_challenges')
    .update({ consumed_at: new Date().toISOString() })
    .eq('purpose', input.purpose)
    .eq('challenge', input.challenge)
    .eq('expected_origin', input.origin)
    .eq('expected_rp_id', input.rpID)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
  if (input.userId) query = query.eq('user_id', input.userId)
  if (input.phone) query = query.eq('phone', input.phone)
  // `challenge` is the primary key, so this update can match at most one row.
  // Avoid ordering a PATCH response: PostgREST only returns the selected columns
  // from the UPDATE CTE, so ordering by created_at (not in RETURNING) causes 42703.
  const { data, error } = await query.select('challenge,expected_origin,expected_rp_id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('PASSKEY_CHALLENGE_EXPIRED')
  return data
}

export async function registrationOptions(request: Request, userId: string) {
  const { origin, rpID } = passkeyRequestContext(request)
  const db = serviceClient()
  const [{ data: profile, error: profileError }, { data: credentials, error: credentialsError }] = await Promise.all([
    db.from('profiles').select('phone,full_name').eq('id', userId).maybeSingle(),
    db.schema('passkey_stage').from('passkey_credentials').select('credential_id,transports').eq('user_id', userId),
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

export async function verifyPasskeyRegistration(userId: string, challengeValue: string, response: any, request: Request, friendlyName?: string) {
  const db = serviceClient()
  const requestContext = passkeyRequestContext(request)
  const challenge = await consumePasskeyChallenge({ userId, purpose: 'registration', challenge: challengeValue, origin: requestContext.origin, rpID: requestContext.rpID })
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: challenge.expected_origin,
    expectedRPID: challenge.expected_rp_id,
    requireUserVerification: true,
  })
  if (!verification.verified || !verification.registrationInfo) throw new Error('PASSKEY_REGISTRATION_NOT_VERIFIED')
  const credential = verification.registrationInfo.credential
  const { error } = await db.schema('passkey_stage').from('passkey_credentials').insert({
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

export async function authenticationOptions(request: Request, phone?: string) {
  const { origin, rpID } = passkeyRequestContext(request)
  const db = serviceClient()

  // Phone-based lookup remains supported for older clients, but the normal
  // Passkey entry point uses discoverable credentials and asks for no phone.
  let userId: string | undefined
  let allowCredentials: { id: string; transports: string[] }[] | undefined
  if (phone) {
    const { data: profile, error: profileError } = await db.from('profiles').select('id').eq('phone', phone).maybeSingle()
    if (profileError) throw profileError
    if (!profile?.id) throw new Error('PASSKEY_NOT_AVAILABLE')
    userId = profile.id
    const { data: credentials, error: credentialsError } = await db.schema('passkey_stage').from('passkey_credentials')
      .select('credential_id,transports').eq('user_id', userId)
    if (credentialsError) throw credentialsError
    if (!credentials?.length) throw new Error('PASSKEY_NOT_AVAILABLE')
    allowCredentials = credentials.map((item: any) => ({ id: item.credential_id, transports: item.transports || [] }))
  }

  // For discoverable login, apply a conservative per-origin challenge limit.
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  let rateQuery = db.schema('passkey_stage').from('passkey_challenges')
    .select('challenge', { count: 'exact', head: true })
    .eq('purpose', 'authentication').eq('expected_origin', origin).gte('created_at', since)
  if (userId) rateQuery = rateQuery.eq('user_id', userId)
  const { count, error: rateLimitError } = await rateQuery
  if (rateLimitError) throw rateLimitError
  if ((count || 0) >= (userId ? 10 : 30)) throw new Error('PASSKEY_RATE_LIMITED')

  const options = await generateAuthenticationOptions({
    rpID,
    ...(allowCredentials ? { allowCredentials } : {}),
    userVerification: 'required',
    timeout: 60000,
  })
  await savePasskeyChallenge({
    challenge: options.challenge,
    userId: userId || null,
    phone: phone || undefined,
    purpose: 'authentication',
    origin,
    rpID,
  })
  return options
}

export async function verifyPasskeyAuthentication(userId: string, phone: string | undefined, challengeValue: string, response: any, request: Request) {
  const db = serviceClient()
  const requestContext = passkeyRequestContext(request)

  // Resolve the account from the credential returned by the authenticator.
  // This is the key step that makes phone-free discoverable Passkey login work.
  const credentialId = String(response?.id || '')
  if (!credentialId) throw new Error('PASSKEY_CREDENTIAL_REQUIRED')
  const { data: stored, error } = await db.schema('passkey_stage').from('passkey_credentials')
    .select('credential_id,user_id,public_key,counter,transports,last_used_at')
    .eq('credential_id', credentialId).maybeSingle()
  if (error) throw error
  if (!stored || stored.user_id !== userId) throw new Error('PASSKEY_NOT_AVAILABLE')

  const challenge = await consumePasskeyChallenge({
    userId: phone ? userId : undefined,
    phone,
    purpose: 'authentication',
    challenge: challengeValue,
    origin: requestContext.origin,
    rpID: requestContext.rpID,
  })

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

  // If the authenticator supplied userHandle, bind it to the credential owner.
  const userHandle = response?.response?.userHandle
  if (userHandle) {
    const decodedHandle = Buffer.from(userHandle, 'base64url').toString('hex')
    const expectedHandle = userId.replace(/-/g, '').toLowerCase()
    if (decodedHandle.toLowerCase() !== expectedHandle) throw new Error('PASSKEY_USER_HANDLE_MISMATCH')
  }

  let counterQuery = db.schema('passkey_stage').from('passkey_credentials').update({
    counter: verification.authenticationInfo.newCounter,
    last_used_at: new Date().toISOString(),
  }).eq('credential_id', stored.credential_id)
    .eq('user_id', userId)
    .eq('counter', stored.counter)
  counterQuery = stored.last_used_at
    ? counterQuery.eq('last_used_at', stored.last_used_at)
    : counterQuery.is('last_used_at', null)
  const { data: counterUpdate, error: updateError } = await counterQuery.select('credential_id').maybeSingle()
  if (updateError) throw updateError
  if (!counterUpdate) throw new Error('PASSKEY_COUNTER_CONFLICT')
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

  const { data: profile, error: profileError } = await admin.from('profiles').select('phone').eq('id', userId).maybeSingle()
  if (profileError) throw profileError
  const phone = String(profile?.phone || userData.user.user_metadata?.phone || '')
  const normalizedPhone = phone.replace(/\D/g, '')
  if (!normalizedPhone.startsWith('998') || normalizedPhone.length !== 12) throw new Error('PHONE_AUTH_REQUIRED')

  // The existing SMS OTP flow provisions this deterministic internal email.
  // Do not silently attach/change an Auth email or password during Passkey login.
  const expectedEmail = `${normalizedPhone}@test.royalhouse.local`
  if (!userData.user.email || userData.user.email.toLowerCase() !== expectedEmail.toLowerCase()) {
    throw new Error('SMS_OTP_REQUIRED_TO_INITIALIZE_PHONE_LOGIN')
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: expectedEmail,
  })
  if (linkError) throw linkError
  const tokenHash = linkData.properties?.hashed_token
  if (!tokenHash) throw new Error('AUTH_MAGIC_LINK_TOKEN_MISSING')

  const authClient = createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: sessionData, error: signInError } = await authClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  })
  if (signInError || !sessionData.session || sessionData.user?.id !== userId) {
    throw new Error(signInError?.message || 'AUTH_SESSION_CREATE_FAILED')
  }

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
    : ['PASSKEY_CHALLENGE_EXPIRED'].includes(message) ? 410
    : ['PASSKEY_RECENT_AUTH_REQUIRED'].includes(message) ? 403
    : ['PASSKEY_RATE_LIMITED'].includes(message) ? 429
    : ['PASSKEY_ORIGIN_REQUIRED', 'PASSKEY_ORIGIN_NOT_ALLOWED', 'PASSKEY_HOST_NOT_ALLOWED', 'PASSKEY_ORIGIN_MISMATCH'].includes(message) ? 400
    : 400
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}
