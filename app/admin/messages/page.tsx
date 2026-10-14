'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/app/components/I18nProvider'

type Message = {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  subject: string
  message: string
  source: 'website' | 'telegram' | 'system'
  telegram_username: string | null
  status: 'new' | 'in_progress' | 'replied' | 'closed'
  admin_note: string | null
  created_at: string
}

type AiDraft = {
  id: string
  support_message_id: string
  generated_reply: string
  status: 'pending_review' | 'approved' | 'rejected' | 'sent' | 'send_failed' | 'preview_only'
  language: 'uz' | 'ru' | 'other'
  model: string | null
  evidence: Array<{ tool?: string; result?: unknown }>
}

const statusLabels = {
  new: 'Yangi',
  in_progress: 'Jarayonda',
  replied: 'Javob berildi',
  closed: 'Yopilgan',
} as const

const statusLabelsRu = {
  new: 'Новый',
  in_progress: 'В работе',
  replied: 'Ответ дан',
  closed: 'Закрыт',
} as const

const sourceLabels = { website: 'Sayt', telegram: 'Telegram', system: 'Tizim' } as const
const sourceLabelsRu = { website: 'Сайт', telegram: 'Telegram', system: 'Система' } as const

function getInitials(message: Message) {
  const value = message.name || message.telegram_username || 'RH'
  return value.replace('@', '').slice(0, 2).toUpperCase()
}

function detectIntent(message: Message) {
  const text = `${message.subject} ${message.message}`.toLowerCase()
  if (text.includes('dacha') || text.includes('дача')) return 'Dacha'
  if (text.includes('kvartira') || text.includes('квартира')) return 'Kvartira'
  if (text.includes('ipoteka') || text.includes('кредит')) return 'Ipoteka'
  if (text.includes('xizmat') || text.includes('ремонт')) return 'Xizmat'
  return 'Umumiy murojaat'
}

function detectRentalMode(message: Message) {
  const text = `${message.subject} ${message.message}`.toLowerCase()
  if (text.includes('kunlik') || text.includes('sutka') || text.includes('so‘m/kun') || text.includes('сутк')) return 'Kunlik'
  if (text.includes('oylik') || text.includes('oyiga') || text.includes('месяц') || text.includes('аренд')) return 'Uzoq muddatli'
  return null
}

