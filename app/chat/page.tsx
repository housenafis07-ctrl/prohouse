'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import TransactionPanel from './TransactionPanel'
import { useI18n } from '@/app/components/I18nProvider'

type Message = { id: string; text: string; mine: boolean; time: string }
type Conversation = { id: string; listing_id: string | null; updated_at: string; title: string; lastMessage: string; unread: number }
type Notification = { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string; conversation_id: string | null }

function ChatPageContent() {
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const t = ru ? { login:'Войдите в систему, чтобы пользоваться чатом.', messages:'Сообщения', newCount:'новых', allChats:'Переписка по всем объявлениям.', loading:'Загрузка...', noChats:'Пока нет чатов.', notifications:'Уведомления', newMessage:'Новое сообщение', listingChat:'Чат по объявлению', selectChat:'Выберите чат', conversation:'Переписка с продавцом/покупателем', startFromListing:'Начните чат со страницы объявления', selectLeft:'Выберите чат слева.', noMessages:'Пока нет сообщений.', placeholder:'Введите сообщение...', send:'Отправить', sending:'Отправка...', enter:'Enter — отправить · Shift+Enter — новая строка', cabinet:'Кабинет', back:'← Вернуться к объявлениям', error:'Сообщение не отправлено' } : { login:'Chatdan foydalanish uchun tizimga kiring.', messages:'Xabarlar', newCount:'yangi', allChats:'Barcha e’lonlar bo‘yicha yozishmalar.', loading:'Yuklanmoqda...', noChats:'Hozircha suhbatlar yo‘q.', notifications:'Bildirishnomalar', newMessage:'Yangi xabar', listingChat:'E’lon bo‘yicha chat', selectChat:'Suhbatni tanlang', conversation:'Sotuvchi/xaridor bilan yozishma', startFromListing:'E’lon sahifasidan chatni boshlang', selectLeft:'Chap tomondan suhbatni tanlang.', noMessages:'Hali xabarlar yo‘q.', placeholder:'Xabaringizni yozing...', send:'Yuborish', sending:'Yuborilmoqda...', enter:'Enter — yuborish · Shift+Enter — yangi qator', cabinet:'Kabinet', back:'← E’lonlarga qaytish', error:'Xabar yuborilmadi' }
  const searchParams = useSearchParams()
  const requestedConversationId = searchParams.get('conversationId')
  const listingId = searchParams.get('listingId')
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(requestedConversationId)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => { setActiveConversationId(requestedConversationId) }, [requestedConversationId])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const response = await fetch('/api/chat', { cache: 'no-store', credentials: 'same-origin' })
        const result = await response.json().catch(() => ({}))
        if (!mounted) return
        if (response.status === 401) { setError(t.login); setLoading(false); return }
        if (!response.ok) throw new Error(result.error || t.error)
        setUserId(result.userId)
        const list = (result.conversations || []) as Conversation[]
        setConversations(list)
        setNotifications((result.notifications || []) as Notification[])
        if (listingId && !requestedConversationId) {
          const existing = list.find(item => item.listing_id === listingId)
          if (existing) setActiveConversationId(existing.id)
        }
        if (!requestedConversationId && !listingId && list[0]) setActiveConversationId(list[0].id)
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : t.error)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    const interval = window.setInterval(() => { void load() }, 10000)
    return () => { mounted = false; window.clearInterval(interval) }
  }, [listingId, requestedConversationId])

  useEffect(() => {
    if (!activeConversationId || !userId) { setMessages([]); return }
    let mounted = true
    const loadMessages = async () => {
      try {
        const response = await fetch('/api/chat', { cache: 'no-store', credentials: 'same-origin' })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) return
        if (mounted) {
          const rows = (result.messages || []).filter((message: any) => message.conversation_id === activeConversationId)
          setMessages(rows.map((message: any) => ({ id: message.id, text: message.body, mine: message.sender_id === userId, time: new Date(message.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) })))
        }
      } catch { /* The next poll will retry. */ }
    }
    void loadMessages()
    const interval = window.setInterval(() => { void loadMessages() }, 5000)
    return () => { mounted = false; window.clearInterval(interval) }
  }, [activeConversationId, userId])

  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel(`prohouse-user-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async payload => {
        const row = payload.new as any
        if (!row?.conversation_id || !row?.id) return

        // A newly-created conversation may not exist in the local list yet.
        // Verify membership, then add it instead of silently dropping the event.
        const { data: membership } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('conversation_id', row.conversation_id)
          .eq('user_id', userId)
          .maybeSingle()
        if (!membership) return

        const { data: conversationRow } = await supabase
          .from('conversations')
          .select('id,listing_id,updated_at,listings(title)')
          .eq('id', row.conversation_id)
          .maybeSingle()
        const title = (conversationRow as any)?.listings?.title || t.listingChat
        setConversations(current => {
          const exists = current.some(conversation => conversation.id === row.conversation_id)
          const next = exists
            ? current.map(conversation => conversation.id === row.conversation_id
              ? { ...conversation, listing_id: row.listing_id ?? conversation.listing_id, title, lastMessage: row.body, updated_at: row.created_at, unread: row.sender_id === userId || row.conversation_id === activeConversationId ? conversation.unread : conversation.unread + 1 }
              : conversation)
            : [...current, { id: row.conversation_id, listing_id: conversationRow?.listing_id ?? null, updated_at: row.created_at, title, lastMessage: row.body || t.noMessages, unread: row.sender_id === userId || row.conversation_id === activeConversationId ? 0 : 1 }]
          return next.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        })

        if (row.conversation_id === activeConversationId) {
          setMessages(current => current.some(message => message.id === row.id) ? current : [...current, { id: row.id, text: row.body, mine: row.sender_id === userId, time: new Date(row.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) }])
          if (row.sender_id !== userId) void supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', row.id)
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => {
        const row = payload.new as Notification
        setNotifications(current => [row, ...current.filter(item => item.id !== row.id)].slice(0, 30))
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [activeConversationId, supabase, userId])

  const send = async () => {
    const value = text.trim()
    if (!value || !userId || !activeConversationId || sending) return
    setSending(true); setError('')
    try {
      const response = await fetch('/api/chat/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: activeConversationId, text: value }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || t.error)
      const data = result.message
      if (data) {
        setMessages(current => current.some(message => message.id === data.id) ? current : [...current, { id: data.id, text: data.body, mine: true, time: new Date(data.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) }])
        setConversations(current => current.map(item => item.id === activeConversationId ? { ...item, lastMessage: data.body, updated_at: data.created_at } : item))
      }
      setText('')
    } catch (sendError) { setError(sendError instanceof Error ? sendError.message : t.error) }
    finally { setSending(false) }
  }

  const unreadCount = notifications.filter(item => !item.read_at).length
  const activeConversation = conversations.find(item => item.id === activeConversationId)
  const markNotificationRead = async (id: string) => { const now = new Date().toISOString(); await supabase.from('notifications').update({ read_at: now }).eq('id', id); setNotifications(current => current.map(item => item.id === id ? { ...item, read_at: now } : item)) }

  return <main className="min-h-screen bg-slate-50">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6"><Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight">Royal<span className="text-emerald-500">house</span></Link><div className="flex items-center gap-2"><Link href="/account" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">{t.cabinet}</Link><Link href="/listings" className="text-sm font-bold text-slate-600 hover:text-emerald-600">{t.back}</Link></div></div></header>
    <div className="mx-auto grid max-w-6xl gap-5 px-3 py-3 sm:px-6 sm:py-6 lg:grid-cols-[300px_1fr]">
      <aside className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${activeConversationId ? 'hidden lg:block' : 'block'}`}><div className="flex items-center justify-between"><h2 className="font-extrabold">{t.messages}</h2>{unreadCount > 0 && <span className="rounded-full bg-emerald-600 px-2 py-1 text-[11px] font-black text-white">{unreadCount} {t.newCount}</span>}</div><p className="mt-1 text-xs text-slate-500">{t.allChats}</p><div className="mt-4 space-y-2">{loading ? <p className="p-3 text-sm text-slate-400">{t.loading}</p> : conversations.length === 0 ? <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-400">{t.noChats}</p> : conversations.map(item => <button key={item.id} onClick={() => setActiveConversationId(item.id)} className={`w-full rounded-xl p-3 text-left ${item.id === activeConversationId ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'hover:bg-slate-50'}`}><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-extrabold text-slate-800">{item.title}</span>{item.unread > 0 && <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-black text-white">{item.unread}</span>}</span><span className="mt-1 block truncate text-xs text-slate-500">{item.lastMessage}</span></button>)}</div><div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t.notifications}</p>{notifications.slice(0, 6).map(note => <button key={note.id} onClick={() => { if (note.conversation_id) setActiveConversationId(note.conversation_id); void markNotificationRead(note.id) }} className={`mt-2 w-full rounded-xl p-3 text-left ${note.read_at ? 'bg-slate-50' : 'bg-emerald-50'}`}><span className="block text-xs font-extrabold text-slate-800">{note.title}</span><span className="mt-1 block line-clamp-2 text-xs text-slate-500">{note.body || t.newMessage}</span></button>)}</div></aside>
      <section className={`min-h-[calc(100dvh-88px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:min-h-[calc(100vh-128px)] ${activeConversationId ? 'flex' : 'hidden lg:flex'}`}><div className="border-b border-slate-200 p-4 sm:p-5"><button type="button" onClick={() => setActiveConversationId(null)} className="mb-3 inline-flex rounded-lg px-2 py-1 text-sm font-bold text-emerald-700 hover:bg-emerald-50 lg:hidden">← {t.messages}</button><p className="text-xs font-bold uppercase tracking-wide text-emerald-600">{t.listingChat}</p><div className="mt-1 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-lg font-black text-emerald-700">P</div><div><h1 className="font-extrabold">{activeConversation?.title || t.selectChat}</h1><p className="text-xs text-slate-500">{activeConversation ? t.conversation : t.startFromListing}</p></div></div></div><TransactionPanel conversationId={activeConversationId} /><div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 sm:p-6">{error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : !activeConversationId ? <p className="py-16 text-center text-sm text-slate-400">{t.selectLeft}</p> : messages.length === 0 ? <p className="py-16 text-center text-sm text-slate-400">{t.noMessages}</p> : messages.map(message => <div key={message.id} className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.mine ? 'rounded-br-md bg-emerald-600 text-white' : 'rounded-bl-md bg-white text-slate-700'}`}><p className="leading-6">{message.text}</p><p className={`mt-1 text-[10px] ${message.mine ? 'text-emerald-100' : 'text-slate-400'}`}>{message.time}</p></div></div>)}</div><div className="border-t border-slate-200 bg-white p-3 sm:p-4"><div className="flex items-end gap-2"><textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }} disabled={!activeConversationId} rows={1} placeholder={t.placeholder} className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-50"/><button onClick={() => void send()} disabled={sending || !activeConversationId} className="h-11 shrink-0 rounded-xl bg-emerald-600 px-5 font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{sending ? t.sending : t.send}</button></div><p className="mt-2 text-[11px] text-slate-400">{t.enter}</p></div></section>
    </div>
  </main>
}

export default function ChatPage() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><p className="text-sm font-medium text-slate-500">Chat yuklanmoqda...</p></main>}><ChatPageContent /></Suspense>
}
