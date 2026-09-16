-- Security: wallet balances and ledger rows are server-controlled.
-- Clients may read only their own rows; all mutations must go through trusted RPCs.

revoke insert, update, delete on public.wallet_accounts from anon, authenticated;
revoke insert, update, delete on public.wallet_transactions from anon, authenticated;

alter table public.wallet_accounts enable row level security;
alter table public.wallet_transactions enable row level security;

drop policy if exists wallet_accounts_select_own on public.wallet_accounts;
create policy wallet_accounts_select_own on public.wallet_accounts
for select to authenticated using (user_id = auth.uid());

drop policy if exists wallet_transactions_select_own on public.wallet_transactions;
create policy wallet_transactions_select_own on public.wallet_transactions
for select to authenticated using (user_id = auth.uid());
