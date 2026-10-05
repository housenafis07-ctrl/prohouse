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

const statusLabels = {
  new: 'Yangi',
  in_progress: 'Jarayonda',
  replied: 'Javob berildi',
  closed: 'Yopilgan',
} as const

const statusLabelsRu = { new: 'Новый', in_progress: 'В работе', replied: 'Ответ дан', closed: 'Закрыт' } as const

const sourceLabels = {
  website: 'Sayt',
  telegram: 'Telegram',
  system: 'Tizim',
} as const
const sourceLabelsRu = { website: 'Сайт', telegram: 'Telegram', system: 'Система' } as const

export default function SupportMessagesPage() {
  const { lang, setLang } = useI18n()
  const ru = lang === 'ru'
  const t = (uz: string, ruText: string) => ru ? ruText : uz
  const [messages, setMessages] = useState<Message[]>([])
  const [selected, setSelected] = useState<Message | null>(null)
  const [filter, setFilter] = useState<'all' | Message['status']>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const [reply, setReply] = useState('')
  const [replying, setReplying] = useState(false)

  async function load() {
    setLoading(true)
    const url = filter === 'all' ? '/api/admin/support-messages' : '/api/admin/support-messages?status=' + filter
    const response = await fetch(url, { cache: 'no-store' })
    if (response.status === 401 || response.status === 403) {
      window.location.href = '/admin/login'
      return
    }
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      alert(data.error || t('Xabarlarni yuklab bo‘lmadi.','Не удалось загрузить сообщения.'))
      setLoading(false)
      return
    }
    setMessages(data.messages || [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [filter])

  useEffect(() => {
    setNote(selected?.admin_note || '')
    setReply('')
  }, [selected])

  const counts = useMemo(() => ({
    all: messages.length,
    new: messages.filter(x => x.status === 'new').length,
    in_progress: messages.filter(x => x.status === 'in_progress').length,
    replied: messages.filter(x => x.status === 'replied').length,
    closed: messages.filter(x => x.status === 'closed').length,
  }), [messages])

  async function sendTelegramReply() {
    if (!selected || selected.source !== 'telegram' || replying) return
    const text = reply.trim()
    if (!text) return
    setReplying(true)
    const response = await fetch('/api/admin/support-messages/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, reply: text }),
    })
    const data = await response.json().catch(() => ({}))
    setReplying(false)
    if (!response.ok) {
      alert(data.error || t('Javob yuborilmadi.', 'Ответ не отправлен.'))
      return
    }
    setReply('')
    setSelected({ ...selected, status: 'replied', admin_note: 'Javob: ' + text })
    await load()
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
      alert(data.error || t('O‘zgartirish saqlanmadi.','Изменение не сохранено.'))
      return
    }
    setSelected({ ...selected, status, admin_note: note })
    await load()
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-4"><Link href="/admin" className="font-black text-emerald-700">← {t('Admin','Админ')}</Link><h1 className="font-black">📨 {t('Xabarlar','Сообщения')}</h1></div><div className="flex overflow-hidden rounded-xl border text-xs font-bold"><button onClick={()=>setLang('uz')} className={`px-3 py-2 ${!ru?'bg-slate-900 text-white':''}`}>UZ</button><button onClick={()=>setLang('ru')} className={`px-3 py-2 ${ru?'bg-slate-900 text-white':''}`}>RU</button></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-7">
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {([
            ['all', t('Barchasi','Все')],
            ['new', t('Yangi','Новые')],
            ['in_progress', t('Jarayonda','В работе')],
            ['replied', t('Javob berildi','Ответ дан')],
            ['closed', t('Yopilgan','Закрытые')],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={'rounded-2xl bg-white p-4 text-left shadow-sm ' + (filter === key ? 'ring-2 ring-emerald-500' : '')}>
              <p className="text-xs font-bold text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-black">{counts[key]}</p>
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="font-black">{t('Murojaatlar','Обращения')}</h2>
              <p className="mt-1 text-xs text-slate-500">{t('Sayt va Telegram orqali kelgan barcha murojaatlar.','Все обращения, поступившие через сайт и Telegram.')}</p>
            </div>
            {loading ? (
              <p className="p-6 text-sm text-slate-500">{t('Yuklanmoqda...','Загрузка...')}</p>
            ) : messages.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">{t('Hozircha xabarlar yo‘q.','Пока сообщений нет.')}</p>
            ) : (
              <div className="divide-y">
                {messages.map(item => (
                  <button key={item.id} onClick={() => setSelected(item)} className={'w-full p-5 text-left hover:bg-slate-50 ' + (selected?.id === item.id ? 'bg-emerald-50' : '')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-900">{item.name || item.telegram_username || t('Noma’lum mijoz','Неизвестный клиент')}</p>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-700">{item.subject}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.message}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold">{(ru ? sourceLabelsRu[item.source] : sourceLabels[item.source])}</span>
                        <p className="mt-2 text-[10px] text-slate-400">{new Date(item.created_at).toLocaleString(ru ? 'ru-RU' : 'uz-UZ')}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <aside className="rounded-3xl bg-white p-5 shadow-sm">
            {!selected ? (
              <div className="py-16 text-center text-sm text-slate-400">{t('Murojaatni tanlang.','Выберите обращение.')}</div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">{(ru ? sourceLabelsRu[selected.source] : sourceLabels[selected.source])}</p>
                    <h2 className="mt-1 text-xl font-black">{selected.name || selected.telegram_username || t('Noma’lum mijoz','Неизвестный клиент')}</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{(ru ? statusLabelsRu[selected.status] : statusLabels[selected.status])}</span>
                </div>
                <div className="mt-5 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm">
                  {selected.phone && <p><b>{t('Telefon:','Телефон:')}</b> {selected.phone}</p>}
                  {selected.email && <p><b>Email:</b> {selected.email}</p>}
                  {selected.telegram_username && <p><b>Telegram:</b> {selected.telegram_username}</p>}
                </div>
                <div className="mt-4 rounded-2xl border p-4">
                  <p className="text-xs font-bold text-slate-500">{selected.subject}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selected.message}</p>
                </div>
                {selected.source === 'telegram' && (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
                    <p className="text-xs font-bold text-emerald-700">{t('Telegram orqali javob berish','Ответить в Telegram')}</p>
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      rows={4}
                      placeholder={t('Mijozga javob yozing...','Напишите ответ клиенту...')}
                      className="mt-2 w-full resize-none rounded-xl border bg-white p-3 text-sm outline-none focus:border-emerald-500"
                    />
                    <button
                      disabled={replying || !reply.trim()}
                      onClick={() => void sendTelegramReply()}
                      className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {replying ? t('Yuborilmoqda...','Отправка...') : t('Telegram orqali yuborish','Отправить в Telegram')}
                    </button>
                  </div>
                )}
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder={t('Admin izohi...','Комментарий администратора...')} className="mt-4 w-full resize-none rounded-2xl border p-3 text-sm outline-none focus:border-emerald-500" />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(['new', 'in_progress', 'replied', 'closed'] as const).map(status => (
                    <button key={status} disabled={saving} onClick={() => void saveStatus(status)} className={'rounded-xl border px-3 py-2 text-xs font-bold ' + (selected.status === status ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'bg-white')}>
                      {(ru ? statusLabelsRu[status] : statusLabels[status])}
                    </button>
                  ))}
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}
