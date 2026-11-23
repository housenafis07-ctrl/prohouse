begin;

-- Chat pages read conversations/messages with the browser Supabase client.
-- The API still uses the service role for message creation. These policies
-- make sure an authenticated participant can read their own chats and mark
-- received messages/notifications as read without exposing other chats.

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

drop policy if exists conversations_participant_read on public.conversations;
create policy conversations_participant_read
on public.conversations for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversations.id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists conversation_participants_self_read on public.conversation_participants;
create policy conversation_participants_self_read
on public.conversation_participants for select
to authenticated
using (user_id = auth.uid());

drop policy if exists messages_participant_read on public.messages;
create policy messages_participant_read
on public.messages for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists messages_participant_update on public.messages;
create policy messages_participant_update
on public.messages for update
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists notifications_self_read on public.notifications;
create policy notifications_self_read
on public.notifications for select
to authenticated
using (user_id = auth.uid());

drop policy if exists notifications_self_update on public.notifications;
create policy notifications_self_update
on public.notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

commit;
