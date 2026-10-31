'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { getListingImageUrl } from '@/lib/listing-image'
import { useI18n } from '@/app/components/I18nProvider'
import type { Lang } from '@/lib/i18n'

type Status = 'all' | 'draft' | 'moderation' | 'active' | 'rejected' | 'sold' | 'rented' | 'archived'

type Listing = {
  id: string
  listing_code: string
  title: string
  title_ru?: string | null
  listing_type: string
  property_type: string
  status: string
  price: number
  currency: string
  city: string
  district: string | null
  area_m2: number | null
  rooms: number | null
  floor: number | null
  floors_total: number | null
  is_trusted_seller: boolean
  updated_at: string
  moderation_note: string | null
  seller_type: string | null
  is_mortgage_available: boolean
  primary_image_url?: string | null
  promoted_until?: string | null
  promotion_badge?: string | null
  bumped_at?: string | null
  partner_listing_taxonomy?: { name_uz: string; name_ru: string | null }[] | null
}

type ListingEngagement = {
  views: number
  uniqueViews: number
  todayViews: number
  shares: number
  phoneClicks: number
  chatStarts: number
}

const emptyEngagement = (): ListingEngagement => ({
  views: 0,
  uniqueViews: 0,
  todayViews: 0,
  shares: 0,
  phoneClicks: 0,
  chatStarts: 0,
})

const money = (value: number, currency: string, lang: Lang) =>
  `${new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ').format(Number(value))} ${currency === 'USD' ? '$' : lang === 'ru' ? 'сум' : 'so‘m'}`

const LOCATION_RU: Record<string, string> = {
  Toshkent: 'Ташкент',
  'Toshkent viloyati': 'Ташкентская область',
  Yunusobod: 'Юнусабад',
  Chilonzor: 'Чиланзар',
  Sergeli: 'Сергелийский район',
  Mirobod: 'Мирабадский район',
  Yakkasaroy: 'Яккасарайский район',
  Shayxontahur: 'Шайхантахурский район',
  Olmazor: 'Алмазарский район',
  Uchtepa: 'Учтепинский район',
  Bektemir: 'Бектемирский район',
  Yangihayot: 'Янгиҳаётский район',
  'Yangiyo‘l': 'Янгиюльский район',
  "Yangiyo'l": 'Янгиюльский район',
}

const localizeLocation = (value: string | null | undefined, lang: Lang) =>
  !value ? '' : lang === 'ru' ? (LOCATION_RU[value] || value) : value

