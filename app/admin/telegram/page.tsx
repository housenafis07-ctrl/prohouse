'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/app/components/I18nProvider'

type Audience = 'all' | 'buyers' | 'listings' | 'realtors' | 'trusted'
type Campaign = { id: string; title: string; audience: Audience; status: string; sent_count: number; failed_count: number; created_at: string }
type AudienceCounts = Record<Audience, number>

const audienceLabels = {
  all: { uz: 'Barcha Telegram foydalanuvchilari', ru: 'Все пользователи Telegram' },
  buyers: { uz: 'Xaridorlar', ru: 'Покупатели' },
  listings: { uz: "E'lon joylaganlar", ru: 'Пользователи с объявлениями' },
  realtors: { uz: 'Rieltorlar', ru: 'Риелторы' },
  trusted: { uz: 'Ishonchli hamkorlar', ru: 'Надёжные партнёры' },
} as const

const emptyCounts: AudienceCounts = { all: 0, buyers: 0, listings: 0, realtors: 0, trusted: 0 }

export default function TelegramBroadcastPage() {
  const { lang, setLang } = useI18n()
  const ru = lang === 'ru'
  const t = (uz: string, rt: string) => ru ? rt : uz
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [buttonText, setButtonText] = useState('')
  const [buttonUrl, setButtonUrl] = useState('')
  const [audience, setAudience] = useState<Audience>('all')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [audienceCounts, setAudienceCounts] = useState<AudienceCounts>(emptyCounts)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    const r = await fetch('/api/admin/telegram/broadcast', { cache: 'no-store' })
    const d = await r.json()
    if (!r.ok) setError(d.error || t('Xatolik', 'Ошибка'))
    else {
      setCampaigns(d.campaigns || [])
      setAudienceCounts({ ...emptyCounts, ...(d.audienceCounts || {}) })
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function sendTest() {
    if (!title.trim() || !message.trim()) {
      setError(t('Avval sarlavha va xabar matnini kiriting.', 'Сначала введите заголовок и текст сообщения.'))
      return
    }
    setBusy(true); setNotice(''); setError('')
    const r = await fetch('/api/admin/telegram/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test', title, message, buttonText, buttonUrl }) })
    const d = await r.json()
    if (!r.ok) setError(d.error || t('Test yuborilmadi', 'Тест не отправлен'))
    else setNotice(d.message || t('Test xabari yuborildi.', 'Тестовое сообщение отправлено.'))
    setBusy(false)
  }

  async function sendBroadcast() {
    if (!title.trim() || !message.trim()) { setError(t('Sarlavha va xabar matnini kiriting.', 'Введите заголовок и текст сообщения.')); return }
    if (buttonUrl && !buttonUrl.startsWith('https://') && !buttonUrl.startsWith('http://')) {
      setError(t('Tugma havolasi http:// yoki https:// bilan boshlanishi kerak.', 'Ссылка кнопки должна начинаться с http:// или https://.'))
      return
    }
    if (!audienceCounts[audience]) {
      setError(t('Tanlangan auditoriyada hozircha foydalanuvchi yo‘q.', 'В выбранной аудитории пока нет пользователей.'))
      return
    }
    if (!window.confirm(t(`“${title.trim()}” xabarini ${audienceCounts[audience].toLocaleString('uz-UZ')} ta foydalanuvchiga yuborishni tasdiqlaysizmi?`, `Подтвердить отправку сообщения ${audienceCounts[audience].toLocaleString('ru-RU')} пользователям?`))) return
    setBusy(true); setNotice(''); setError('')
    const r = await fetch('/api/admin/telegram/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'broadcast', title, message, buttonText, buttonUrl, audience }) })
    const d = await r.json()
    if (!r.ok) setError(d.error || t('Xabar yuborilmadi', 'Сообщение не отправлено'))
    else { setNotice(d.message || t('Kampaniya yuborildi.', 'Кампания отправлена.')); setTitle(''); setMessage(''); setButtonText(''); setButtonUrl(''); void load() }
    setBusy(false)
  }

  return <main className="min-h-screen bg-slate-50"><header className="border-b bg-white"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4"><div className="flex items-center gap-5"><Link href="/admin" className="font-black text-emerald-700">← {t('Admin', 'Админ')}</Link><b>Telegram</b></div><div className="flex items-center gap-2 rounded-xl border text-xs font-bold"><button onClick={() => setLang('uz')} className={`px-3 py-2 ${!ru ? 'bg-slate-900 text-white' : ''}`}>UZ</button><button onClick={() => setLang('ru')} className={`px-3 py-2 ${ru ? 'bg-slate-900 text-white' : ''}`}>RU</button></div></div></header><div className="mx-auto max-w-7xl px-4 py-8"><div><p className="font-bold text-emerald-600">RoyalHouse Admin</p><h1 className="mt-1 text-3xl font-black">{t('Telegram xabarlar', 'Telegram-рассылки')}</h1><p className="mt-2 text-sm text-slate-500">{t('Yangilik, yangi funksiya va muhim xabarlarni Telegram bot foydalanuvchilariga yuboring.', 'Отправляйте новости, новые функции и важные сообщения пользователям Telegram-бота.')}</p></div>{error && <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}{notice && <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div>}<div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]"><section className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black">{t('Yangi xabar', 'Новое сообщение')}</h2><div className="mt-5 space-y-4"><input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('Sarlavha', 'Заголовок')} className="w-full rounded-xl border px-4 py-3"/><textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={t('Xabar matni', 'Текст сообщения')} rows={8} className="w-full rounded-xl border px-4 py-3"/><div><label className="text-sm font-bold">{t('Auditoriya', 'Аудитория')}</label><div className="mt-2 grid gap-2 sm:grid-cols-2">{(Object.keys(audienceLabels) as Audience[]).map(key => <button key={key} type="button" onClick={() => setAudience(key)} className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left ${audience === key ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'bg-white'}`}><span className="font-bold">{ru ? audienceLabels[key].ru : audienceLabels[key].uz}</span><span className="ml-3 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{audienceCounts[key].toLocaleString(ru ? 'ru-RU' : 'uz-UZ')}</span></button>)}</div></div><div className="grid gap-4 sm:grid-cols-2"><input value={buttonText} onChange={e => setButtonText(e.target.value)} placeholder={t('Tugma matni (ixtiyoriy)', 'Текст кнопки (необязательно)')} className="rounded-xl border px-4 py-3"/><input value={buttonUrl} onChange={e => setButtonUrl(e.target.value)} placeholder="https://royalhouse.uz/..." className="rounded-xl border px-4 py-3"/></div><div className="flex flex-wrap gap-3 pt-2"><button disabled={busy} onClick={() => void sendTest()} className="rounded-xl border px-5 py-3 font-bold disabled:opacity-50">{t('🧪 Test yuborish', '🧪 Отправить тест')}</button><button disabled={busy} onClick={() => void sendBroadcast()} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-50">{t(`📨 ${audienceCounts[audience].toLocaleString(ru ? 'ru-RU' : 'uz-UZ')} ta yuborish`, `📨 Отправить ${audienceCounts[audience].toLocaleString('ru-RU')}`)}</button></div></div></section><aside className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black">{t('Telegram preview', 'Предпросмотр Telegram')}</h2><div className="mt-5 overflow-hidden rounded-2xl border bg-slate-50"><div className="border-b bg-white px-4 py-3"><b>RoyalHouse</b><div className="text-xs text-slate-400">@royalhouse_bot</div></div><div className="p-4"><div className="whitespace-pre-wrap text-sm leading-6">{title ? <b>{title}{'\n\n'}</b> : ''}{message || t('Xabar shu yerda ko‘rinadi.', 'Здесь будет отображаться сообщение.')}</div>{buttonText && <button className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white">{buttonText}</button>}</div></div></aside></div><section className="mt-6 rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black">{t('Kampaniyalar tarixi', 'История кампаний')}</h2>{loading ? <p className="mt-4 text-sm text-slate-500">{t('Yuklanmoqda...', 'Загрузка...')}</p> : !campaigns.length ? <p className="mt-4 text-sm text-slate-500">{t('Hozircha kampaniyalar yo‘q.', 'Кампаний пока нет.')}</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="p-3">{t('Sarlavha', 'Заголовок')}</th><th className="p-3">{t('Auditoriya', 'Аудитория')}</th><th className="p-3">{t('Status', 'Статус')}</th><th className="p-3">{t('Yuborildi', 'Отправлено')}</th><th className="p-3">{t('Xato', 'Ошибки')}</th></tr></thead><tbody>{campaigns.map(c => <tr key={c.id} className="border-b last:border-0"><td className="p-3 font-bold">{c.title}</td><td className="p-3">{ru ? audienceLabels[c.audience].ru : audienceLabels[c.audience].uz}</td><td className="p-3">{c.status}</td><td className="p-3">{c.sent_count}</td><td className="p-3">{c.failed_count}</td></tr>)}</tbody></table></div>}</section></div></main>
}
