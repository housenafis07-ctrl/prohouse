import type { SupabaseClient } from '@supabase/supabase-js'

export type TelegramBotUserInput = {
  telegramUserId: string | number
  chatId: string | number
  chatType?: string | null
  username?: string | null
  firstName?: string | null
  lastName?: string | null
}

/**
 * Registers/refreshes a private Telegram bot user.
 * The profile is linked automatically when telegram_user_links already knows
 * this Telegram account; otherwise profile_id stays null until the account is
 * linked from RoyalHouse.
 */
export async function registerTelegramBotUser(
  db: SupabaseClient,
  input: TelegramBotUserInput,
) {
  const telegramUserId = String(input.telegramUserId)
  const chatId = String(input.chatId)
  const chatType = input.chatType || 'private'

  if (!telegramUserId || !chatId || chatType !== 'private') return null

  const { data: link, error: linkError } = await db
    .from('telegram_user_links')
    .select('profile_id')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle()

  if (linkError) throw linkError

  const { data, error } = await db
    .from('telegram_bot_users')
    .upsert({
      telegram_user_id: telegramUserId,
      chat_id: chatId,
      chat_type: chatType,
      telegram_username: input.username || null,
      first_name: input.firstName || null,
      last_name: input.lastName || null,
      profile_id: link?.profile_id || null,
      is_blocked: false,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'telegram_user_id' })
    .select('id,telegram_user_id,chat_id,profile_id,is_blocked,last_seen_at')
    .single()

  if (error) throw error
  return data
}
