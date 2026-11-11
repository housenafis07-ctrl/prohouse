'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/app/components/I18nProvider'
import { createClient } from '@/utils/supabase/client'

type Audience = 'all' | 'buyers' | 'listings' | 'realtors' | 'trusted'
type MediaType = 'image' | 'video'
type Destination = 'bot' | 'channel'
type DashboardStats = { optedInUsers: number; campaigns: number; sent: number; failed: number; channelPosts: number; botCampaigns: number }
type TestRecipient = { telegramUserId: string; label: string; phone: string | null; username: string | null; lastInteractionAt: string }
type Campaign = { id: string; title: string; audience: Audience; destination?: Destination; status: string; sent_count: number; failed_count: number; media_url?: string | null; media_type?: MediaType | null; media_name?: string | null; created_at: string; scheduled_at?: string | null; scheduled_timezone?: string | null }
type AudienceCounts = Record<Audience, number>

const audienceLabels = {
  all: { uz: 'Barcha Telegram foydalanuvchilari', ru: 'Все пользователи Telegram' },
  buyers: { uz: 'Xaridorlar', ru: 'Покупатели' },
  listings: { uz: "E'lon joylaganlar", ru: 'Пользователи с объявлениями' },
  realtors: { uz: 'Rieltorlar', ru: 'Риелторы' },
  trusted: { uz: 'Ishonchli hamkorlar', ru: 'Надёжные партнёры' },
} as const

const emptyCounts: AudienceCounts = { all: 0, buyers: 0, listings: 0, realtors: 0, trusted: 0 }

function tashkentDateTimeInput(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
}

