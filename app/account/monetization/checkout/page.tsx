'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { pickLocalized } from '@/lib/i18n'
import { useI18n } from '@/app/components/I18nProvider'

type Product = {
  code: string
  name: string
  name_ru: string | null
  description: string | null
  description_ru: string | null
  price_uzs: number
  duration_days: number
  product_type: string | null
  unit: string
  quantity: number
  badge: string | null
  badge_ru: string | null
}

type Listing = {
  id: string
  title: string | null
  price: number | null
  city: string | null
  district: string | null
  status: string
}

type Order = {
  id: string
  status: string
  subtotal_uzs: number
  currency: string
  provider: string | null
  created_at: string
}

function ClickLogo() {
  return <img src="/payments/click.svg" alt="Click" className="h-14 w-28 object-contain" />
}

function PaymeLogo() {
  return <img src="/payments/payme.svg" alt="Payme" className="h-16 w-28 object-contain" />
}

export default function MonetizationCheckoutPage() {
  const { lang, t } = useI18n()
  const [products, setProducts] = useState<Product[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [productCode, setProductCode] = useState('')
  const [listingId, setListingId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [paying, setPaying] = useState<'click' | 'payme' | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState('')

  const money = (v: number) => `${new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ').format(Number(v))} ${t('sum')}`

  useEffect(() => {
    ;(async () => {
      const params = new URLSearchParams(window.location.search)
      setProductCode(params.get('product') || '')
      setListingId(params.get('listingId') || '')

      const db = createClient()
      const { data: { user } } = await db.auth.getUser()
      if (!user) {
        window.location.href = `/register?redirect=${encodeURIComponent('/account/monetization/checkout')}`
        return
      }

      const [{ data: p }, { data: l }] = await Promise.all([
        db.from('monetization_products').select('code,name,name_ru,description,description_ru,price_uzs,duration_days,product_type,unit,quantity,badge,badge_ru').eq('active', true).order('product_type').order('duration_days'),
        db.from('listings').select('id,title,price,city,district,status').eq('owner_id', user.id).in('status', ['active', 'moderation']).order('created_at', { ascending: false }),
      ])

      setProducts((p || []) as Product[])
      setListings((l || []) as Listing[])
      setLoading(false)
    })()
  }, [])

  const product = useMemo(() => products.find(p => p.code === productCode) || null, [products, productCode])
  const needsListing = !!product && ['top', 'up', 'highlight', 'premium'].includes(product.product_type || '')

  const createOrder = async () => {
    if (!product) return
    if (needsListing && !listingId) {
      setError(t('chooseListingFirst'))
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const response = await fetch('/api/monetization/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productCode: product.code, listingId: listingId || null, quantity: 1, idempotencyKey: crypto.randomUUID() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'BUYURTMA_YARATILMADI')
      setOrder(data.order as Order)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'BUYURTMA_YARATILMADI')
    } finally {
      setSubmitting(false)
    }
  }

  const startPayment = async (provider: 'click' | 'payme') => {
    if (!order) return
    setError('')
    setPaying(provider)
    try {
      const response = await fetch(`/api/monetization/payments/${provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, idempotencyKey: crypto.randomUUID() }),
      })
      const data = await response.json()
      if (!response.ok || !data.checkoutUrl) throw new Error(data?.error || 'PAYMENT_NOT_READY')
      window.location.href = data.checkoutUrl
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PAYMENT_NOT_READY')
      setPaying(null)
    }
  }

  if (loading) return <main className="min-h-screen bg-slate-50 p-8 text-center">{t('loading')}</main>

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/account/monetization" className="text-sm font-bold text-emerald-700">{t('backToMonetization')}</Link>
        <header className="mt-4 rounded-3xl bg-white p-6 shadow-sm">
          <span className="text-xs font-black uppercase tracking-widest text-emerald-600">{t('checkout')}</span>
          <h1 className="mt-2 text-3xl font-black">{t('promoteListing')}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{t('checkoutDescription')}</p>
        </header>

        <section className="mt-5 grid items-start gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <div className="space-y-5">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black">1. {t('product')}</h2>
              <div className="mt-4 space-y-3">
                {products.length === 0 ? <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">{t('noProducts')}</div> : products.map(p => (
                  <button key={p.code} type="button" onClick={() => setProductCode(p.code)} className={`w-full rounded-2xl border p-4 text-left transition ${productCode === p.code ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <div className="flex items-start justify-between gap-3"><div><div className="font-black">{pickLocalized(lang, p.name, p.name_ru)}</div><div className="mt-1 text-sm text-slate-500">{pickLocalized(lang, p.description, p.description_ru) || '—'}</div></div>{(p.badge || p.badge_ru) && <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-black text-white">{pickLocalized(lang, p.badge, p.badge_ru)}</span>}</div>
                    <div className="mt-3 flex items-center justify-between text-sm"><b>{money(p.price_uzs)}</b><span className="text-slate-400">{p.duration_days} {t('day')}</span></div>
                  </button>
                ))}
              </div>
            </div>

            {needsListing && <div className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-lg font-black">2. {t('listing')}</h2><select value={listingId} onChange={e => setListingId(e.target.value)} className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-500"><option value="">{t('selectListing')}</option>{listings.map(l => <option key={l.id} value={l.id}>{l.title || t('noName')} — {l.city || ''}{l.district ? `, ${l.district}` : ''}</option>)}</select>{listings.length === 0 && <p className="mt-3 text-sm text-slate-500">{t('noListings')}</p>}</div>}
          </div>

          <aside className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm lg:sticky lg:top-5">
            <h2 className="text-lg font-black">{t('order')}</h2>
            {product ? <>
              <div className="mt-5 rounded-2xl bg-white/10 p-4"><div className="text-sm text-slate-300">{t('product')}</div><div className="mt-1 font-black">{pickLocalized(lang, product.name, product.name_ru)}</div>{needsListing && <div className="mt-3 text-sm text-slate-300">{t('listing')}: <span className="font-bold text-white">{listings.find(l => l.id === listingId)?.title || t('listingNotSelected')}</span></div>}</div>
              <div className="mt-5 flex items-end justify-between border-t border-white/10 pt-5"><span className="text-sm text-slate-300">{t('total')}</span><b className="text-2xl">{money(product.price_uzs)}</b></div>
              {!order && <button type="button" disabled={submitting || (needsListing && !listingId)} onClick={() => void createOrder()} className="mt-5 w-full rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-black text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? t('creatingOrder') : t('createOrder')}</button>}
            </> : <p className="mt-4 text-sm text-slate-300">{t('selectProduct')}</p>}

            {order && <div className="mt-5 rounded-2xl bg-white p-4 text-slate-900"><div className="font-black">{t('paymentMethod')}</div><div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"><button type="button" onClick={() => void startPayment('click')} disabled={!!paying} className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-400 disabled:opacity-60"><div className="text-center text-base font-black text-slate-900">Click</div><div className="mt-3 flex items-center gap-3"><ClickLogo /><span className="min-w-0 text-sm leading-6 text-slate-500">{t('payWithClick')}</span></div></button><button type="button" onClick={() => void startPayment('payme')} disabled={!!paying} className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-cyan-400 disabled:opacity-60"><div className="text-center text-base font-black text-slate-900">Payme</div><div className="mt-3 flex items-center gap-3"><PaymeLogo /><span className="min-w-0 text-sm leading-6 text-slate-500">{t('payWithPayme')}</span></div></button></div>{paying && <div className="mt-3 text-center text-xs font-semibold text-slate-500">{t('redirectingPayment')}</div>}</div>}

            {error && <div className="mt-4 rounded-2xl bg-red-500/15 p-3 text-sm font-semibold text-red-200">{t('error')}: {error}</div>}
            {order && <div className="mt-4 rounded-2xl bg-emerald-500/15 p-4"><div className="font-black text-emerald-300">{t('orderCreated')}</div><div className="mt-1 break-all text-xs text-slate-300">№ {order.id}</div><div className="mt-3 text-sm text-slate-200">{t('status')}: <b>{order.status}</b></div></div>}
          </aside>
        </section>
      </div>
    </main>
  )
}