export default function MyListingsPage() {
  const router = useRouter()
  const { lang } = useI18n()
  const [items, setItems] = useState<Listing[]>([])
  const [status, setStatus] = useState<Status>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState('')
  const [usage, setUsage] = useState<{ isIndividual: boolean; used: number; freeLimit: number; remaining: number | null } | null>(null)
  const [engagement, setEngagement] = useState<Record<string, ListingEngagement>>({})
  const [shareState, setShareState] = useState<Record<string, 'idle' | 'copied'>>({})

  const text = lang === 'ru'
    ? {
        back: '← Личный кабинет', messages: '💬 Сообщения', add: '+ Разместить объявление', title: 'Мои объявления',
        sub: 'Следите за статусом объявлений. После решения администратора страница обновится автоматически.',
        loading: 'Загрузка объявлений...', emptyAll: 'У вас пока нет объявлений', empty: 'Объявлений в этом разделе нет',
        place: 'Разместить объявление', noImage: 'Нет изображения', owner: 'От владельца', mortgage: 'Доступна ипотека',
        trusted: '✓ Надёжный профиль', view: 'Открыть', edit: 'Редактировать', fix: 'Исправить и отправить повторно',
        deleteListing: 'Удалить объявление', deleteBusy: 'Удаление...', confirmDelete: 'Удалить это объявление навсегда? Это действие нельзя отменить.',
        cancel: 'Отменить', cancelBusy: 'Отмена...', saveBusy: 'Сохранение...', rented: 'Сдано', sold: 'Продано', close: 'Закрыть',
        resubmit: 'Отправить на модерацию', updated: 'Обновлено', room: 'комн.', floor: 'эт.',
        stats: 'Статистика объявления', totalViews: 'Всего просмотров', uniqueViews: 'Уникальные', todayViews: 'Сегодня', shares: 'Поделились', phone: 'Телефон', chat: 'Чат',
        share: 'Поделиться', copied: 'Ссылка скопирована',
        moderationReason: 'Причина отклонения:', moderationNote: 'Комментарий модерации:', errorLoad: 'Не удалось загрузить объявления.',
        tabs: { all: 'Все', draft: 'Черновики', moderation: 'На модерации', active: 'Активные', rejected: 'Отклонённые', sold: 'Проданные', rented: 'Сданные', archived: 'Архив' },
        property: { apartment: 'Квартира', house: 'Частный дом', land: 'Земельный участок', commercial: 'Коммерческая недвижимость', new_building: 'Новостройка' } as Record<string, string>,
      }
    : {
        back: '← Shaxsiy kabinet', messages: '💬 Xabarlar', add: '+ E’lon joylashtirish', title: 'Mening e’lonlarim',
        sub: 'E’lonlaringiz holatini kuzating. Admin qarori berilganda sahifa avtomatik yangilanadi.',
        loading: 'E’lonlar yuklanmoqda...', emptyAll: 'Hali e’lonlaringiz yo‘q', empty: 'Bu bo‘limda e’lonlar yo‘q',
        place: 'E’lon joylashtirish', noImage: 'Rasm yo‘q', owner: 'Egadan', mortgage: 'Ipotekaga mumkin',
        trusted: '✓ Ishonchli profil', view: 'Ko‘rish', edit: 'Tahrirlash', fix: 'Tuzatish va qayta yuborish',
        deleteListing: 'E’lonni o‘chirish', deleteBusy: 'O‘chirilmoqda...', confirmDelete: 'Bu e’lon butunlay o‘chiriladi. Davom etishni xohlaysizmi?',
        cancel: 'Bekor qilish', cancelBusy: 'Bekor qilinmoqda...', saveBusy: 'Saqlanmoqda...', rented: 'Ijaraga berildi', sold: 'Sotildi', close: 'Yopish',
        resubmit: 'Qayta moderatsiyaga yuborish', updated: 'Yangilangan', room: 'xona', floor: 'qavat',
        stats: 'E’lon statistikasi', totalViews: 'Jami ko‘rish', uniqueViews: 'Noyob ko‘rish', todayViews: 'Bugun', shares: 'Ulashish', phone: 'Telefon', chat: 'Chat',
        share: 'Ulashish', copied: 'Havola nusxalandi',
        moderationReason: 'Rad etish sababi:', moderationNote: 'Moderatsiya izohi:', errorLoad: 'E’lonlarni yuklab bo‘lmadi.',
        tabs: { all: 'Barchasi', draft: 'Qoralama', moderation: 'Moderatsiyada', active: 'Faol', rejected: 'Rad etilgan', sold: 'Sotilgan', rented: 'Ijaraga berilgan', archived: 'Arxiv' },
        property: { apartment: 'Kvartira', house: 'Xususiy uy', land: 'Yer uchastkasi', commercial: 'Tijorat mulki', new_building: 'Yangi bino' } as Record<string, string>,
      }

  const statusMeta: Record<Exclude<Status, 'all'>, { label: string }> = {
    draft: { label: text.tabs.draft }, moderation: { label: text.tabs.moderation }, active: { label: text.tabs.active },
    rejected: { label: text.tabs.rejected }, sold: { label: text.tabs.sold }, rented: { label: text.tabs.rented }, archived: { label: text.tabs.archived },
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const db = createClient()
    // Use the same phone-backed session as the cabinet profile and stats APIs.
    // Browser Supabase auth can point at a legacy user and incorrectly show an empty list.
    const [profileResponse, listingsResponse] = await Promise.all([
      fetch('/api/account/profile', { cache: 'no-store', credentials: 'same-origin' }),
      fetch('/api/account/listings', { cache: 'no-store', credentials: 'same-origin' }),
    ])
    const profileResult = await profileResponse.json().catch(() => ({}))
    const listingsResult = await listingsResponse.json().catch(() => ({}))
    if (profileResponse.status === 401 || listingsResponse.status === 401) {
      router.replace('/account/login?next=%2Faccount%2Flistings')
      return
    }
    if (!profileResponse.ok || !listingsResponse.ok) {
      setError(listingsResult.error || profileResult.error || text.errorLoad)
      setItems([])
      setLoading(false)
      return
    }
    const profile = profileResult.profile
    const listingRows = (listingsResult.listings || []) as Listing[]
    setItems(listingRows)

    const nextEngagement: Record<string, ListingEngagement> = {}
    listingRows.forEach(item => { nextEngagement[item.id] = emptyEngagement() })

    if (listingRows.length > 0) {
      const { data: events, error: eventsError } = await db
        .from('listing_events')
        .select('listing_id,event_type,user_id,session_id,created_at')
        .in('listing_id', listingRows.map(item => item.id))
        .in('event_type', ['view', 'share', 'phone_click', 'chat_start'])

      if (!eventsError) {
        const uniqueByListing: Record<string, Set<string>> = {}
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        for (const event of events || []) {
          if (!nextEngagement[event.listing_id]) nextEngagement[event.listing_id] = emptyEngagement()
          const stats = nextEngagement[event.listing_id]

          if (event.event_type === 'view') {
            stats.views += 1
            if (!uniqueByListing[event.listing_id]) uniqueByListing[event.listing_id] = new Set<string>()
            const key = event.session_id || (event.user_id ? `user:${event.user_id}` : `event:${event.created_at}`)
            uniqueByListing[event.listing_id].add(key)
            if (new Date(event.created_at) >= todayStart) stats.todayViews += 1
          } else if (event.event_type === 'share') stats.shares += 1
          else if (event.event_type === 'phone_click') stats.phoneClicks += 1
          else if (event.event_type === 'chat_start') stats.chatStarts += 1
        }

        Object.entries(uniqueByListing).forEach(([id, keys]) => {
          if (nextEngagement[id]) nextEngagement[id].uniqueViews = keys.size
        })
      }
    }

    setEngagement(nextEngagement)

    if (profile?.account_type === 'individual') {
      const r = await fetch('/api/monetization/usage')
      if (r.ok) setUsage(await r.json())
    } else {
      setUsage(null)
    }
    setLoading(false)
  }, [router, text.errorLoad])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null
    let cancelled = false
    ;(async () => {
      const db = createClient()
      const { data: { user } } = await db.auth.getUser()
      if (!user || cancelled) return
      channel = db.channel('owner-listings-' + user.id).on('postgres_changes', { event: '*', schema: 'public', table: 'listings', filter: 'owner_id=eq.' + user.id }, () => { void load() }).subscribe()
    })()
    return () => {
      cancelled = true
      if (channel) void createClient().removeChannel(channel)
    }
  }, [load])

  const counts = useMemo(() => {
    const r: Record<Status, number> = { all: 0, draft: 0, moderation: 0, active: 0, rejected: 0, sold: 0, rented: 0, archived: 0 }
    items.forEach(i => {
      if (i.status === 'archived') r.archived++
      else if (i.status in r) r[i.status as Status]++
    })
    r.all = r.draft + r.moderation + r.active + r.rejected + r.sold + r.rented
    return r
  }, [items])

  const visible = useMemo(() => status === 'all' ? items.filter(i => i.status !== 'archived') : items.filter(i => i.status === status), [items, status])

  const changeStatus = async (id: string, next: 'sold' | 'rented' | 'archived') => {
    setActionId(id); setError('')
    const db = createClient()
    const { data, error: e } = await db.rpc('transition_owner_listing_status', { p_listing_id: id, p_next_status: next })
    if (e) setError(e.message)
    else if (data) await load()
    setActionId('')
  }

  const cancelListing = async (id: string) => {
    if (!window.confirm(text.confirmDelete)) return
    setActionId(id); setError('')
    try {
      const r = await fetch('/api/listings/draft?listingId=' + encodeURIComponent(id), { method: 'DELETE' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || text.deleteListing)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : text.deleteListing)
    } finally { setActionId('') }
  }

  const reopen = async (id: string) => {
    setActionId(id); setError('')
    const db = createClient()
    const { data, error: e } = await db.rpc('transition_owner_listing_status', { p_listing_id: id, p_next_status: 'moderation' })
    if (e) setError(e.message)
    else if (data) await load()
    setActionId('')
  }

  const shareListing = async (id: string, title: string) => {
    const url = `${window.location.origin}/listings/${encodeURIComponent(id)}`
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        setShareState(current => ({ ...current, [id]: 'copied' }))
        window.setTimeout(() => setShareState(current => ({ ...current, [id]: 'idle' })), 1800)
      } else {
        const input = document.createElement('input')
        input.value = url
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        input.remove()
        setShareState(current => ({ ...current, [id]: 'copied' }))
        window.setTimeout(() => setShareState(current => ({ ...current, [id]: 'idle' })), 1800)
      }

      void fetch('/api/listings/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: id, action: 'share' }),
        keepalive: true,
      }).catch(() => {})

      setEngagement(current => ({
        ...current,
        [id]: { ...(current[id] || emptyEngagement()), shares: (current[id]?.shares || 0) + 1 },
      }))
    } catch {
      // The native share sheet can be dismissed by the user; do not count a cancelled share.
    }
  }

  const viewHref = (id: string) => '/account/listings/' + id + '/view'
  const editHref = (id: string) => '/account/listings/' + id + '/edit'

  return <main className="min-h-screen w-full min-w-0 bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-16 w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2"><div className="flex items-center gap-2"><Link href="/account" className="text-sm font-extrabold text-emerald-700">{text.back}</Link><Link href="/chat" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold">{text.messages}</Link></div><Link href="/listings/new" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">{text.add}</Link></div></header>
    <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-7 sm:py-10"><h1 className="text-3xl font-black">{text.title}</h1><p className="mt-2 text-sm text-slate-500">{text.sub}</p>
      {usage?.isIndividual && <div className="mt-5 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm"><p className="text-sm font-bold">{usage.used}/{usage.freeLimit}</p></div>}
      {error && <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}
      <div className="mt-7 grid min-w-0 grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 sm:grid-cols-4 lg:grid-cols-8">{(['all','draft','moderation','active','rejected','sold','rented','archived'] as Status[]).map(key => <button type="button" key={key} onClick={() => setStatus(key)} className={'min-w-0 break-words rounded-xl px-2 py-3 text-left ' + (status === key ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50')}><span className="block text-sm font-extrabold">{key === 'all' ? text.tabs.all : statusMeta[key].label}</span><span className="text-xs text-slate-400">{counts[key]}</span></button>)}</div>
      {loading ? <div className="mt-5 rounded-3xl bg-white p-10 text-center text-slate-500">{text.loading}</div> : visible.length === 0 ? <div className="mt-5 rounded-3xl bg-white p-10 text-center"><div className="text-4xl">⌂</div><h2 className="mt-3 break-words text-lg font-black sm:text-xl">{status === 'all' ? text.emptyAll : statusMeta[status].label + ' — ' + text.empty}</h2><Link href="/listings/new" className="mt-5 inline-flex rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">{text.place}</Link></div> : <div className="mt-5 space-y-4">{visible.map(item => {
        const image = item.primary_image_url ? getListingImageUrl(item.primary_image_url, 'thumbnail') : undefined
        const taxonomyName = lang === 'ru' ? (item.partner_listing_taxonomy?.[0]?.name_ru || item.partner_listing_taxonomy?.[0]?.name_uz) : item.partner_listing_taxonomy?.[0]?.name_uz
        const promotionUntil = item.promoted_until ? new Date(item.promoted_until) : null
        const promotionActive = !!promotionUntil && promotionUntil.getTime() > Date.now()
        const bumpActive = !!item.bumped_at && new Date(item.bumped_at).getTime() > Date.now() - 86400000
        const badge = promotionActive ? (item.promotion_badge || 'TOP') : bumpActive ? 'UP' : null
        const stats = engagement[item.id] || emptyEngagement()
        const shareLabel = shareState[item.id] === 'copied' ? text.copied : text.share
        return <article key={item.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="grid min-w-0 md:grid-cols-[220px_minmax(0,1fr)]"><div className="h-52 bg-slate-100 md:h-full">{image ? <img src={image} alt={item.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">{text.noImage}</div>}</div><div className="min-w-0 p-4 sm:p-6">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{statusMeta[item.status as Exclude<Status,'all'>]?.label || item.status}</span>{item.seller_type === 'owner' && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{text.owner}</span>}{item.is_mortgage_available && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{text.mortgage}</span>}{item.is_trusted_seller && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{text.trusted}</span>}{badge && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{badge}</span>}</div><h2 className="mt-3 text-xl font-black">{lang === 'ru' ? (item.title_ru || item.title) : item.title}</h2><p className="mt-1 text-xs text-slate-400">{item.listing_code}{taxonomyName ? ' · ' + taxonomyName : ''}</p></div><p className="max-w-full break-words text-lg font-black text-emerald-600 sm:text-xl">{money(item.price, item.currency, lang)}</p></div>
          <div className="mt-4 flex min-w-0 flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500"><span>{text.property[item.property_type] || item.property_type}</span>{item.area_m2 != null && <span>{item.area_m2} m²</span>}{item.rooms != null && <span>{item.rooms} {text.room}</span>}{item.property_type === 'apartment' && item.floor != null && <span>{item.floor}{item.floors_total != null ? '/' + item.floors_total : ''} {text.floor}</span>}<span>{localizeLocation(item.city, lang)}{item.district ? ', ' + localizeLocation(item.district, lang) : ''}</span></div>
          <section className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-black text-slate-900">📊 {text.stats}</h3>
              <button type="button" onClick={() => void shareListing(item.id, lang === 'ru' ? (item.title_ru || item.title) : item.title)} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-extrabold text-emerald-700 shadow-sm transition hover:bg-emerald-50 active:scale-[.98]">
                <span aria-hidden="true">↗</span>{shareLabel}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <StatItem icon="👁" label={text.totalViews} value={stats.views} />
              <StatItem icon="👤" label={text.uniqueViews} value={stats.uniqueViews} />
              <StatItem icon="📈" label={text.todayViews} value={stats.todayViews} />
              <StatItem icon="↗" label={text.shares} value={stats.shares} />
              <StatItem icon="☎" label={text.phone} value={stats.phoneClicks} />
              <StatItem icon="💬" label={text.chat} value={stats.chatStarts} />
            </div>
          </section>
          {item.moderation_note && <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm"><b>{item.status === 'rejected' ? text.moderationReason : text.moderationNote}</b> {item.moderation_note}</div>}
          <div className="mt-5 flex min-w-0 flex-wrap gap-2"><Link href={viewHref(item.id)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">{text.view}</Link>{(item.status === 'draft' || item.status === 'moderation' || item.status === 'active' || item.status === 'rejected') && <Link href={editHref(item.id)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">{item.status === 'rejected' ? text.fix : text.edit}</Link>}<button type="button" disabled={actionId === item.id} onClick={() => void cancelListing(item.id)} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700">{actionId === item.id ? text.deleteBusy : text.deleteListing}</button>{item.status === 'active' && <><button type="button" disabled={actionId === item.id} onClick={() => void changeStatus(item.id, item.listing_type === 'rent' || item.listing_type === 'daily' ? 'rented' : 'sold')} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white">{actionId === item.id ? text.saveBusy : item.listing_type === 'rent' || item.listing_type === 'daily' ? text.rented : text.sold}</button><button type="button" disabled={actionId === item.id} onClick={() => void changeStatus(item.id, 'archived')} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">{text.close}</button></>}{(item.status === 'sold' || item.status === 'rented' || item.status === 'archived') && <button type="button" onClick={() => void reopen(item.id)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold">{text.resubmit}</button>}</div>
          <p className="mt-4 text-xs text-slate-400">{text.updated}: {new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.updated_at))}</p>
        </div></div></article>
      })}</div>}
    </div>
  </main>
}

function StatItem({ icon, label, value }: { icon: string; label: string; value: number }) {
  return <div className="rounded-xl bg-white p-3 shadow-sm">
    <div className="flex items-center gap-1 text-xs text-slate-400"><span aria-hidden="true">{icon}</span>{label}</div>
    <b className="mt-1 block text-lg font-black text-slate-900">{value.toLocaleString('uz-UZ')}</b>
  </div>
}
