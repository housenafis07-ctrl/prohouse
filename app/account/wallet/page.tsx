'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Wallet = { id: string; account_number: string; balance: number; currency: string; status: string }
type Transaction = { id: string; transaction_code: string; listing_id: string | null; type: string; amount: number; balance_after: number | null; description: string | null; status: string; created_at: string }
type Listing = { id: string; listing_code: string; title: string; status: string; price: number; currency: string }

const transactionLabels: Record<string, string> = {
  deposit: 'Balans to‘ldirildi', withdrawal: 'Mablag‘ yechildi', purchase: 'Xizmat xaridi', refund: 'Qaytarildi', adjustment: 'Tuzatish', hold: 'Rezerv qilindi', release: 'Rezervdan chiqarildi',
}

const money = (value: number, currency = 'UZS') => `${new Intl.NumberFormat('ru-RU').format(value)} ${currency === 'UZS' ? 'so‘m' : currency}`

export default function WalletPage() {
  const router = useRouter()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/register'); return }

      const [{ data: walletData, error: walletError }, { data: txData, error: txError }, { data: listingData }] = await Promise.all([
        supabase.from('wallet_accounts').select('id,account_number,balance,currency,status').eq('user_id', user.id).maybeSingle(),
        supabase.from('wallet_transactions').select('id,transaction_code,listing_id,type,amount,balance_after,description,status,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('listings').select('id,listing_code,title,status,price,currency').eq('owner_id', user.id).order('created_at', { ascending: false }).limit(20),
      ])
      if (!mounted) return
      if (walletError) setError(walletError.message)
      else setWallet(walletData)
      if (txError) setError(prev => prev || txError.message)
      setTransactions(txData || [])
      setListings(listingData || [])
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [router])

  if (loading) return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 text-center shadow-sm">Yuklanmoqda...</div></main>

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/account" className="text-sm font-extrabold text-emerald-700">← Shaxsiy kabinet</Link>
          <Link href="/" className="text-sm font-bold text-slate-500">Prohouse</Link>
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="bg-slate-900 px-6 py-7 text-white sm:px-8">
              <p className="text-sm font-semibold text-slate-300">ProHouse hisob raqami</p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-black sm:text-4xl">{wallet ? money(Number(wallet.balance), wallet.currency) : '0 so‘m'}</h1>
                  <p className="mt-2 text-sm text-slate-300">{wallet?.account_number || 'Hisob yaratilmagan'}</p>
                </div>
                <div className="rounded-xl bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-300">{wallet?.status === 'active' ? 'Faol' : wallet?.status || '—'}</div>
              </div>
            </div>
            <div className="p-6 sm:p-8">
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                <b>Balansni to‘ldirish</b> funksiyasi keyingi bosqichda to‘lov provayderiga ulanadi. Hozircha hisob va barcha tranzaksiyalar tarixi tayyor.
              </div>
              <div className="mt-7 flex items-center justify-between gap-4">
                <div><h2 className="text-lg font-extrabold text-slate-900">Tranzaksiyalar tarixi</h2><p className="mt-1 text-sm text-slate-500">Balansdagi barcha moliyaviy operatsiyalar.</p></div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{transactions.length} ta</span>
              </div>
              <div className="mt-4 divide-y divide-slate-100">
                {transactions.length === 0 ? <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">Hozircha tranzaksiyalar mavjud emas.</div> : transactions.map(tx => {
                  const positive = ['deposit', 'refund', 'release', 'adjustment'].includes(tx.type)
                  return <div key={tx.id} className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0"><p className="font-bold text-slate-900">{transactionLabels[tx.type] || tx.type}</p><p className="mt-1 truncate text-xs text-slate-500">{tx.transaction_code}{tx.listing_id ? ` · E’lon ${tx.listing_id.slice(0, 8)}` : ''} · {new Date(tx.created_at).toLocaleString('uz-UZ')}</p>{tx.description && <p className="mt-1 text-xs text-slate-500">{tx.description}</p>}</div>
                    <div className={`shrink-0 text-right font-extrabold ${positive ? 'text-emerald-600' : 'text-slate-900'}`}>{positive ? '+' : '-'}{money(Number(tx.amount), wallet?.currency || 'UZS')}<p className="mt-1 text-[10px] font-semibold text-slate-400">{tx.status}</p></div>
                  </div>
                })}
              </div>
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-extrabold text-slate-900">Mening e’lonlarim</h2>
              <p className="mt-1 text-sm text-slate-500">Har bir e’lonning doimiy ProHouse ID raqami mavjud.</p>
              <div className="mt-4 space-y-3">
                {listings.length === 0 ? <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Hozircha sizga tegishli e’lonlar yo‘q.</div> : listings.map(item => <Link key={item.id} href={`/listings/${item.id}`} className="block rounded-2xl border border-slate-100 bg-slate-50 p-4 hover:border-emerald-200"><div className="flex items-start justify-between gap-3"><span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">{item.listing_code}</span><span className="text-xs font-bold text-slate-400">{item.status}</span></div><p className="mt-3 font-extrabold text-slate-900">{item.title}</p><p className="mt-1 text-sm text-slate-500">{money(Number(item.price), item.currency)}</p></Link>)}
              </div>
            </section>
            {error && <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">{error}</div>}
          </aside>
        </div>
      </div>
    </main>
  )
}
