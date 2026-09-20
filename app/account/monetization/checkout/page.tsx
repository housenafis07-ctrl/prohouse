'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Product = {
  code: string
  name: string
  description: string | null
  price_uzs: number
  duration_days: number
  product_type: string | null
  unit: string
  quantity: number
  badge: string | null
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

const money = (v: number) => `${new Intl.NumberFormat('ru-RU').format(Number(v))} so‘m`

export default function MonetizationCheckoutPage() {
  const params = useSearchParams()
  const initialProduct = params.get('product') || ''
  const initialListing = params.get('listingId') || ''
  const [products, setProducts] = useState<Product[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [productCode, setProductCode] = useState(initialProduct)
  const [listingId, setListingId] = useState(initialListing)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const db = createClient()
      const { data: { user } } = await db.auth.getUser()
      if (!user) {
        window.location.href = `/register?redirect=${encodeURIComponent('/account/monetization/checkout')}`
        return
      }

      const [{ data: p }, { data: l }] = await Promise.all([
        db.from('monetization_products')
          .select('code,name,description,price_uzs,duration_days,product_type,unit,quantity,badge')
          .eq('active', true)
          .order('product_type')
          .order('duration_days'),
        db.from('listings')
          .select('id,title,price,city,district,status')
          .eq('owner_id', user.id)
          .in('status', ['active', 'moderation'])
          .order('created_at', { ascending: false }),
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
      setError('Avval ilgari suriladigan e’lonni tanlang.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const response = await fetch('/api/monetization/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productCode: product.code,
          listingId: listingId || null,
          quantity: 1,
          idempotencyKey: crypto.randomUUID(),
        }),
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

  if (loading) return <main className="min-h-screen bg-slate-50 p-8 text-center">Yuklanmoqda...</main>

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/account/monetization" className="text-sm font-bold text-emerald-700">← Monetizatsiya</Link>
        <header className="mt-4 rounded-3xl bg-white p-6 shadow-sm">
          <span className="text-xs font-black uppercase tracking-widest text-emerald-600">Checkout</span>
          <h1 className="mt-2 text-3xl font-black">E’lonni ilgari surish</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Mahsulotni va e’lonni tanlang. Hozircha real to‘lov yechib olinmaydi — payment provider ulanganda shu buyurtma to‘lov oynasiga ulanadi.</p>
        </header>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr] items-start">
          <div className="space-y-5">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black">1. Mahsulot</h2>
              <div className="mt-4 space-y-3">
                {products.length === 0 ? (
                  <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">Hozircha sotuvga yoqilgan mahsulot yo‘q. Admin katalogda mahsulotni faollashtirgach checkout ishlaydi.</div>
                ) : products.map(p => (
                  <button key={p.code} type="button" onClick={() => setProductCode(p.code)} className={`w-full rounded-2xl border p-4 text-left transition ${productCode === p.code ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-black">{p.name}</div>
                        <div className="mt-1 text-sm text-slate-500">{p.description || '—'}</div>
                      </div>
                      {p.badge && <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-black text-white">{p.badge}</span>}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <b>{money(p.price_uzs)}</b>
                      <span className="text-slate-400">{p.duration_days} kun</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {needsListing && (
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black">2. E’lon</h2>
                <select value={listingId} onChange={e => setListingId(e.target.value)} className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-500">
                  <option value="">E’lonni tanlang...</option>
                  {listings.map(l => <option key={l.id} value={l.id}>{l.title || 'Nomsiz e’lon'} — {l.city || ''}{l.district ? `, ${l.district}` : ''}</option>)}
                </select>
                {listings.length === 0 && <p className="mt-3 text-sm text-slate-500">Ilgari surish uchun faol yoki moderatsiyadagi e’loningiz bo‘lishi kerak.</p>}
              </div>
            )}
          </div>

          <aside className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm lg:sticky lg:top-5">
            <h2 className="text-lg font-black">Buyurtma</h2>
            {product ? (
              <>
                <div className="mt-5 rounded-2xl bg-white/10 p-4">
                  <div className="text-sm text-slate-300">Mahsulot</div>
                  <div className="mt-1 font-black">{product.name}</div>
                  {needsListing && <div className="mt-3 text-sm text-slate-300">E’lon: <span className="font-bold text-white">{listings.find(l => l.id === listingId)?.title || 'Tanlanmagan'}</span></div>}
                </div>
                <div className="mt-5 flex items-end justify-between border-t border-white/10 pt-5">
                  <span className="text-sm text-slate-300">Jami</span>
                  <b className="text-2xl">{money(product.price_uzs)}</b>
                </div>
                <button type="button" disabled={submitting || (needsListing && !listingId)} onClick={() => void createOrder()} className="mt-5 w-full rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-black text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
                  {submitting ? 'Buyurtma yaratilmoqda...' : 'Buyurtma yaratish'}
                </button>
              </>
            ) : <p className="mt-4 text-sm text-slate-300">Mahsulot tanlang.</p>}

            {error && <div className="mt-4 rounded-2xl bg-red-500/15 p-3 text-sm font-semibold text-red-200">{error}</div>}

            {order && (
              <div className="mt-5 rounded-2xl bg-emerald-500/15 p-4">
                <div className="font-black text-emerald-300">Buyurtma yaratildi</div>
                <div className="mt-1 break-all text-xs text-slate-300">№ {order.id}</div>
                <div className="mt-3 text-sm text-slate-200">Holat: <b>{order.status}</b></div>
                <div className="mt-1 text-xs text-slate-400">To‘lov provayderi ulanmaguncha to‘lov oynasi ko‘rsatilmaydi.</div>
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  )
}
