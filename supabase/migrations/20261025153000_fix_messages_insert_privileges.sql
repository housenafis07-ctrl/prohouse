begin;

grant select, insert on public.messages to authenticated;
grant select on public.conversations to authenticated;
grant select on public.conversation_participants to authenticated;
grant select, update on public.notifications to authenticated;

alter table public.messages enable row level security;

drop policy if exists messages_participant_insert on public.messages;
create policy messages_participant_insert
on public.messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
      from public.conversation_participants cp
     where cp.conversation_id = messages.conversation_id
       and cp.user_id = auth.uid()
  )
);

commit;
