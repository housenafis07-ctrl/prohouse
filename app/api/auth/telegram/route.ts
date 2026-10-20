import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'
import { telegramAuthEmail, validateTelegramInitData } from '@/app/lib/telegram-miniapp'

export const runtime = 'nodejs'
const noStore = { 'Cache-Control': 'private, no-store' }

type Profile = { id: string; full_name: string | null; phone: string | null }

function displayName(first?: string, last?: string, id?: number) {
  return [first, last].filter(Boolean).join(' ').trim() || `Telegram ${id ?? ''}`.trim()
}

function isSameTelegram(user: { user_metadata?: Record<string, unknown> }, telegramId: string) {
  return String(user.user_metadata?.telegram_user_id ?? '') === telegramId
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null)
    const rawInitData = body && typeof body === 'object' ? (body as { initData?: unknown }).initData : null
    const initData = typeof rawInitData === 'string' ? rawInitData : ''
    const validated = validateTelegramInitData(initData)
    if (!validated) return NextResponse.json({ error: 'INVALID_TELEGRAM_INIT_DATA' }, { status: 401, headers: noStore })

    const tg = validated.user
    const telegramUserId = String(tg.id)
    const admin = serviceClient()
    const name = displayName(tg.first_name, tg.last_name, tg.id)

    // The Telegram ID is the only resolver. Never read the browser cookie/session.
    const { data: links, error: linkError } = await admin
      .from('telegram_user_links')
      .select('profile_id,telegram_user_id,verified_at,verification_method')
      .eq('telegram_user_id', telegramUserId)
      .limit(2)
    if (linkError) throw linkError
    if (links.length > 1) return NextResponse.json({ error: 'TELEGRAM_IDENTITY_CORRUPTED' }, { status: 409, headers: noStore })

    let profileId: string | null = links[0]?.profile_id ?? null
    let profile: Profile | null = null

    if (profileId) {
      const { data: mappedProfile, error: profileError } = await admin
        .from('profiles').select('id,full_name,phone').eq('id', profileId).maybeSingle()
      if (profileError) throw profileError
      if (!mappedProfile) throw new Error('TELEGRAM_PROFILE_NOT_FOUND')

      const { data: mappedAuth, error: authError } = await admin.auth.admin.getUserById(profileId)
      if (authError || !mappedAuth.user) throw authError ?? new Error('MAPPED_AUTH_USER_NOT_FOUND')

      // A stale/merged mapping must never be allowed to authenticate the wrong Auth user.
      // If the mapped Auth user does not itself carry this Telegram identity, quarantine
      // only the bad link and create a fresh Telegram profile below.
      if (!isSameTelegram(mappedAuth.user, telegramUserId)) {
        const { error: detachError } = await admin
          .from('telegram_user_links')
          .delete()
          .eq('telegram_user_id', telegramUserId)
          .eq('profile_id', profileId)
        if (detachError) throw detachError
        profileId = null
      } else {
        profile = mappedProfile as Profile
      }
    }

    if (!profileId) {
      const baseEmail = telegramAuthEmail(tg.id)
      let email = baseEmail
      let createdUser: { id: string } | null = null

      // A deterministic Telegram email may belong to an orphan left by an older auth bug.
      // Never reuse that user's profile. Quarantine only an account explicitly marked as
      // the same Telegram identity, then create the clean account.
      const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (usersError) throw usersError
      const legacy = usersPage.users.find(u => u.email?.toLowerCase() === baseEmail.toLowerCase())
      if (legacy) {
        if (isSameTelegram(legacy, telegramUserId)) {
          email = `legacy-${telegramUserId}-${Date.now()}@auth.royalhouse.uz`
          const { error: quarantineError } = await admin.auth.admin.updateUserById(legacy.id, {
            email,
            email_confirm: true,
            password: crypto.randomUUID() + crypto.randomUUID(),
            user_metadata: { ...(legacy.user_metadata ?? {}), auth_provider: 'legacy_telegram_quarantined', telegram_identity_quarantined_at: new Date().toISOString() },
          })
          if (quarantineError) throw quarantineError
          email = baseEmail
        } else {
          email = `tg_${telegramUserId}_${crypto.randomUUID().slice(0, 8)}@royalhouse.internal`
        }
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          auth_provider: 'telegram',
          telegram_user_id: telegramUserId,
          telegram_username: tg.username ?? null,
          telegram_first_name: tg.first_name ?? null,
          telegram_last_name: tg.last_name ?? null,
        },
      })
      if (createError || !created.user) throw createError ?? new Error('TELEGRAM_AUTH_USER_CREATE_FAILED')
      createdUser = { id: created.user.id }
      profileId = createdUser.id

      const { data: createdProfile, error: profileInsertError } = await admin.from('profiles').insert({
        id: profileId,
        full_name: name,
        account_type: 'individual',
      }).select('id,full_name,phone').single()
      if (profileInsertError || !createdProfile) throw profileInsertError ?? new Error('TELEGRAM_PROFILE_CREATE_FAILED')
      profile = createdProfile as Profile

      const now = new Date().toISOString()
      const { error: newLinkError } = await admin.from('telegram_user_links').insert({
        profile_id: profileId,
        telegram_user_id: telegramUserId,
        chat_id: telegramUserId,
        telegram_username: tg.username ?? null,
        linked_at: now,
        verified_at: now,
        verification_method: 'telegram_auto',
      })
      if (newLinkError) throw newLinkError
    }

    if (!profile || !profileId) throw new Error('TELEGRAM_PROFILE_RESOLUTION_FAILED')

    const { data: exactAuth, error: exactAuthError } = await admin.auth.admin.getUserById(profileId)
    if (exactAuthError || !exactAuth.user) throw exactAuthError ?? new Error('MAPPED_AUTH_USER_NOT_FOUND')
    if (!isSameTelegram(exactAuth.user, telegramUserId)) throw new Error('TELEGRAM_AUTH_METADATA_MISMATCH')

    let authEmail = exactAuth.user.email
    if (!authEmail) {
      authEmail = telegramAuthEmail(tg.id)
      const { error } = await admin.auth.admin.updateUserById(profileId, { email: authEmail, email_confirm: true })
      if (error) throw error
    }

    const { data: linkData, error: generateError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: authEmail })
    if (generateError || !linkData?.properties?.hashed_token) throw generateError ?? new Error('TELEGRAM_SESSION_TOKEN_CREATE_FAILED')

    const { data: sessionData, error: verifyError } = await admin.auth.verifyOtp({ type: 'magiclink', token_hash: linkData.properties.hashed_token })
    if (verifyError || !sessionData.session) throw verifyError ?? new Error('TELEGRAM_SESSION_CREATE_FAILED')

    const session = sessionData.session
    if (session.user.id !== profileId || !isSameTelegram(session.user, telegramUserId)) throw new Error('TELEGRAM_PROFILE_SESSION_MISMATCH')

    return NextResponse.json({
      ok: true,
      telegramUserId,
      session: { access_token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at },
      profile: { id: profileId, fullName: profile.full_name ?? name, phone: profile.phone, hasPhone: Boolean(profile.phone) },
    }, { headers: noStore })
  } catch (error) {
    console.error('[Telegram auth] failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'TELEGRAM_AUTH_FAILED' }, { status: 500, headers: noStore })
  }
}
