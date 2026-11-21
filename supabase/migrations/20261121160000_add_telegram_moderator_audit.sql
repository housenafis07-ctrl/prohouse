-- Preserve the Telegram identity of moderators who act from the moderation bot.
alter table public.listing_moderation_history
  add column if not exists moderator_telegram_id text;\n\nalter table public.listing_moderation_history\n  add column if not exists action text;

create index if not exists listing_moderation_history_telegram_moderator_idx
  on public.listing_moderation_history(moderator_telegram_id, created_at desc)
  where moderator_telegram_id is not null;
