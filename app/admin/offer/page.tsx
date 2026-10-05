'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/app/components/I18nProvider'

type Offer = { id:string; version:number; title:string; content:string; is_active:boolean; created_at:string }

export default function OfferAdminPage() {
  const { lang, setLang } = useI18n()
  const ru = lang === 'ru'
  const t = (uz: string, ruText: string) => ru ? ruText : uz
  const [offers, setOffers] = useState<Offer[]>([])
  const [title, setTitle] = useState('Ommaviy oferta')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)

  async function load() {
    setLoading(true)
    setMessage('')
    try {
      const me = await fetch('/api/admin/me', { cache: 'no-store' })
      if (!me.ok) throw new Error(t('Admin sifatida kirish talab qilinadi.','Требуется вход в систему как администратор.'))
      const admin = await me.json()
      if (admin.role !== 'super_admin') throw new Error(t('Oferta boshqaruvi faqat bosh admin uchun.','Управление офертой доступно только главному администратору.'))
      const res = await fetch('/api/admin/offer', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('Oferta yuklanmadi','Не удалось загрузить оферту'))
      setOffers(data.offers || [])
      const active = (data.offers || []).find((item:Offer) => item.is_active)
      if (active) { setTitle(active.title); setContent(active.content) }
      setLoggedIn(true)
    } catch (e) {
      setLoggedIn(false)
      setMessage(e instanceof Error ? e.message : t('Xatolik','Ошибка'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function save() {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/offer', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ title, content })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('Saqlashda xatolik','Ошибка сохранения'))
      setOffers(prev => [data.offer, ...prev.map(o => ({ ...o, is_active:false }))])
      setMessage(`${t('Oferta ','Оферта ')}${data.offer.version}${t('-versiya sifatida saqlandi.',' сохранена как версия.')}`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('Saqlashda xatolik','Ошибка сохранения'))
    } finally {
      setLoading(false)
    }
  }

  if (!loggedIn) return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm sm:p-8"><Link href="/" className="text-sm font-semibold text-emerald-700">← Royalhouse</Link><h1 className="mt-6 text-2xl font-extrabold text-slate-900">Admin panel — {t('Ommaviy oferta','Публичная оферта')}</h1><p className="mt-2 text-sm text-slate-500">{message || t('Tekshirilmoqda...','Проверка...')}</p>{message && <Link href="/admin" className="mt-5 inline-block rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">{t('Admin panelga qaytish','Вернуться в панель администратора')}</Link>}</div></main>

  const active = offers.find(o=>o.is_active)
  return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-4xl"><div className="flex items-center justify-between gap-4"><div><Link href="/admin" className="text-sm font-semibold text-emerald-700">← {t('Admin','Админ')}</Link><h1 className="mt-3 text-3xl font-extrabold text-slate-900">{t('Ommaviy oferta','Публичная оферта')}</h1><p className="mt-1 text-sm text-slate-500">{t('Foydalanuvchilarga ko‘rsatiladigan oferta matnini boshqaring.','Управляйте текстом оферты, который отображается пользователям.')}</p></div><div className="flex items-center gap-3"><div className="flex overflow-hidden rounded-xl border text-xs font-bold"><button type="button" onClick={()=>setLang('uz')} className={`px-3 py-2 ${!ru?'bg-slate-900 text-white':''}`}>UZ</button><button type="button" onClick={()=>setLang('ru')} className={`px-3 py-2 ${ru?'bg-slate-900 text-white':''}`}>RU</button></div><button onClick={async()=>{await fetch('/api/admin/logout',{method:'POST'});location.href='/admin/login'}} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">{t('Chiqish','Выйти')}</button></div></div><section className="mt-7 rounded-3xl bg-white p-6 shadow-sm"><div className="grid gap-5"><div><label className="mb-2 block text-sm font-semibold">{t('Sarlavha','Заголовок')}</label><input value={title} onChange={e=>setTitle(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div><div><label className="mb-2 block text-sm font-semibold">{t('Oferta matni','Текст оферты')}</label><textarea value={content} onChange={e=>setContent(e.target.value)} rows={24} className="w-full rounded-2xl border border-slate-200 px-4 py-4 font-mono text-sm leading-6" placeholder={t("Ommaviy oferta shartlarini shu yerga kiriting...","Введите сюда условия публичной оферты...")}/></div><div className="flex items-center justify-between gap-4"><div className="text-sm text-slate-500">{active ? `${t('Amaldagi versiya: ','Текущая версия: ')}${active.version}` : t('Amaldagi oferta yo‘q','Нет действующей оферты')}</div><button onClick={save} disabled={loading || !content.trim()} className="rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white disabled:opacity-50">{loading ? t('Saqlanmoqda...','Сохранение...') : t('Saqlash','Сохранить')}</button></div>{message && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}</div></section><section className="mt-6 rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-lg font-bold">{t('Versiyalar tarixi','История версий')}</h2><div className="mt-4 divide-y divide-slate-100">{offers.map(o=><div key={o.id} className="flex items-center justify-between gap-4 py-3 text-sm"><div><span className="font-semibold">{t('Versiya ','Версия ')}{o.version}</span>{o.is_active && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{t('Amaldagi','Действующая')}</span>}</div><span className="text-slate-400">{new Date(o.created_at).toLocaleString(ru ? 'ru-RU' : 'uz-UZ')}</span></div>)}</div></section></div></main>
}
