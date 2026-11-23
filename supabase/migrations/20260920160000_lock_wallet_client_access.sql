begin;

-- Security: wallet balances and transaction ledger are server-managed.
revoke all on table public.wallet_accounts from anon, authenticated;
grant select on table public.wallet_accounts to authenticated;

revoke all on table public.wallet_transactions from anon, authenticated;
grant select on table public.wallet_transactions to authenticated;

-- Wallet creation is tied to the authenticated profile only.
revoke all on function public.ensure_wallet_for_profile() from public, anon;
grant execute on function public.ensure_wallet_for_profile() to authenticated;

commit;
