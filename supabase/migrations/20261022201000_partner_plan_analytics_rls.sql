begin;

-- START keeps basic view statistics. PRO/BUSINESS unlock advanced engagement
-- metrics without changing the existing owner analytics UI.
drop policy if exists listing_events_owner_read on public.listing_events;
create policy listing_events_owner_read
on public.listing_events
for select to authenticated
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_events.listing_id
      and l.owner_id = auth.uid()
  )
  and (
    listing_events.event_type = 'view'
    or public.partner_plan_has_feature(auth.uid(), 'advanced_analytics')
  )
);

commit;
