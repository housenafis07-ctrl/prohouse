'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useI18n } from '@/app/components/I18nProvider'

type Product = {
  code: string
  name: string
  name_ru: string | null
  description: string | null
  description_ru: string | null
  price_uzs: number | string
  duration_days: number
  product_type: string | null
  audience: string
  unit: string
  quantity: number
  active: boolean
  updated_at: string
}
type History = {
  id: string
  product_code: string
  admin_user_id: string
  old_price_uzs: number
  new_price_uzs: number
  old_duration_days: number
  new_duration_days: number
  old_active: boolean
  new_active: boolean
  created_at: string
}
type Payload = { products: Product[]; history: History[] }
type Draft = { priceUzs: string; durationDays: string; active: boolean }

const money = (value: number | string) => new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Number(value) || 0) + ' so‘m'

export default function MonetizationPricingPage() {
  const { lang, setLang } = useI18n()
  const ru = lang === 'ru'
  const t = (uz: string, ruText: string) => ru ? ruText : uz
  const [data, setData] = useState<Payload>({ products: [], history: [] })
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/monetization-pricing', { cache: 'no-store' })
      const result = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) { window.location.href = '/admin'; return }
      if (!response.ok) throw new Error(result.error || 'Tariflarni yuklab bo‘lmadi')
      const payload = result as Payload
      setData(payload)
      setDrafts(Object.fromEntries(payload.products.map(product => [product.code, {
        priceUzs: String(Number(product.price_uzs)),
        durationDays: String(product.duration_days),
        active: product.active,
      }])))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Noma’lum xatolik')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  function change(code: string, patch: Partial<Draft>) {
    setDrafts(current => ({ ...current, [code]: { ...current[code], ...patch } }))
  }

  async function save(product: Product) {
    const draft = drafts[product.code]
    if (!draft) return
    const priceUzs = Number(draft.priceUzs)
    const durationDays = Number(draft.durationDays)
    if (!Number.isFinite(priceUzs) || priceUzs < 0 || !Number.isInteger(durationDays) || durationDays < 1) {
      setError(t('Narx yoki muddat qiymatini tekshiring.', 'Проверьте цену и срок действия.'))
      return
    }
    if (!window.confirm(t(
      product.name + ' tarifini ' + money(priceUzs) + ' va ' + durationDays + ' kunga o‘zgartirishni tasdiqlaysizmi?',
      'Подтвердить изменение тарифа «' + (product.name_ru || product.name) + '»?'
    ))) return

    setSaving(product.code)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/admin/monetization-pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: product.code, priceUzs, durationDays, active: draft.active }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Tarif saqlanmadi')
      setNotice(t('Tarif muvaffaqiyatli yangilandi. O‘zgarish tarixi saqlandi.', 'Тариф успешно обновлён. История изменений сохранена.'))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tarif saqlanmadi')
    } finally {
      setSaving(null)
    }
  }

  const grouped = data.products.reduce<Record<string, Product[]>>((acc, product) => {
    const key = product.product_type || 'other'
    acc[key] = [...(acc[key] || []), product]
    return acc
  }, {})

  return <main className="min-h-screen bg-slate-50 text-slate-950">
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/payments" className="font-black text-emerald-700">← {t('Monetizatsiya', 'Монетизация')}</Link>
          <div className="hidden h-7 w-px bg-slate-200 sm:block" />
          <div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">ROYALHOUSE · SUPER ADMIN</p><h1 className="font-black">{t('Tariflar va narxlar', 'Тарифы и цены')}</h1></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setLang('uz')} className={'rounded-lg border px-3 py-2 text-xs font-bold ' + (!ru ? 'bg-slate-950 text-white' : 'bg-white')}>UZ</button>
          <button onClick={() => setLang('ru')} className={'rounded-lg border px-3 py-2 text-xs font-bold ' + (ru ? 'bg-slate-950 text-white' : 'bg-white')}>RU</button>
          <button onClick={() => void load()} className="rounded-lg border bg-white px-3 py-2 text-sm font-bold">↻</button>
        </div>
      </div>
    </header>

    <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-50 to-white p-6 ring-1 ring-emerald-100">
        <p className="text-xs font-black uppercase tracking-widest text-emerald-700">SUPER ADMIN CONTROL</p>
        <h2 className="mt-2 text-2xl font-black sm:text-3xl">{t('Monetizatsiya tariflarini boshqarish', 'Управление тарифами монетизации')}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">{t('Narx, amal qilish muddati va tarif holatini shu yerdan o‘zgartiring. O‘zgarishlar faqat yangi buyurtmalarga qo‘llanadi; avval yaratilgan buyurtmalar narxi saqlanadi.', 'Меняйте цену, срок действия и статус тарифа. Изменения применяются только к новым заказам; цены уже созданных заказов не меняются.')}</p>
      </div>

      {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
      {loading && <div className="mt-6 rounded-2xl bg-white p-8 text-center text-sm text-slate-500">Yuklanmoqda…</div>}

      {!loading && Object.entries(grouped).map(([type, products]) => <section key={type} className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6">
        <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-emerald-600">PRODUCT GROUP</p><h3 className="mt-1 text-xl font-black">{type}</h3></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{products.length} {t('tarif', 'тарифов')}</span></div>
        <div className="grid gap-4 lg:grid-cols-2">
          {products.map(product => {
            const draft = drafts[product.code] || { priceUzs: String(product.price_uzs), durationDays: String(product.duration_days), active: product.active }
            return <article key={product.code} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><h4 className="font-black">{ru ? product.name_ru || product.name : product.name}</h4><p className="mt-1 text-xs text-slate-400">{product.code} · {product.audience} · {product.unit}</p><p className="mt-2 text-sm text-slate-500">{ru ? product.description_ru || product.description : product.description}</p></div>
                <span className={'shrink-0 rounded-full px-3 py-1 text-xs font-bold ' + (draft.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>{draft.active ? t('Faol', 'Активен') : t('O‘chiq', 'Выключен')}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="block"><span className="mb-1 block text-xs font-bold text-slate-500">{t('Narx (so‘m)', 'Цена (сум)')}</span><input type="number" min="0" max="1000000000" step="1000" value={draft.priceUzs} onChange={e => change(product.code, { priceUzs: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-3 font-bold outline-none focus:border-emerald-500" /></label>
                <label className="block"><span className="mb-1 block text-xs font-bold text-slate-500">{t('Muddat (kun)', 'Срок (дней)')}</span><input type="number" min="1" max="3650" step="1" value={draft.durationDays} onChange={e => change(product.code, { durationDays: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-3 font-bold outline-none focus:border-emerald-500" /></label>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={draft.active} onChange={e => change(product.code, { active: e.target.checked })} className="h-4 w-4 accent-emerald-600" />{t('Tarifni faollashtirish', 'Активировать тариф')}</label>
                <button onClick={() => void save(product)} disabled={saving === product.code} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving === product.code ? t('Saqlanmoqda…', 'Сохранение…') : t('Saqlash', 'Сохранить')}</button>
              </div>
            </article>
          })}
        </div>
      </section>)}

      <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6">
        <div><p className="text-xs font-black uppercase tracking-widest text-emerald-600">AUDIT LOG</p><h3 className="mt-1 text-xl font-black">{t('Narxlar o‘zgarishi tarixi', 'История изменения цен')}</h3><p className="mt-1 text-sm text-slate-500">{t('Oxirgi 30 ta o‘zgarish. Har bir yozuv superadmin va vaqt bilan qayd etiladi.', 'Последние 30 изменений с фиксацией администратора и времени.')}</p></div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b text-xs text-slate-400"><tr><th className="py-3 pr-3">{t('Tarif kodi', 'Код')}</th><th className="py-3 pr-3">{t('Eski narx', 'Старая цена')}</th><th className="py-3 pr-3">{t('Yangi narx', 'Новая цена')}</th><th className="py-3 pr-3">{t('Muddat', 'Срок')}</th><th className="py-3">{t('Sana', 'Дата')}</th></tr></thead><tbody className="divide-y">{data.history.map(row => <tr key={row.id}><td className="py-3 pr-3 font-bold">{row.product_code}</td><td className="py-3 pr-3">{money(row.old_price_uzs)}</td><td className="py-3 pr-3 font-black text-emerald-700">{money(row.new_price_uzs)}</td><td className="py-3 pr-3">{row.old_duration_days} → {row.new_duration_days} {t('kun', 'дн.')}</td><td className="py-3">{new Date(row.created_at).toLocaleString(ru ? 'ru-RU' : 'uz-UZ')}</td></tr>)}</tbody></table>
          {!data.history.length && <p className="py-6 text-center text-sm text-slate-400">{t('Hozircha o‘zgarishlar yo‘q.', 'Изменений пока нет.')}</p>}
        </div>
      </section>
    </div>
  </main>
}