export default function SupportMessagesPage() {
  const { lang, setLang } = useI18n()
  const ru = lang === 'ru'
  const t = (uz: string, ruText: string) => ru ? ruText : uz
  const [allMessages, setAllMessages] = useState<Message[]>([])
  const [selected, setSelected] = useState<Message | null>(null)
  const [filter, setFilter] = useState<'all' | Message['status']>('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | Message['source']>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const [reply, setReply] = useState('')
  const [replying, setReplying] = useState(false)
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [reviewingAi, setReviewingAi] = useState(false)
  const [aiError, setAiError] = useState('')

  async function load() {
    setLoading(true)
    const response = await fetch('/api/admin/support-messages', { cache: 'no-store' })
    if (response.status === 401 || response.status === 403) {
      window.location.href = '/admin/login'
      return
    }
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      alert(data.error || t('Xabarlarni yuklab bo‘lmadi.', 'Не удалось загрузить сообщения.'))
      setLoading(false)
      return
    }
    setAllMessages(data.messages || [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const messages = useMemo(() => {
    const query = search.trim().toLowerCase()
    return allMessages.filter(item => {
      const statusOk = filter === 'all' || item.status === filter
      const sourceOk = sourceFilter === 'all' || item.source === sourceFilter
      if (!statusOk || !sourceOk) return false
      if (!query) return true
      return [item.name, item.telegram_username, item.subject, item.message, item.phone, item.email]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query))
    })
  }, [allMessages, filter, sourceFilter, search])

  useEffect(() => {
    setNote(selected?.admin_note || '')
    setReply('')
    setAiDraft(null)
    setAiError('')
  }, [selected])

  const counts = useMemo(() => ({
    all: allMessages.length,
    new: allMessages.filter(x => x.status === 'new').length,
    in_progress: allMessages.filter(x => x.status === 'in_progress').length,
    replied: allMessages.filter(x => x.status === 'replied').length,
    closed: allMessages.filter(x => x.status === 'closed').length,
  }), [allMessages])

  async function sendTelegramReply() {
    if (!selected || selected.source !== 'telegram' || replying) return
    const text = reply.trim()
    if (!text) return
    setReplying(true)
    const response = await fetch('/api/admin/support-messages/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, reply: text, draftId: aiDraft?.status === 'approved' ? aiDraft.id : undefined }),
    })
    const data = await response.json().catch(() => ({}))
    setReplying(false)
    if (!response.ok) {
      alert(data.error || t('Javob yuborilmadi.', 'Ответ не отправлен.'))
      return
    }
    setReply('')
    if (aiDraft?.status === 'approved') setAiDraft({ ...aiDraft, status: 'sent' })
    setSelected({ ...selected, status: 'replied', admin_note: 'Javob: ' + text })
    await load()
  }

  async function generateAiDraft() {
    if (!selected || generatingAi) return
    setGeneratingAi(true)
    setAiError('')
    setAiDraft(null)
    try {
      const response = await fetch('/api/admin/ai-replies/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: selected.id, previewOnly: true }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setAiError(data.error || t('AI javobini tayyorlab bo‘lmadi.', 'Не удалось подготовить ответ ИИ.'))
        return
      }
      setAiDraft(data.draft)
    } catch {
      setAiError(t('Tarmoq xatosi. Qayta urinib ko‘ring.', 'Ошибка сети. Попробуйте ещё раз.'))
    } finally {
      setGeneratingAi(false)
    }
  }

  async function generateAiTestDraft() {
    if (generatingAi) return
    setGeneratingAi(true)
    setAiError('')
    setAiDraft(null)
    try {
      const response = await fetch('/api/admin/ai-replies/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testMode: true,
          sampleMessage: 'Assalomu alaykum. Dacha ijarasi narxi va bo‘sh sanalarini ayting.',
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setAiError(data.error || t('Xavfsiz AI testini bajarib bo‘lmadi.', 'Не удалось выполнить безопасный тест ИИ.'))
        return
      }
      setAiDraft(data.draft)
    } catch {
      setAiError(t('Tarmoq xatosi. Qayta urinib ko‘ring.', 'Ошибка сети. Попробуйте ещё раз.'))
    } finally {
      setGeneratingAi(false)
    }
  }

  async function reviewAiDraft(action: 'approve' | 'reject') {
    if (!aiDraft || reviewingAi || aiDraft.status !== 'pending_review') return
    setReviewingAi(true)
    setAiError('')
    try {
      const response = await fetch('/api/admin/ai-replies/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: aiDraft.id, action }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setAiError(data.error || t('Qaror saqlanmadi.', 'Решение не сохранено.'))
        return
      }
      setAiDraft(data.draft)
      if (action === 'approve' && selected?.source === 'telegram') setReply(data.draft.generated_reply)
    } catch {
      setAiError(t('Tarmoq xatosi. Qayta urinib ko‘ring.', 'Ошибка сети. Попробуйте ещё раз.'))
    } finally {
      setReviewingAi(false)
    }
  }

  async function saveStatus(status: Message['status']) {
    if (!selected || saving) return
    setSaving(true)
    const response = await fetch('/api/admin/support-messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, status, admin_note: note }),
    })
    const data = await response.json().catch(() => ({}))
    setSaving(false)
    if (!response.ok) {
      alert(data.error || t('O‘zgartirish saqlanmadi.', 'Изменение не сохранено.'))
      return
    }
    setSelected({ ...selected, status, admin_note: note })
    await load()
  }

  const statusTone = (status: Message['status']) => {
    if (status === 'new') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (status === 'in_progress') return 'bg-amber-50 text-amber-700 border-amber-200'
    if (status === 'replied') return 'bg-blue-50 text-blue-700 border-blue-200'
    return 'bg-slate-100 text-slate-600 border-slate-200'
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/admin" className="rounded-xl px-2 py-2 font-black text-emerald-700 hover:bg-emerald-50">← {t('Admin', 'Админ')}</Link>
            <div className="hidden h-6 w-px bg-slate-200 sm:block" />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black">📨 {t('Murojaatlar', 'Обращения')}</h1>
              <p className="hidden text-[11px] text-slate-500 sm:block">{t('Operator uchun mijozlar bilan ishlash markazi', 'Центр работы оператора с клиентами')}</p>
            </div>
          </div>
          <div className="flex overflow-hidden rounded-xl border text-xs font-bold">
            <button onClick={() => setLang('uz')} className={`px-3 py-2 ${!ru ? 'bg-slate-900 text-white' : ''}`}>UZ</button>
            <button onClick={() => setLang('ru')} className={`px-3 py-2 ${ru ? 'bg-slate-900 text-white' : ''}`}>RU</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-5 lg:px-6">
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          {([
            ['all', t('Barchasi', 'Все')],
            ['new', t('Yangi', 'Новые')],
            ['in_progress', t('Jarayonda', 'В работе')],
            ['replied', t('Javob berildi', 'Ответ дан')],
            ['closed', t('Yopilgan', 'Закрытые')],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={`rounded-2xl border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 ${filter === key ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'}`}>
              <p className="text-[11px] font-bold text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{counts[key]}</p>
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-col gap-3 rounded-2xl border bg-white p-3 shadow-sm lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Mijoz, telefon, Telegram yoki xabar bo‘yicha qidirish...', 'Поиск по клиенту, телефону, Telegram или сообщению...')} className="w-full rounded-xl border bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-500" />
          </div>
          <div className="flex flex-wrap gap-2">
            {([['all', t('Barcha manbalar', 'Все источники')], ['telegram', 'Telegram'], ['website', t('Sayt', 'Сайт')]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setSourceFilter(key)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${sourceFilter === key ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'bg-white text-slate-600'}`}>{label}</button>
            ))}
          </div>
          <button onClick={() => void load()} className="rounded-xl border px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">↻ {t('Yangilash', 'Обновить')}</button>
        </div>

        <div className="grid min-h-[650px] gap-4 lg:grid-cols-[minmax(360px,0.85fr)_minmax(520px,1.5fr)_300px]">
          <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="border-b px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-black">{t('Murojaatlar', 'Обращения')}</h2>
                  <p className="mt-1 text-xs text-slate-500">{messages.length} {t('ta ko‘rsatildi', 'показано')}</p>
                </div>
                {search && <button onClick={() => setSearch('')} className="text-xs font-bold text-emerald-700">{t('Tozalash', 'Очистить')}</button>}
              </div>
            </div>
            {loading ? (
              <p className="p-8 text-center text-sm text-slate-500">{t('Yuklanmoqda...', 'Загрузка...')}</p>
            ) : messages.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">{t('Tanlangan shartlar bo‘yicha murojaat topilmadi.', 'По выбранным условиям обращения не найдены.')}</p>
            ) : (
              <div className="max-h-[720px] divide-y overflow-y-auto">
                {messages.map(item => (
                  <button key={item.id} onClick={() => setSelected(item)} className={`w-full p-4 text-left transition hover:bg-slate-50 ${selected?.id === item.id ? 'bg-emerald-50/80' : ''}`}>
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">{getInitials(item)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate font-black text-slate-900">{item.name || item.telegram_username || t('Noma’lum mijoz', 'Неизвестный клиент')}</p>
                          <span className="shrink-0 text-[10px] text-slate-400">{new Date(item.created_at).toLocaleDateString(ru ? 'ru-RU' : 'uz-UZ')}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold">{ru ? sourceLabelsRu[item.source] : sourceLabels[item.source]}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusTone(item.status)}`}>{ru ? statusLabelsRu[item.status] : statusLabels[item.status]}</span>
                        </div>
                        <p className="mt-2 truncate text-sm font-semibold text-slate-700">{item.subject}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.message}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
            {!selected ? (
              <div className="flex h-full min-h-[650px] flex-col items-center justify-center px-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-3xl">💬</div>
                <h2 className="text-lg font-black">{t('Murojaatni tanlang', 'Выберите обращение')}</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{t('Chap tomondan mijoz murojaatini tanlang. Bu yerda AI tahlili, javob loyihasi va Telegram orqali javob berish vositalari chiqadi.', 'Выберите обращение слева. Здесь появятся анализ ИИ, черновик ответа и инструменты ответа через Telegram.')}</p>
              </div>
            ) : (
              <div className="max-h-[760px] overflow-y-auto">
                <div className="sticky top-0 z-10 border-b bg-white/95 px-5 py-4 backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-black text-emerald-700">{getInitials(selected)}</div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">{ru ? sourceLabelsRu[selected.source] : sourceLabels[selected.source]}</p>
                        <h2 className="truncate text-xl font-black">{selected.name || selected.telegram_username || t('Noma’lum mijoz', 'Неизвестный клиент')}</h2>
                        {selected.telegram_username && <p className="truncate text-xs text-slate-500">@{selected.telegram_username.replace(/^@/, '')}</p>}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${statusTone(selected.status)}`}>{ru ? statusLabelsRu[selected.status] : statusLabels[selected.status]}</span>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('Mijoz', 'Клиент')}</p>
                      <div className="mt-2 space-y-1 text-sm text-slate-700">
                        {selected.phone ? <p><b>{t('Telefon', 'Телефон')}:</b> {selected.phone}</p> : <p className="text-slate-400">{t('Telefon kiritilmagan', 'Телефон не указан')}</p>}
                        {selected.email && <p><b>Email:</b> {selected.email}</p>}
                        {selected.telegram_username && <p><b>Telegram:</b> @{selected.telegram_username.replace(/^@/, '')}</p>}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">{t('Murojaat tahlili', 'Анализ обращения')}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700">{detectIntent(selected)}</span>
                        {detectRentalMode(selected) && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700">{detectRentalMode(selected)}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('Mijoz murojaati', 'Обращение клиента')}</p>
                        <p className="mt-1 font-black text-slate-900">{selected.subject}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-slate-400">{new Date(selected.created_at).toLocaleString(ru ? 'ru-RU' : 'uz-UZ')}</span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selected.message}</p>
                  </div>

                  <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100">🤖</span><p className="font-black text-violet-900">RoyalHouse AI</p></div>
                        <p className="mt-1 text-xs text-violet-700">{t('AI tahlil va javob loyihasini tayyorlaydi. Operator tasdiqlamasdan mijozga yuborilmaydi.', 'ИИ готовит анализ и черновик ответа. Без подтверждения оператора клиенту ничего не отправляется.')}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button disabled={generatingAi} onClick={() => void generateAiTestDraft()} className="rounded-xl border border-violet-300 bg-white px-3 py-2 text-xs font-bold text-violet-800 disabled:opacity-50">{t('Xavfsiz test', 'Безопасный тест')}</button>
                        <button disabled={generatingAi} onClick={() => void generateAiDraft()} className="rounded-xl bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{generatingAi ? t('Tayyorlanmoqda…', 'Готовим…') : t('AI javobini tayyorlash', 'Подготовить ответ ИИ')}</button>
                      </div>
                    </div>
                    {aiError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{aiError}</p>}
                    {aiDraft && (
                      <div className="mt-3 rounded-2xl border border-violet-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-500">{t('AI javob loyihasi', 'Черновик ответа ИИ')}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold">{aiDraft.status}</span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">{aiDraft.generated_reply}</p>
                        {aiDraft.status === 'preview_only' && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">{t('Tekshiruv rejimi: AI javobi saqlanmadi va mijozga yuborilmadi. Hech narsa o‘zgartirilmaydi.', 'Режим проверки: ответ ИИ не сохранён и клиенту не отправлен. Никакие данные не изменяются.')}</p>}
                        {aiDraft.status === 'pending_review' && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button disabled={reviewingAi} onClick={() => void reviewAiDraft('approve')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{t('Tasdiqlash', 'Подтвердить')}</button>
                            <button disabled={reviewingAi} onClick={() => void reviewAiDraft('reject')} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">{t('Rad etish', 'Отклонить')}</button>
                          </div>
                        )}
                        {aiDraft.status === 'approved' && <p className="mt-3 text-xs font-bold text-emerald-700">{t('Tasdiqlandi. Javob maydoniga joylandi; yuborishdan oldin tahrirlashingiz mumkin.', 'Подтверждено. Текст помещён в поле ответа; перед отправкой его можно изменить.')}</p>}
                      </div>
                    )}
                  </div>

                  {selected.source === 'telegram' && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-black text-emerald-800">{t('Telegram orqali javob berish', 'Ответить в Telegram')}</p>
                          <p className="mt-1 text-xs text-emerald-700">{t('AI matnini tahrirlab, keyin operator sifatida yuboring.', 'Отредактируйте текст ИИ и отправьте его от имени оператора.')}</p>
                        </div>
                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-emerald-700">Telegram</span>
                      </div>
                      <textarea value={reply} onChange={e => setReply(e.target.value)} rows={5} placeholder={t('Mijozga javob yozing...', 'Напишите ответ клиенту...')} className="mt-3 w-full resize-none rounded-xl border bg-white p-3 text-sm leading-6 outline-none focus:border-emerald-500" />
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <button disabled={replying || !reply.trim()} onClick={() => void sendTelegramReply()} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{replying ? t('Yuborilmoqda...', 'Отправка...') : t('Telegram orqali yuborish', 'Отправить в Telegram')}</button>
                        <button disabled={!reply} onClick={() => setReply('')} className="rounded-xl border bg-white px-4 py-3 text-sm font-bold text-slate-600 disabled:opacity-40">{t('Tozalash', 'Очистить')}</button>
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border p-4">
                    <div className="flex items-center justify-between"><p className="font-black">{t('Murojaat holati', 'Статус обращения')}</p><span className="text-xs text-slate-400">{selected.id.slice(0, 8)}</span></div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(['new', 'in_progress', 'replied', 'closed'] as const).map(status => (
                        <button key={status} disabled={saving} onClick={() => void saveStatus(status)} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${selected.status === status ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                          {ru ? statusLabelsRu[status] : statusLabels[status]}
                        </button>
                      ))}
                    </div>
                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder={t('Admin izohi / ichki qayd...', 'Комментарий администратора / внутренняя заметка...')} className="mt-3 w-full resize-none rounded-xl border p-3 text-sm outline-none focus:border-emerald-500" />
                    <p className="mt-2 text-[11px] text-slate-400">{t('Ichki izoh mijozga yuborilmaydi.', 'Внутренний комментарий клиенту не отправляется.')}</p>
                  </div>
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between"><h3 className="font-black">{t('Operator paneli', 'Панель оператора')}</h3><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">LIVE</span></div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span className="text-slate-500">{t('Jami murojaatlar', 'Всего обращений')}</span><b>{counts.all}</b></div>
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3"><span className="text-emerald-700">{t('Yangi', 'Новые')}</span><b className="text-emerald-700">{counts.new}</b></div>
                <div className="flex items-center justify-between rounded-xl bg-amber-50 p-3"><span className="text-amber-700">{t('Jarayonda', 'В работе')}</span><b className="text-amber-700">{counts.in_progress}</b></div>
                <div className="flex items-center justify-between rounded-xl bg-blue-50 p-3"><span className="text-blue-700">{t('Javob berilgan', 'Ответ дан')}</span><b className="text-blue-700">{counts.replied}</b></div>
              </div>
            </div>

            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              <h3 className="font-black">{t('Ishlash tartibi', 'Рабочий процесс')}</h3>
              <div className="mt-4 space-y-3 text-xs leading-5 text-slate-600">
                <div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-black text-emerald-700">1</span><p>{t('Murojaatni tanlang va talabni aniqlang.', 'Выберите обращение и определите потребность.')}</p></div>
                <div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 font-black text-violet-700">2</span><p>{t('AI javob loyihasini tayyorlang va tekshiring.', 'Подготовьте и проверьте черновик ответа ИИ.')}</p></div>
                <div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 font-black text-blue-700">3</span><p>{t('Telegram javobini tahrirlang va operator sifatida yuboring.', 'Отредактируйте ответ и отправьте его от имени оператора.')}</p></div>
                <div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 font-black text-slate-600">4</span><p>{t('Holatni yangilang va ichki izoh qoldiring.', 'Обновите статус и оставьте внутренний комментарий.')}</p></div>
              </div>
            </div>

            {selected && (
              <div className="rounded-3xl border bg-white p-5 shadow-sm">
                <h3 className="font-black">{t('Tanlangan mijoz', 'Выбранный клиент')}</h3>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 font-black text-slate-700">{getInitials(selected)}</div>
                  <div className="min-w-0"><p className="truncate font-black">{selected.name || selected.telegram_username || t('Noma’lum', 'Неизвестный')}</p><p className="truncate text-xs text-slate-500">{selected.telegram_username ? '@' + selected.telegram_username.replace(/^@/, '') : selected.phone || selected.email || '—'}</p></div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-400">{t('Manba', 'Источник')}</p><b>{ru ? sourceLabelsRu[selected.source] : sourceLabels[selected.source]}</b></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-400">{t('Maqsad', 'Запрос')}</p><b>{detectIntent(selected)}</b></div></div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}
