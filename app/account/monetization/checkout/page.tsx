'use client'

import Link from 'next/link'
import Script from 'next/script'
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
  title_ru?: string | null
  price: number | null
  city: string | null
  district: string | null
  status: string
  image_url?: string | null
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
  return <img src="/payments/click.svg" alt="Click" className="h-12 w-24 object-contain" />
}

function PaymeLogo() {
  return <img src="/payments/payme.svg" alt="Payme" className="h-14 w-24 object-contain" />
}

export default function MonetizationCheckoutPage() {
  const { lang, t } = useI18n()
  const [products, setProducts] = useState<Product[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [productCode, setProductCode] = useState('')
  const [listingId, setListingId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [paying, setPaying] = useState<'click' | 'payme' | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState('')
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState('')
  const [pendingCheckoutProvider, setPendingCheckoutProvider] = useState<'click' | 'payme' | null>(null)

  const money = (value: number | null | undefined) => `${new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ').format(Number(value || 0))} ${t('sum')}`

  const localizeLocation = (value: string | null | undefined) => {
    if (!value || lang !== 'ru') return value || ''
    const map: Record<string, string> = {
      Toshkent: 'Ташкент',
      'Toshkent viloyati': 'Ташкентская область',
      'Toshkent shahri': 'г. Ташкент',
      Yunusobod: 'Юнусабад',
      Chilonzor: 'Чиланзар',
      'Mirzo Ulug‘bek': 'Мирзо-Улугбекский район',
      "Mirzo Ulug'bek": 'Мирзо-Улугбекский район',
      Shayxontahur: 'Шайхантахурский район',
      Olmazor: 'Алмазарский район',
      Yakkasaroy: 'Яккасарайский район',
      Sergeli: 'Сергелийский район',
      Bektemir: 'Бектемирский район',
      Uchtepa: 'Учтепинский район',
      Mirobod: 'Мирабадский район',
      Yangihayot: 'Янгиҳаётский район',
      'Yangiyo‘l': 'Янгиюльский район',
      "Yangiyo'l": 'Янгиюльский район',
      Chirchiq: 'Чирчик',
      Olmaliq: 'Алмалык',
      Angren: 'Ангрен',
      Bekobod: 'Бекабад',
      Zangiota: 'Зангиатинский район',
      Qibray: 'Кибрайский район',
    }
    return map[value] || value
  }

  useEffect(() => {
    ;(async () => {
      const params = new URLSearchParams(window.location.search)
      const requestedOrderId = params.get('orderId') || ''
      const requestedProduct = params.get('product') || ''
      const requestedListing = params.get('listingId') || ''
      setProductCode(requestedProduct)
      setListingId(requestedListing)

      const db = createClient()
      const { data: { user } } = await db.auth.getUser()
      if (!user) {
        window.location.href = `/register?redirect=${encodeURIComponent('/account/monetization/checkout')}`
        return
      }

      const [{ data: productRows }, listingsResponse, orderResponse] = await Promise.all([
        db.from('monetization_products').select('code,name,name_ru,description,description_ru,price_uzs,duration_days,product_type,unit,quantity,badge,badge_ru').eq('active', true).order('product_type').order('duration_days'),
        fetch('/api/monetization/listings', { cache: 'no-store' }),
        requestedOrderId ? fetch(`/api/monetization/orders/${encodeURIComponent(requestedOrderId)}`, { cache: 'no-store' }) : Promise.resolve(null),
      ])

      const listingsPayload = listingsResponse.ok ? await listingsResponse.json() : { listings: [] }
      const ownListings = Array.isArray(listingsPayload.listings) ? listingsPayload.listings as Listing[] : []
      setProducts((productRows || []) as Product[])
      setListings(ownListings)

      if (requestedListing && !ownListings.some((item) => item.id === requestedListing)) {
        setListingId('')
        setError(lang === 'ru' ? 'Можно продвигать только свои объявления.' : 'Faqat o‘zingiz joylagan e’lonni ilgari surishingiz mumkin.')
      }

      if (requestedOrderId && orderResponse) {
        const payload = orderResponse.ok ? await orderResponse.json() : null
        if (payload?.order) setOrder(payload.order as Order)
      }

      setLoading(false)
    })()
  }, [lang])

  const product = useMemo(() => products.find((item) => item.code === productCode) || null, [products, productCode])
  const needsListing = !!product && ['top', 'up', 'highlight', 'premium'].includes(product.product_type || '')

  const filteredListings = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return listings
    return listings.filter((listing) => {
      const haystack = [listing.title, listing.title_ru, listing.city, listing.district, listing.price].filter(Boolean).join(' ').toLocaleLowerCase()
      return haystack.includes(query)
    })
  }, [listings, search])

  const selectedListing = useMemo(() => listings.find((item) => item.id === listingId) || null, [listings, listingId])

  const createOrder = async () => {
    if (!product) return
    if (needsListing && !listingId) {
      setError(t('chooseListingFirst'))
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const response = await fetch('/api/monetization/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productCode: product.code, listingId: listingId || null, quantity: 1, idempotencyKey: crypto.randomUUID() }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || t('orderCreateFailed'))
      setOrder(data.order as Order)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('orderCreateFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const startPayment = async (provider: 'click' | 'payme') => {
    if (!order) return
    setError('')
    setPaying(provider)
    try {
      const response = await fetch(`/api/monetization/payments/${provider}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.id, idempotencyKey: crypto.randomUUID() }) })
      const data = await response.json()
      if (!response.ok || !data.checkoutUrl) throw new Error(data?.error || t('paymentNotReady'))
      if (provider === 'payme') {
        setPendingCheckoutUrl(data.checkoutUrl)
        setPendingCheckoutProvider('payme')
        setPaying(null)
        return
      }
      window.location.href = data.checkoutUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : t('paymentNotReady'))
      setPaying(null)
    }
  }

  const openPendingCheckout = () => {
    if (!pendingCheckoutUrl || !pendingCheckoutProvider) return
    const telegramWebApp = (window as Window & { Telegram?: { WebApp?: { openLink?: (url: string) => void } } }).Telegram?.WebApp
    if (pendingCheckoutProvider === 'payme' && typeof telegramWebApp?.openLink === 'function') {
      telegramWebApp.openLink(pendingCheckoutUrl)
      return
    }
    window.location.assign(pendingCheckoutUrl)
  }

  if (loading) return <main className="min-h-screen bg-slate-50 p-8 text-center">{t('loading')}</main>

  if (!product && productCode) return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-black">{lang === 'ru' ? 'Товар не найден' : 'Tarif topilmadi'}</h1><p className="mt-2 text-sm text-slate-500">{lang === 'ru' ? 'Вернитесь к монетизации и выберите тариф ещё раз.' : 'Monetizatsiyaga qaytib, tarifni qayta tanlang.'}</p><Link href="/account/monetization" className="mt-6 inline-flex rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">{lang === 'ru' ? 'К тарифам' : 'Tariflarga qaytish'}</Link></div></main>

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-8">
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <div className="mx-auto max-w-6xl">
        <Link href="/account/monetization" className="inline-flex items-center gap-2 text-sm font-black text-emerald-700">← {t('backToMonetization')}</Link>

        <header className="mt-4 overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="bg-gradient-to-r from-emerald-50 via-white to-slate-50 p-6 sm:p-8">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">{t('checkout')}</span>
            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div><h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{lang === 'ru' ? 'Выберите объявление для продвижения' : 'Qaysi e’lonni ilgari suramiz?'}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{lang === 'ru' ? 'Сначала выбран тариф. Теперь выберите конкретное объявление — без повторного списка тарифов.' : 'Tarif allaqachon tanlangan. Endi qaysi e’lonni ilgari surishni tanlang — tariflar qayta ko‘rsatilmaydi.'}</p></div>
              {product && <div className="shrink-0 rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-lg"><div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{lang === 'ru' ? 'Выбранная услуга' : 'Tanlangan xizmat'}</div><div className="mt-1 font-black">{pickLocalized(lang, product.name, product.name_ru)}</div><div className="mt-1 text-lg font-black text-emerald-300">{money(product.price_uzs)}</div></div>}
            </div>
          </div>
        </header>

        {needsListing ? <section className="mt-5 grid items-start gap-5 lg:grid-cols-[1fr_360px]">
          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black text-slate-950">1. {lang === 'ru' ? 'Ваши объявления' : 'Sizning e’lonlaringiz'}</h2><p className="mt-1 text-sm text-slate-500">{lang === 'ru' ? `${listings.length} объявлений доступно для продвижения` : `${listings.length} ta e’lonni ilgari surish mumkin`}</p></div><div className="relative w-full sm:max-w-xs"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={lang === 'ru' ? 'Поиск по названию или району...' : 'Nomi yoki tumani bo‘yicha qidiring...'} className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white" /></div></div>

            {listings.length === 0 ? <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center"><div className="text-4xl">🏠</div><h3 className="mt-3 font-black">{t('noListings')}</h3><p className="mt-1 text-sm text-slate-500">{lang === 'ru' ? 'У вас пока нет активных объявлений.' : 'Hozircha faol e’lonlaringiz yo‘q.'}</p></div> : filteredListings.length === 0 ? <div className="mt-6 rounded-3xl bg-slate-50 p-10 text-center text-sm font-semibold text-slate-500">{lang === 'ru' ? 'По вашему запросу объявления не найдены.' : 'Qidiruv bo‘yicha e’lon topilmadi.'}</div> : <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredListings.map((listing) => {
                const selected = listing.id === listingId
                const title = pickLocalized(lang, listing.title, listing.title_ru) || t('noName')
                const location = [localizeLocation(listing.city), localizeLocation(listing.district)].filter(Boolean).join(', ')
                return <button key={listing.id} type="button" onClick={() => { setListingId(listing.id); setOrder(null); setError('') }} className={`group overflow-hidden rounded-3xl border-2 bg-white text-left transition hover:-translate-y-0.5 hover:shadow-lg ${selected ? 'border-emerald-500 ring-4 ring-emerald-100' : 'border-slate-100 hover:border-slate-300'}`}>
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">{listing.image_url ? <img src={listing.image_url} alt={title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-5xl text-slate-300">🏠</div>}{selected && <span className="absolute right-3 top-3 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-black text-white shadow-lg">✓ {lang === 'ru' ? 'Выбрано' : 'Tanlandi'}</span>}</div>
                  <div className="p-4"><h3 className="line-clamp-2 min-h-12 font-black leading-5 text-slate-950">{title}</h3><div className="mt-2 text-xs font-semibold text-slate-500">⌖ {location || (lang === 'ru' ? 'Адрес не указан' : 'Manzil ko‘rsatilmagan')}</div><div className="mt-3 flex items-center justify-between gap-3"><span className="text-lg font-black text-emerald-700">{listing.price ? money(listing.price) : (lang === 'ru' ? 'Цена не указана' : 'Narx ko‘rsatilmagan')}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500">{listing.status === 'active' ? (lang === 'ru' ? 'Активно' : 'Faol') : (lang === 'ru' ? 'На модерации' : 'Moderatsiyada')}</span></div></div>
                </button>
              })}
            </div>}
          </div>

          <aside className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl lg:sticky lg:top-5">
            <div className="flex items-center justify-between"><h2 className="text-lg font-black">2. {lang === 'ru' ? 'Проверьте заказ' : 'Buyurtmani tekshiring'}</h2><span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-black">{product?.name}</span></div>
            {selectedListing ? <div className="mt-5 overflow-hidden rounded-3xl bg-white/10 ring-1 ring-white/10"><div className="relative aspect-[16/9] bg-white/5">{selectedListing.image_url ? <img src={selectedListing.image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-4xl">🏠</div>}</div><div className="p-4"><div className="text-xs font-bold uppercase tracking-wider text-slate-400">{lang === 'ru' ? 'Объявление' : 'E’lon'}</div><div className="mt-1 font-black leading-5">{pickLocalized(lang, selectedListing.title, selectedListing.title_ru) || t('noName')}</div>{selectedListing.price ? <div className="mt-2 font-black text-emerald-300">{money(selectedListing.price)}</div> : null}</div></div> : <div className="mt-5 rounded-3xl border border-dashed border-white/20 bg-white/5 p-6 text-center"><div className="text-3xl">👆</div><p className="mt-3 text-sm leading-6 text-slate-300">{lang === 'ru' ? 'Выберите объявление слева.' : 'Chap tomondan e’lonni tanlang.'}</p></div>}

            {product && <div className="mt-5 border-t border-white/10 pt-5"><div className="flex items-end justify-between"><span className="text-sm text-slate-400">{t('total')}</span><b className="text-2xl">{money(product.price_uzs)}</b></div>{!order && <button type="button" disabled={submitting || !listingId} onClick={() => void createOrder()} className="mt-5 w-full rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-black text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40">{submitting ? t('creatingOrder') : t('createOrder')}</button>}</div>}

            {order && <div className="mt-5 rounded-3xl bg-white p-4 text-slate-950"><div className="font-black">{t('paymentMethod')}</div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1"><button type="button" onClick={() => void startPayment('click')} disabled={!!paying} className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-400 disabled:opacity-60"><div className="text-center font-black">Click</div><ClickLogo /></button><button type="button" onClick={() => void startPayment('payme')} disabled={!!paying} className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-emerald-400 disabled:opacity-60"><div className="text-center font-black">Payme</div><PaymeLogo /></button></div></div>}
            {pendingCheckoutUrl && <button type="button" onClick={openPendingCheckout} className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">{lang === 'ru' ? 'Открыть страницу оплаты Payme' : 'Payme to‘lov sahifasini ochish'}</button>}
            {error && <div className="mt-4 rounded-2xl bg-red-500/10 p-3 text-sm font-semibold text-red-200">{error}</div>}
          </aside>
        </section> : (
          <section className="mx-auto mt-6 max-w-3xl rounded-[2rem] bg-white p-7 shadow-sm ring-1 ring-slate-200"><h2 className="text-xl font-black">{lang === 'ru' ? 'Услуга готова к оформлению' : 'Xizmat buyurtma qilishga tayyor'}</h2><p className="mt-2 text-sm text-slate-500">{lang === 'ru' ? 'Для этого продукта выбор объявления не требуется.' : 'Bu xizmat uchun alohida e’lon tanlash shart emas.'}</p><div className="mt-6 flex items-center justify-between rounded-2xl bg-slate-50 p-5"><div><div className="font-black">{product ? pickLocalized(lang, product.name, product.name_ru) : '—'}</div><div className="mt-1 text-sm text-slate-500">{product ? money(product.price_uzs) : '—'}</div></div>{product && !order && <button type="button" disabled={submitting} onClick={() => void createOrder()} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">{submitting ? t('creatingOrder') : t('createOrder')}</button>}</div>{order && <div className="mt-5 rounded-2xl bg-slate-900 p-5 text-white"><div className="font-black">{t('paymentMethod')}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => void startPayment('click')} disabled={!!paying} className="rounded-2xl bg-white p-3 text-slate-950">Click<ClickLogo /></button><button type="button" onClick={() => void startPayment('payme')} disabled={!!paying} className="rounded-2xl bg-white p-3 text-slate-950">Payme<PaymeLogo /></button></div></div>}</section>
        )}
      </div>
    </main>
  )
}