export default function TelegramBroadcastPage() {
  const { lang, setLang } = useI18n()
  const ru = lang === 'ru'
  const t = (uz: string, rt: string) => ru ? rt : uz
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [buttonText, setButtonText] = useState('')
  const [buttonUrl, setButtonUrl] = useState('')
  const [audience, setAudience] = useState<Audience>('all')
  const [scheduledAt, setScheduledAt] = useState(() => tashkentDateTimeInput(new Date(Date.now() + 60 * 60 * 1000)))
  const [destination, setDestination] = useState<Destination>('bot')
  const [stats, setStats] = useState<DashboardStats>({ optedInUsers: 0, campaigns: 0, sent: 0, failed: 0, channelPosts: 0, botCampaigns: 0 })
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaType, setMediaType] = useState<MediaType | null>(null)
  const [mediaName, setMediaName] = useState('')
  const [mediaBusy, setMediaBusy] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [audienceCounts, setAudienceCounts] = useState<AudienceCounts>(emptyCounts)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [testRecipients, setTestRecipients] = useState<TestRecipient[]>([])
  const [selectedTestRecipient, setSelectedTestRecipient] = useState('')
  const [testRecipientError, setTestRecipientError] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [schemaNotice, setSchemaNotice] = useState('')
  const [aiObjective, setAiObjective] = useState('')
  const [aiFacts, setAiFacts] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)
  const [aiError, setAiError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    setError('')
    setSchemaNotice('')
    setTestRecipientError('')
    try {
      const [r, recipientsResponse] = await Promise.all([
        fetch('/api/admin/telegram/broadcast', { cache: 'no-store' }),
        fetch('/api/admin/telegram/test-recipients', { cache: 'no-store' }),
      ])
      const [d, recipientData] = await Promise.all([
        r.json(),
        recipientsResponse.json().catch(() => ({})),
      ])
      if (!r.ok) setError(d.error || t('Xatolik', 'Ошибка'))
      else {
        setSchemaNotice(d.schemaNotice || '')
        setCampaigns(d.campaigns || [])
        setAudienceCounts({ ...emptyCounts, ...(d.audienceCounts || {}) })
        setStats({ optedInUsers: 0, campaigns: 0, sent: 0, failed: 0, channelPosts: 0, botCampaigns: 0, ...(d.stats || {}) })
      }
      if (!recipientsResponse.ok) {
        setTestRecipients([])
        setSelectedTestRecipient('')
        setTestRecipientError(recipientData.error || t('Test mijozlari ro‘yxatini yuklab bo‘lmadi.', 'Не удалось загрузить список тестовых клиентов.'))
      } else {
        const rows = (recipientData.recipients || []) as TestRecipient[]
        setTestRecipients(rows)
        setSelectedTestRecipient(current => rows.some(row => row.telegramUserId === current) ? current : rows[0]?.telegramUserId || '')
      }
    } catch {
      setError(t('Telegram ma’lumotlarini yuklab bo‘lmadi.', 'Не удалось загрузить данные Telegram.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

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


  async function runMarketingAi(task: 'generate' | 'analyze') {
    setAiBusy(true); setAiError(''); setAiResult(null)
    try {
      const response = await fetch('/api/admin/telegram/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, objective: aiObjective, campaignFacts: aiFacts, language: ru ? 'ru' : 'uz', destination }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || t('AI so‘rovi bajarilmadi.', 'Не удалось выполнить запрос AI.'))
      setAiResult({ task, ...data.result })
      if (task === 'generate') {
        setTitle(data.result.title || '')
        setMessage(data.result.message || '')
        setButtonText(data.result.buttonText || '')
        setButtonUrl(data.result.buttonUrl || '')
        if (destination === 'bot' && data.result.recommendedAudience) setAudience(data.result.recommendedAudience)
        if (data.result.recommendedAtLocal) setScheduledAt(data.result.recommendedAtLocal)
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : t('AI xatosi.', 'Ошибка AI.'))
    } finally { setAiBusy(false) }
  }

  async function sendTest() {
    if (!title.trim() || !message.trim()) { setError(t('Avval sarlavha va xabar matnini kiriting.', 'Сначала введите заголовок и текст сообщения.')); return }
    setBusy(true); setNotice(''); setError('')
    try {
      if (!selectedTestRecipient) throw new Error(t('Avval test uchun rozilik bergan mijozni tanlang.', 'Сначала выберите клиента, давшего согласие на маркетинговые сообщения.'))
      const r = await fetch('/api/admin/telegram/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test_client', recipientTelegramId: selectedTestRecipient, destination, title, message, buttonText, buttonUrl, mediaUrl, mediaType, mediaName }) })
      const d = await r.json()
      if (!r.ok) setError(d.error || t('Test yuborilmadi', 'Тест не отправлен'))
      else setNotice(d.message || t('Test xabari yuborildi.', 'Тестовое сообщение отправлено.'))
    } catch { setError(t('Test yuborishda server bilan aloqa xatosi.', 'Ошибка связи с сервером при отправке теста.')) }
    finally { setBusy(false) }
  }

  async function scheduleBroadcast() {
    if (!title.trim() || !message.trim()) { setError(t('Sarlavha va xabar matnini kiriting.', 'Введите заголовок и текст сообщения.')); return }
    if (buttonUrl && !/^https?:\/\//i.test(buttonUrl)) { setError(t('Tugma havolasi http:// yoki https:// bilan boshlanishi kerak.', 'Ссылка кнопки должна начинаться с http:// или https://.')); return }
    if (destination === 'bot' && !audienceCounts[audience]) { setError(t('Tanlangan auditoriyada hozircha foydalanuvchi yo‘q.', 'В выбранной аудитории пока нет пользователей.')); return }
    if (!scheduledAt) { setError(t('Yuborish sanasi va vaqtini tanlang.', 'Выберите дату и время отправки.')); return }
    if (!window.confirm(t(`“${title.trim()}” kampaniyasini ${scheduledAt.replace('T', ' ')} (Toshkent vaqti) uchun rejalashtirasizmi?`, `Запланировать кампанию “${title.trim()}” на ${scheduledAt.replace('T', ' ')} (время Ташкента)?`))) return
    setBusy(true); setNotice(''); setError('')
    try {
      const r = await fetch('/api/admin/telegram/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'schedule', destination, title, message, buttonText, buttonUrl, audience, mediaUrl, mediaType, mediaName, scheduledAt }) })
      const d = await r.json()
      if (!r.ok) setError(d.error || t('Kampaniyani rejalashtirib bo‘lmadi.', 'Не удалось запланировать кампанию.'))
      else {
        setNotice(d.message || t('Kampaniya rejalashtirildi.', 'Кампания запланирована.'))
        void load()
      }
    } catch { setError(t('Rejalashtirishda server bilan aloqa xatosi.', 'Ошибка связи с сервером при планировании.')) }
    finally { setBusy(false) }
  }

  async function cancelScheduledCampaign(campaignId: string) {
    if (!window.confirm(t('Rejalashtirilgan kampaniyani bekor qilasizmi?', 'Отменить запланированную кампанию?'))) return
    setBusy(true); setNotice(''); setError('')
    try {
      const r = await fetch('/api/admin/telegram/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel', campaignId }) })
      const d = await r.json()
      if (!r.ok) setError(d.error || t('Kampaniyani bekor qilib bo‘lmadi.', 'Не удалось отменить кампанию.'))
      else { setNotice(d.message || t('Kampaniya bekor qilindi.', 'Кампания отменена.')); void load() }
    } catch { setError(t('Bekor qilishda server bilan aloqa xatosi.', 'Ошибка связи с сервером при отмене.')) }
    finally { setBusy(false) }
  }

  async function sendBroadcast() {
    if (!title.trim() || !message.trim()) { setError(t('Sarlavha va xabar matnini kiriting.', 'Введите заголовок и текст сообщения.')); return }
    if (buttonUrl && !/^https?:\/\//i.test(buttonUrl)) { setError(t('Tugma havolasi http:// yoki https:// bilan boshlanishi kerak.', 'Ссылка кнопки должна начинаться с http:// или https://.')); return }
    if (destination === 'bot' && !audienceCounts[audience]) { setError(t('Tanlangan auditoriyada hozircha foydalanuvchi yo‘q.', 'В выбранной аудитории пока нет пользователей.')); return }
    if (!window.confirm(destination === 'channel' ? t(`“${title.trim()}” xabarini @royal_house_uz kanaliga joylashni tasdiqlaysizmi?`, `Подтвердить публикацию “${title.trim()}” в канале @royal_house_uz?`) : t(`“${title.trim()}” xabarini ${audienceCounts[audience].toLocaleString('uz-UZ')} ta foydalanuvchiga yuborishni tasdiqlaysizmi?`, `Подтвердить отправку сообщения ${audienceCounts[audience].toLocaleString('ru-RU')} пользователям?`))) return
    setBusy(true); setNotice(''); setError('')
    try {
      const r = await fetch('/api/admin/telegram/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'broadcast', destination, title, message, buttonText, buttonUrl, audience, mediaUrl, mediaType, mediaName }) })
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
      {error && <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}{schemaNotice && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{schemaNotice}</div>}{notice && <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div>}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[
        [t('Oferta asosida marketing xabari olish huquqiga ega', 'Право на маркетинговые сообщения по оферте'), stats.optedInUsers],
        [t('Oxirgi 50 kampaniya', 'Последние 50 кампаний'), stats.campaigns],
        [t('Oxirgi 50 kampaniya: yuborildi', 'Последние 50 кампаний: отправлено'), stats.sent],
        [t('Oxirgi 50 kampaniya: xato', 'Последние 50 кампаний: ошибки'), stats.failed],
        [t('Bot kampaniyalari', 'Кампании бота'), stats.botCampaigns],
        [t('Kanal postlari', 'Публикации канала'), stats.channelPosts],
      ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-black tabular-nums">{Number(value).toLocaleString(ru ? 'ru-RU' : 'uz-UZ')}</p></div>)}</section>


      <section className="mt-6 rounded-3xl border border-violet-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-black text-violet-700">✨ RoyalHouse AI Marketing</p><p className="mt-1 text-sm text-slate-500">{t('Matn yaratish, auditoriya va vaqt tavsiyasi hamda kampaniya tahlili. AI hech qachon o‘zi yubormaydi.', 'Создание текста, рекомендации по аудитории и времени, анализ кампаний. AI ничего не отправляет самостоятельно.')}</p></div><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">{t('Faqat tavsiya', 'Только рекомендации')}</span></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2"><textarea value={aiObjective} onChange={e => setAiObjective(e.target.value)} rows={3} placeholder={t('Kampaniya maqsadi: masalan, yangi e’lon beruvchilarni jalb qilish...', 'Цель кампании: например, привлечь новых рекламодателей...')} className="w-full rounded-xl border px-4 py-3"/><textarea value={aiFacts} onChange={e => setAiFacts(e.target.value)} rows={3} placeholder={t('Tasdiqlangan faktlar: aksiya, muddat, narx, havola (ixtiyoriy)...', 'Подтверждённые факты: акция, срок, цена, ссылка (необязательно)...')} className="w-full rounded-xl border px-4 py-3"/></div>
        <div className="mt-3 flex flex-wrap gap-2"><button disabled={aiBusy || !aiObjective.trim()} onClick={() => void runMarketingAi('generate')} className="rounded-xl bg-violet-600 px-4 py-2.5 font-bold text-white disabled:opacity-50">{aiBusy ? t('AI ishlayapti...', 'AI работает...') : t('✨ AI bilan yaratish', '✨ Создать с AI')}</button><button disabled={aiBusy || loading} onClick={() => void runMarketingAi('analyze')} className="rounded-xl border border-violet-300 px-4 py-2.5 font-bold text-violet-700 disabled:opacity-50">{t('📊 AI tahlil', '📊 AI-анализ')}</button></div>
        {aiError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{aiError}</p>}
        {aiResult && <div className="mt-4 rounded-2xl bg-violet-50 p-4 text-sm">
          {aiResult.task === 'generate' ? <><p className="font-black text-violet-900">{t('AI tavsiyalari', 'Рекомендации AI')}</p><p className="mt-2"><b>{t('Auditoriya:', 'Аудитория:')}</b> {audienceLabels[aiResult.recommendedAudience as Audience]?.[ru ? 'ru' : 'uz'] || aiResult.recommendedAudience}</p><p className="mt-1"><b>{t('Yuborish vaqti:', 'Время отправки:')}</b> {aiResult.recommendedTime}</p>{aiResult.recommendedAtLocal && <button type="button" onClick={() => setScheduledAt(aiResult.recommendedAtLocal)} className="mt-2 rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-bold text-violet-800">{t('🕒 AI tavsiya qilgan vaqtni qo‘llash', '🕒 Применить время AI')}</button>}<p className="mt-1 text-slate-700">{aiResult.reasoning}</p></> : <><p className="font-black text-violet-900">{t('Kampaniya tahlili', 'Анализ кампаний')}</p><p className="mt-2">{aiResult.summary}</p><p className="mt-3 font-bold">{t('Kuzatuvlar', 'Наблюдения')}</p><ul className="mt-1 list-disc space-y-1 pl-5">{(aiResult.findings || []).map((item: string, i: number) => <li key={i}>{item}</li>)}</ul><p className="mt-3 font-bold">{t('Tavsiyalar', 'Рекомендации')}</p><ul className="mt-1 list-disc space-y-1 pl-5">{(aiResult.recommendations || []).map((item: string, i: number) => <li key={i}>{item}</li>)}</ul><p className="mt-2"><b>{t('Eng mos auditoriya:', 'Подходящая аудитория:')}</b> {audienceLabels[aiResult.bestAudience as Audience]?.[ru ? 'ru' : 'uz'] || aiResult.bestAudience}</p><p className="mt-1"><b>{t('Vaqt:', 'Время:')}</b> {aiResult.suggestedTime}</p><p className="mt-2 text-slate-600">{aiResult.limitations}</p></>}
          <p className="mt-3 text-xs text-slate-500">{t('Tavsiyalar oxirgi 50 kampaniya va mavjud obunachi segmentlari asosida. Yuborilgan xabarlar soni ko‘rishlar yoki konversiya degani emas.', 'Рекомендации основаны на последних 50 кампаниях и доступных сегментах. Количество отправок не равно просмотрам или конверсиям.')}</p>
        </div>}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black">{t('Yangi xabar', 'Новое сообщение')}</h2><div className="mt-5 space-y-4">
          <div><label className="text-sm font-bold">{t('Yuborish manzili', 'Куда отправить')}</label><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setDestination('bot')} className={`rounded-xl border px-4 py-3 text-left ${destination === 'bot' ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : ''}`}><b>🤖 {t('Bot', 'Бот')}</b><p className="mt-1 text-xs text-slate-500">{t('Obunachilarga shaxsiy xabar', 'Личные сообщения подписчикам')}</p></button><button type="button" onClick={() => setDestination('channel')} className={`rounded-xl border px-4 py-3 text-left ${destination === 'channel' ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : ''}`}><b>📢 {t('Kanal', 'Канал')}</b><p className="mt-1 text-xs text-slate-500">@royal_house_uz</p></button></div></div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('Sarlavha', 'Заголовок')} className="w-full rounded-xl border px-4 py-3"/>
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={t('Xabar matni', 'Текст сообщения')} rows={8} className="w-full rounded-xl border px-4 py-3"/>

          <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
            <label htmlFor="telegram-scheduled-at" className="text-sm font-bold">{t('Yuborish vaqti', 'Время отправки')}</label>
            <p className="mt-1 text-xs text-slate-600">{t('Hozir yuborish yoki quyida Toshkent vaqti bo‘yicha sana-vaqtni belgilab rejalashtirish mumkin.', 'Можно отправить сейчас или запланировать отправку по времени Ташкента.')}</p>
            <input id="telegram-scheduled-at" type="datetime-local" value={scheduledAt} min={tashkentDateTimeInput(new Date(Date.now() + 2 * 60 * 1000))} onChange={e => setScheduledAt(e.target.value)} className="mt-3 w-full rounded-xl border bg-white px-4 py-3"/>
            <p className="mt-2 text-xs text-slate-500">{t('Vaqt zonasi: Asia/Tashkent (UTC+5). Rejalashtirilgan kampaniya yuborilishidan oldin bekor qilinishi mumkin.', 'Часовой пояс: Asia/Tashkent (UTC+5). Кампанию можно отменить до начала отправки.')}</p>
          </div>

          {destination === 'bot' && <div><label className="text-sm font-bold">{t('Auditoriya', 'Аудитория')}</label><div className="mt-2 grid gap-2 sm:grid-cols-2">{(Object.keys(audienceLabels) as Audience[]).map(key => <button key={key} type="button" onClick={() => setAudience(key)} className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left ${audience === key ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'bg-white'}`}><span className="font-bold">{ru ? audienceLabels[key].ru : audienceLabels[key].uz}</span><span className="ml-3 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{audienceCounts[key].toLocaleString(ru ? 'ru-RU' : 'uz-UZ')}</span></button>)}</div></div>}

          <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
            <label htmlFor="telegram-test-recipient" className="text-sm font-bold">{t('Test qabul qiluvchi mijoz', 'Клиент для тестовой отправки')}</label>
            <p className="mt-1 text-xs text-slate-500">{t('Faqat faol Telegram bot foydalanuvchilari va marketing xabarlariga aniq rozilik bergan mijozlar ko‘rsatiladi. Test xabari faqat tanlangan mijozga shaxsiy yuboriladi.', 'Показываются только активные пользователи бота, явно согласившиеся на маркетинговые сообщения. Тест отправляется только выбранному клиенту в личный чат.')}</p>
            <select id="telegram-test-recipient" value={selectedTestRecipient} onChange={e => setSelectedTestRecipient(e.target.value)} disabled={!testRecipients.length || busy} className="mt-3 w-full rounded-xl border bg-white px-4 py-3 disabled:bg-slate-100">
              <option value="">{t('Mijozni tanlang', 'Выберите клиента')}</option>
              {testRecipients.map(recipient => <option key={recipient.telegramUserId} value={recipient.telegramUserId}>{recipient.label}{recipient.phone ? ` · ${recipient.phone}` : ''}{recipient.username ? ` · ${recipient.username}` : ''}</option>)}
            </select>
            {testRecipientError && <p className="mt-2 text-sm text-amber-700">{testRecipientError}</p>}
            {!testRecipientError && !testRecipients.length && <p className="mt-2 text-sm text-slate-500">{t('Hozircha marketing roziligi tasdiqlangan faol mijoz topilmadi.', 'Пока нет активных клиентов с подтверждённым согласием на маркетинговые сообщения.')}</p>}
            <button type="button" onClick={() => void load()} disabled={loading || busy} className="mt-2 text-xs font-bold text-sky-700 underline disabled:opacity-50">{t('Ro‘yxatni yangilash', 'Обновить список')}</button>
          </div>

          <div className="rounded-2xl border border-dashed p-4"><div className="flex flex-wrap items-center gap-3"><button type="button" disabled={mediaBusy} onClick={() => fileRef.current?.click()} className="rounded-xl border px-4 py-2 font-bold disabled:opacity-50">{mediaBusy ? t('Yuklanmoqda...', 'Загрузка...') : t('🖼️ Rasm / video qo‘shish', '🖼️ Добавить фото / видео')}</button><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void uploadMedia(file) }}/>{mediaName && <span className="text-sm font-semibold text-slate-600">{mediaName}</span>}{mediaName && <button type="button" onClick={removeMedia} className="text-sm font-bold text-red-600">{t('Olib tashlash', 'Удалить')}</button>}</div><p className="mt-2 text-xs text-slate-500">{t('Rasm: 5 MB gacha. Video: 20 MB gacha. Telegram havola orqali media yuboradi.', 'Фото: до 5 МБ. Видео: до 20 МБ. Telegram отправляет медиа по ссылке.')}</p></div>

          <div className="grid gap-4 sm:grid-cols-2"><input value={buttonText} onChange={e => setButtonText(e.target.value)} placeholder={t('Tugma matni (ixtiyoriy)', 'Текст кнопки (необязательно)')} className="rounded-xl border px-4 py-3"/><input value={buttonUrl} onChange={e => setButtonUrl(e.target.value)} placeholder="https://royalhouse.uz/..." className="rounded-xl border px-4 py-3"/></div>
          <div className="flex flex-wrap gap-3 pt-2"><button disabled={busy || mediaBusy || !selectedTestRecipient} onClick={() => void sendTest()} className="rounded-xl border px-5 py-3 font-bold disabled:opacity-50">{t('🧪 Tanlangan mijozga test yuborish', '🧪 Отправить тест выбранному клиенту')}</button><button disabled={busy || mediaBusy} onClick={() => void sendBroadcast()} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-50">{destination === 'channel' ? t('📢 Hozir kanalga joylash', '📢 Опубликовать сейчас') : t(`📨 Hozir ${audienceCounts[audience].toLocaleString(ru ? 'ru-RU' : 'uz-UZ')} ta yuborish`, `📨 Отправить сейчас: ${audienceCounts[audience].toLocaleString('ru-RU')}`)}</button><button disabled={busy || mediaBusy} onClick={() => void scheduleBroadcast()} className="rounded-xl bg-violet-600 px-5 py-3 font-bold text-white disabled:opacity-50">{t('🕒 Rejalashtirish', '🕒 Запланировать')}</button></div>
        </div></section>

        <aside className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black">{t('Telegram preview', 'Предпросмотр Telegram')}</h2><div className="mt-5 overflow-hidden rounded-2xl border bg-slate-50"><div className="border-b bg-white px-4 py-3"><b>RoyalHouse</b><div className="text-xs text-slate-400">{destination === 'channel' ? '@royal_house_uz' : '@RoyalHouseUz_bot'}</div></div><div className="p-4">
          {mediaUrl && mediaType === 'image' && <img src={mediaUrl} alt="" className="mb-4 max-h-72 w-full rounded-xl object-cover"/>}
          {mediaUrl && mediaType === 'video' && <video src={mediaUrl} controls className="mb-4 max-h-72 w-full rounded-xl"/>}
          <div className="whitespace-pre-wrap text-sm leading-6">{title ? <b>{title}{'\n\n'}</b> : ''}{message || t('Xabar shu yerda ko‘rinadi.', 'Здесь будет отображаться сообщение.')}</div>{buttonText && <button className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white">{buttonText}</button>}
        </div></div></aside>
      </div>

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black">{t('Kampaniyalar tarixi', 'История кампаний')}</h2>{loading ? <p className="mt-4 text-sm text-slate-500">{t('Yuklanmoqda...', 'Загрузка...')}</p> : !campaigns.length ? <p className="mt-4 text-sm text-slate-500">{t('Hozircha kampaniyalar yo‘q.', 'Кампаний пока нет.')}</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="p-3">{t('Sarlavha', 'Заголовок')}</th><th className="p-3">{t('Manzil', 'Канал')}</th><th className="p-3">{t('Auditoriya', 'Аудитория')}</th><th className="p-3">{t('Media', 'Медиа')}</th><th className="p-3">{t('Status', 'Статус')}</th><th className="p-3">{t('Yuborildi', 'Отправлено')}</th><th className="p-3">{t('Xato', 'Ошибки')}</th><th className="p-3">{t('Amal', 'Действие')}</th></tr></thead><tbody>{campaigns.map(c => <tr key={c.id} className="border-b last:border-0"><td className="p-3 font-bold">{c.title}</td><td className="p-3">{c.destination === 'channel' ? '@royal_house_uz' : t('Bot', 'Бот')}</td><td className="p-3">{c.destination === 'channel' ? '—' : (ru ? audienceLabels[c.audience].ru : audienceLabels[c.audience].uz)}</td><td className="p-3">{c.media_type ? (c.media_type === 'image' ? '🖼️' : '🎥') : '—'}</td><td className="p-3">{c.status === 'queued' ? t('Kutilmoqda', 'Ожидает') : c.status === 'sending' ? t('Yuborilmoqda', 'Отправляется') : c.status === 'sent' ? t('Yuborildi', 'Отправлено') : c.status === 'failed' ? t('Xato', 'Ошибка') : c.status === 'cancelled' ? t('Bekor qilindi', 'Отменено') : c.status}</td><td className="p-3">{c.scheduled_at && c.status === 'queued' ? new Date(c.scheduled_at).toLocaleString(ru ? 'ru-RU' : 'uz-UZ', { timeZone: 'Asia/Tashkent' }) : c.sent_count}</td><td className="p-3">{c.failed_count}</td><td className="p-3">{c.status === 'queued' && <button type="button" disabled={busy} onClick={() => void cancelScheduledCampaign(c.id)} className="text-red-600 underline disabled:opacity-50">{t('Bekor qilish', 'Отменить')}</button>}</td></tr>)}</tbody></table></div>}</section>
    </div>
  </main>
}
