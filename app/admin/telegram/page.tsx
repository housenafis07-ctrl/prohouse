'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/app/components/I18nProvider'
import { createClient } from '@/utils/supabase/client'

type Audience = 'all' | 'buyers' | 'listings' | 'realtors' | 'trusted'
type MediaType = 'image' | 'video'
type Campaign = { id: string; title: string; audience: Audience; status: string; sent_count: number; failed_count: number; media_url?: string | null; media_type?: MediaType | null; media_name?: string | null; created_at: string }
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
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaType, setMediaType] = useState<MediaType | null>(null)
  const [mediaName, setMediaName] = useState('')
  const [mediaBusy, setMediaBusy] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [audienceCounts, setAudienceCounts] = useState<AudienceCounts>(emptyCounts)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [linkBusy, setLinkBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function syncWebhook() {
    try {
      const r = await fetch('/api/admin/telegram/webhook', { method: 'POST', cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || t('Telegram webhookni ulab bo‘lmadi.', 'Не удалось подключить Telegram webhook.'))
      return true
    } catch (e) {
      console.error('[Telegram admin] webhook sync failed', e)
      return false
    }
  }

  async function load() {
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/admin/telegram/broadcast', { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) setError(d.error || t('Xatolik', 'Ошибка'))
      else {
        setCampaigns(d.campaigns || [])
        setAudienceCounts({ ...emptyCounts, ...(d.audienceCounts || {}) })
      }
    } catch {
      setError(t('Telegram ma’lumotlarini yuklab bo‘lmadi.', 'Не удалось загрузить данные Telegram.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void (async () => { await syncWebhook(); await load() })()
  }, [])

  async function connectTelegram() {
    setLinkBusy(true); setNotice(''); setError('')
    try {
      const webhookReady = await syncWebhook()
      if (!webhookReady) {
        setError(t('Telegram webhook joriy serverga ulanmagan. Qayta urinib ko‘ring.', 'Telegram webhook не подключён к текущему серверу. Попробуйте ещё раз.'))
        return
      }
      const r = await fetch('/api/account/telegram/link', { method: 'POST' })
      const d = await r.json()
      if (!r.ok || !d.url) throw new Error(d.error || t('Telegram ulash havolasini yaratib bo‘lmadi.', 'Не удалось создать ссылку для подключения Telegram.'))
      window.open(d.url, '_blank', 'noopener,noreferrer')
      setNotice(t('Telegram oynasi ochildi. Bot ichida Start bosing.', 'Окно Telegram открыто. Нажмите Start в боте.'))
      window.setTimeout(() => { void load() }, 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Telegram ulash havolasini yaratib bo‘lmadi.', 'Не удалось создать ссылку для подключения Telegram.'))
    } finally { setLinkBusy(false) }
  }

  async function uploadMedia(file: File) {
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) { setError(t('Faqat rasm yoki video yuklash mumkin.', 'Можно загрузить только фото или видео.')); return }
    const maxBytes = isImage ? 5 * 1024 * 1024 : 20 * 1024 * 1024
    if (file.size > maxBytes) {
      setError(isImage ? t('Rasm 5 MB dan katta bo‘lmasligi kerak.', 'Фото не должно быть больше 5 МБ.') : t('Video 20 MB dan katta bo‘lmasligi kerak.', 'Видео не должно быть больше 20 МБ.'))
      return
    }

    setMediaBusy(true); setNotice(''); setError('')
    try {
      const meta = await fetch('/api/admin/telegram/media-upload-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      })
      const d = await meta.json()
      if (!meta.ok) throw new Error(d.error || t('Media yuklash havolasini yaratib bo‘lmadi.', 'Не удалось создать ссылку загрузки.'))

      const supabase = createClient()
      const { error: uploadError } = await supabase.storage.from('telegram-media').uploadToSignedUrl(d.path, d.token, file)
      if (uploadError) throw new Error(uploadError.message)

      setMediaUrl(d.url)
      setMediaType(d.mediaType)
      setMediaName(file.name)
      setNotice(t('Media yuklandi va xabarga biriktirildi.', 'Медиа загружено и прикреплено к сообщению.'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Media yuklashda xatolik.', 'Ошибка загрузки медиа.'))
    } finally { setMediaBusy(false) }
  }

  function removeMedia() {
    setMediaUrl(''); setMediaType(null); setMediaName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function sendTest() {
    if (!title.trim() || !message.trim()) { setError(t('Avval sarlavha va xabar matnini kiriting.', 'Сначала введите заголовок и текст сообщения.')); return }
    setBusy(true); setNotice(''); setError('')
    try {
      const r = await fetch('/api/admin/telegram/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test', title, message, buttonText, buttonUrl, mediaUrl, mediaType, mediaName }) })
      const d = await r.json()
      if (!r.ok) setError(d.error || t('Test yuborilmadi', 'Тест не отправлен'))
      else setNotice(d.message || t('Test xabari yuborildi.', 'Тестовое сообщение отправлено.'))
    } catch { setError(t('Test yuborishda server bilan aloqa xatosi.', 'Ошибка связи с сервером при отправке теста.')) }
    finally { setBusy(false) }
  }

  async function sendBroadcast() {
    if (!title.trim() || !message.trim()) { setError(t('Sarlavha va xabar matnini kiriting.', 'Введите заголовок и текст сообщения.')); return }
    if (buttonUrl && !/^https?:\/\//i.test(buttonUrl)) { setError(t('Tugma havolasi http:// yoki https:// bilan boshlanishi kerak.', 'Ссылка кнопки должна начинаться с http:// или https://.')); return }
    if (!audienceCounts[audience]) { setError(t('Tanlangan auditoriyada hozircha foydalanuvchi yo‘q.', 'В выбранной аудитории пока нет пользователей.')); return }
    if (!window.confirm(t(`“${title.trim()}” xabarini ${audienceCounts[audience].toLocaleString('uz-UZ')} ta foydalanuvchiga yuborishni tasdiqlaysizmi?`, `Подтвердить отправку сообщения ${audienceCounts[audience].toLocaleString('ru-RU')} пользователям?`))) return
    setBusy(true); setNotice(''); setError('')
    try {
      const r = await fetch('/api/admin/telegram/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'broadcast', title, message, buttonText, buttonUrl, audience, mediaUrl, mediaType, mediaName }) })
      const d = await r.json()
      if (!r.ok) setError(d.error || t('Xabar yuborilmadi', 'Сообщение не отправлено'))
      else {
        setNotice(d.message || t('Kampaniya yuborildi.', 'Кампания отправлена.'))
        setTitle(''); setMessage(''); setButtonText(''); setButtonUrl(''); removeMedia(); void load()
      }
    } catch { setError(t('Xabar yuborishda server bilan aloqa xatosi.', 'Ошибка связи с сервером при отправке сообщения.')) }
    finally { setBusy(false) }
  }

  return <main className="min-h-screen bg-slate-50">
    <header className="border-b bg-white"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4"><div className="flex items-center gap-5"><Link href="/admin" className="font-black text-emerald-700">← {t('Admin', 'Админ')}</Link><b>Telegram</b></div><div className="flex items-center gap-2 rounded-xl border text-xs font-bold"><button onClick={() => setLang('uz')} className={`px-3 py-2 ${!ru ? 'bg-slate-900 text-white' : ''}`}>UZ</button><button onClick={() => setLang('ru')} className={`px-3 py-2 ${ru ? 'bg-slate-900 text-white' : ''}`}>RU</button></div></div></header>
    <div className="mx-auto max-w-7xl px-4 py-8">
      <p className="font-bold text-emerald-600">RoyalHouse Admin</p><h1 className="mt-1 text-3xl font-black">{t('Telegram xabarlar', 'Telegram-рассылки')}</h1><p className="mt-2 text-sm text-slate-500">{t('Yangilik, yangi funksiya va muhim xabarlarni Telegram bot foydalanuvchilariga yuboring.', 'Отправляйте новости, новые функции и важные сообщения пользователям Telegram-бота.')}</p>
      {error && <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}{notice && <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div>}

      <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black">{t('Telegram ulanishi', 'Подключение Telegram')}</p><p className="mt-1 text-sm text-slate-500">{t('Test xabarini aynan o‘zingizning Telegram akkauntingizga yuborish uchun RoyalHouse profilingizni bot bilan bir marta ulang.', 'Чтобы тестовое сообщение пришло именно вам, один раз свяжите профиль RoyalHouse с ботом.')}</p></div><button disabled={linkBusy} onClick={() => void connectTelegram()} className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-50">{linkBusy ? t('Ulanmoqda...', 'Подключение...') : t('✈️ Telegramni ulash', '✈️ Подключить Telegram')}</button></div></div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black">{t('Yangi xabar', 'Новое сообщение')}</h2><div className="mt-5 space-y-4">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('Sarlavha', 'Заголовок')} className="w-full rounded-xl border px-4 py-3"/>
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={t('Xabar matni', 'Текст сообщения')} rows={8} className="w-full rounded-xl border px-4 py-3"/>

          <div><label className="text-sm font-bold">{t('Auditoriya', 'Аудитория')}</label><div className="mt-2 grid gap-2 sm:grid-cols-2">{(Object.keys(audienceLabels) as Audience[]).map(key => <button key={key} type="button" onClick={() => setAudience(key)} className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left ${audience === key ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'bg-white'}`}><span className="font-bold">{ru ? audienceLabels[key].ru : audienceLabels[key].uz}</span><span className="ml-3 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{audienceCounts[key].toLocaleString(ru ? 'ru-RU' : 'uz-UZ')}</span></button>)}</div></div>

          <div className="rounded-2xl border border-dashed p-4"><div className="flex flex-wrap items-center gap-3"><button type="button" disabled={mediaBusy} onClick={() => fileRef.current?.click()} className="rounded-xl border px-4 py-2 font-bold disabled:opacity-50">{mediaBusy ? t('Yuklanmoqda...', 'Загрузка...') : t('🖼️ Rasm / video qo‘shish', '🖼️ Добавить фото / видео')}</button><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void uploadMedia(file) }}/>{mediaName && <span className="text-sm font-semibold text-slate-600">{mediaName}</span>}{mediaName && <button type="button" onClick={removeMedia} className="text-sm font-bold text-red-600">{t('Olib tashlash', 'Удалить')}</button>}</div><p className="mt-2 text-xs text-slate-500">{t('Rasm: 5 MB gacha. Video: 20 MB gacha. Telegram havola orqali media yuboradi.', 'Фото: до 5 МБ. Видео: до 20 МБ. Telegram отправляет медиа по ссылке.')}</p></div>

          <div className="grid gap-4 sm:grid-cols-2"><input value={buttonText} onChange={e => setButtonText(e.target.value)} placeholder={t('Tugma matni (ixtiyoriy)', 'Текст кнопки (необязательно)')} className="rounded-xl border px-4 py-3"/><input value={buttonUrl} onChange={e => setButtonUrl(e.target.value)} placeholder="https://royalhouse.uz/..." className="rounded-xl border px-4 py-3"/></div>
          <div className="flex flex-wrap gap-3 pt-2"><button disabled={busy || mediaBusy} onClick={() => void sendTest()} className="rounded-xl border px-5 py-3 font-bold disabled:opacity-50">{t('🧪 Test yuborish', '🧪 Отправить тест')}</button><button disabled={busy || mediaBusy} onClick={() => void sendBroadcast()} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-50">{t(`📨 ${audienceCounts[audience].toLocaleString(ru ? 'ru-RU' : 'uz-UZ')} ta yuborish`, `📨 Отправить ${audienceCounts[audience].toLocaleString('ru-RU')}`)}</button></div>
        </div></section>

        <aside className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black">{t('Telegram preview', 'Предпросмотр Telegram')}</h2><div className="mt-5 overflow-hidden rounded-2xl border bg-slate-50"><div className="border-b bg-white px-4 py-3"><b>RoyalHouse</b><div className="text-xs text-slate-400">@RoyalHouseUz_bot</div></div><div className="p-4">
          {mediaUrl && mediaType === 'image' && <img src={mediaUrl} alt="" className="mb-4 max-h-72 w-full rounded-xl object-cover"/>}
          {mediaUrl && mediaType === 'video' && <video src={mediaUrl} controls className="mb-4 max-h-72 w-full rounded-xl"/>}
          <div className="whitespace-pre-wrap text-sm leading-6">{title ? <b>{title}{'\n\n'}</b> : ''}{message || t('Xabar shu yerda ko‘rinadi.', 'Здесь будет отображаться сообщение.')}</div>{buttonText && <button className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white">{buttonText}</button>}
        </div></div></aside>
      </div>

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black">{t('Kampaniyalar tarixi', 'История кампаний')}</h2>{loading ? <p className="mt-4 text-sm text-slate-500">{t('Yuklanmoqda...', 'Загрузка...')}</p> : !campaigns.length ? <p className="mt-4 text-sm text-slate-500">{t('Hozircha kampaniyalar yo‘q.', 'Кампаний пока нет.')}</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="p-3">{t('Sarlavha', 'Заголовок')}</th><th className="p-3">{t('Auditoriya', 'Аудитория')}</th><th className="p-3">{t('Media', 'Медиа')}</th><th className="p-3">{t('Status', 'Статус')}</th><th className="p-3">{t('Yuborildi', 'Отправлено')}</th><th className="p-3">{t('Xato', 'Ошибки')}</th></tr></thead><tbody>{campaigns.map(c => <tr key={c.id} className="border-b last:border-0"><td className="p-3 font-bold">{c.title}</td><td className="p-3">{ru ? audienceLabels[c.audience].ru : audienceLabels[c.audience].uz}</td><td className="p-3">{c.media_type ? (c.media_type === 'image' ? '🖼️' : '🎥') : '—'}</td><td className="p-3">{c.status}</td><td className="p-3">{c.sent_count}</td><td className="p-3">{c.failed_count}</td></tr>)}</tbody></table></div>}</section>
    </div>
  </main>
}
