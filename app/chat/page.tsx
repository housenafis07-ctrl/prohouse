'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Message = { id: string; text: string; mine: boolean; time: string }
type Conversation = { id: string; listing_id: string | null; updated_at: string; title: string; lastMessage: string; unread: number }
type Notification = { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string; conversation_id: string | null }
type Transaction = { id: string; listing_id: string; lead_id: string; buyer_id: string; seller_id: string; status: string; amount: number | null; currency: string; metadata: Record<string, unknown>; created_at: string; updated_at: string }
type Lead = { id: string; listing_id: string; owner_id: string; visitor_id: string; status: string; lead_type: string; created_at: string }

const statusSteps = [
  ['lead', 'Lead'], ['viewing', 'Ko‘rish'], ['offer', 'Taklif'], ['deal', 'Bitim'], ['payment', 'To‘lov'], ['contract', 'Shartnoma'],
] as const
const nextStatus: Record<string, string> = { lead: 'viewing', viewing: 'offer', offer: 'deal', deal: 'payment', payment: 'contract' }

function TransactionPanel({ conversationId, userId }: { conversationId: string; userId: string }) {
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/transactions/chat?conversationId=${encodeURIComponent(conversationId)}`, { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Transaction ma’lumotini olishda xatolik.')
      setTransaction(data.transaction ?? null); setLead(data.lead ?? null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Transaction yuklanmadi.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [conversationId])

  const createTransaction = async () => {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Transaction yaratilmadi.')
      setTransaction(data.transaction)
    } catch (e) { setError(e instanceof Error ? e.message : 'Transaction yaratilmadi.') }
    finally { setBusy(false) }
  }

  const transition = async (status: string) => {
    if (!transaction || busy) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Transaction statusini o‘zgartirib bo‘lmadi.')
      setTransaction(data.transaction)
    } catch (e) { setError(e instanceof Error ? e.message : 'Status o‘zgartirilmadi.') }
    finally { setBusy(false) }
  }

  if (loading) return <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">Bitim holati yuklanmoqda...</div>
  if (error && !lead) return <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">{error}</div>
  if (!lead) return <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">Bu suhbat uchun lead hali aniqlanmadi.</div>

  const currentIndex = transaction ? statusSteps.findIndex(([status]) => status === transaction.status) : -1
  const next = transaction ? nextStatus[transaction.status] : null
  const isParticipant = transaction ? transaction.buyer_id === userId || transaction.seller_id === userId : true
  if (!isParticipant) return null

  return <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">Bitim</p><p className="text-sm font-extrabold text-slate-800">E’lon bo‘yicha transaction</p></div>
      {!transaction && <button onClick={() => void createTransaction()} disabled={busy} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-60">{busy ? 'Ochilyapti...' : 'Bitimni boshlash'}</button>}
    </div>
    {transaction && <>
      <div className="mt-3 grid grid-cols-6 gap-1.5">{statusSteps.map(([status, label], index) => <div key={status} className="min-w-0 text-center"><div className={`mx-auto h-2.5 w-2.5 rounded-full ${index <= currentIndex ? 'bg-emerald-600' : 'bg-slate-300'}`} /><p className={`mt-1 truncate text-[9px] font-bold ${index <= currentIndex ? 'text-emerald-700' : 'text-slate-400'}`}>{label}</p></div>)}</div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
        <div><span className="text-xs text-slate-500">Hozirgi holat: </span><span className="text-xs font-black text-slate-800">{statusSteps.find(([status]) => status === transaction.status)?.[1] || transaction.status}</span></div>
        {next && <button onClick={() => void transition(next)} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-60">{busy ? '...' : `Keyingi bosqich: ${statusSteps.find(([status]) => status === next)?.[1]}`}</button>}
        {transaction.status !== 'contract' && transaction.status !== 'cancelled' && <button onClick={() => void transition('cancelled')} disabled={busy} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60">Bekor qilish</button>}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </>}
  </div>
}

function ChatPageContent() {
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return
      if (!user) { setError('Chatdan foydalanish uchun tizimga kiring.'); setLoading(false); return }
      setUserId(user.id)
      const { data: participantRows, error: participantError } = await supabase.from('conversation_participants').select('conversation_id').eq('user_id', user.id)
      if (participantError) { setError(participantError.message); setLoading(false); return }
      const ids = participantRows?.map(row => row.conversation_id) ?? []
      let list: Conversation[] = []
      if (ids.length) {
        const { data: rows, error: conversationError } = await supabase.from('conversations').select('id,listing_id,updated_at,listings(title)').in('id', ids).order('updated_at', { ascending: false })
        if (conversationError) setError(conversationError.message)
        list = (rows ?? []).map((row: any) => ({ id: row.id, listing_id: row.listing_id, updated_at: row.updated_at, title: row.listings?.title || 'E’lon bo‘yicha suhbat', lastMessage: '', unread: 0 }))
        for (const conversation of list) {
          const { data: last } = await supabase.from('messages').select('body,sender_id,created_at').eq('conversation_id', conversation.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
          conversation.lastMessage = last?.body || 'Hali xabar yo‘q'
          const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conversation.id).neq('sender_id', user.id).is('read_at', null)
          conversation.unread = count ?? 0
        }
      }
      if (listingId && !requestedConversationId) { const existing = list.find(item => item.listing_id === listingId); if (existing) setActiveConversationId(existing.id) }
      if (!requestedConversationId && !listingId && list[0]) setActiveConversationId(list[0].id)
      if (mounted) setConversations(list)
      const { data: noteRows } = await supabase.from('notifications').select('id,title,body,link,read_at,created_at,conversation_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30)
      if (mounted) setNotifications(noteRows ?? [])
      setLoading(false)
    }
    void load(); return () => { mounted = false }
  }, [listingId, requestedConversationId, supabase])

  useEffect(() => {
    let mounted = true
    const loadMessages = async () => {
      if (!activeConversationId || !userId) { if (mounted) setMessages([]); return }
      const { data, error: messageError } = await supabase.from('messages').select('id,sender_id,body,created_at,read_at').eq('conversation_id', activeConversationId).order('created_at', { ascending: true })
      if (messageError) { if (mounted) setError(messageError.message); return }
      if (mounted) setMessages((data ?? []).map(message => ({ id: message.id, text: message.body, mine: message.sender_id === userId, time: new Date(message.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) })))
      await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('conversation_id', activeConversationId).neq('sender_id', userId).is('read_at', null)
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).eq('conversation_id', activeConversationId).is('read_at', null)
      if (mounted) { setConversations(current => current.map(item => item.id === activeConversationId ? { ...item, unread: 0 } : item)); setNotifications(current => current.map(item => item.conversation_id === activeConversationId ? { ...item, read_at: new Date().toISOString() } : item)) }
    }
    void loadMessages(); return () => { mounted = false }
  }, [activeConversationId, supabase, userId])

  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel(`prohouse-user-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const row = payload.new as any
        setConversations(current => current.map(conversation => conversation.id === row.conversation_id ? { ...conversation, lastMessage: row.body, updated_at: row.created_at, unread: row.sender_id === userId || row.conversation_id === activeConversationId ? 0 : conversation.unread + 1 } : conversation).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
        if (row.conversation_id === activeConversationId) { setMessages(current => current.some(message => message.id === row.id) ? current : [...current, { id: row.id, text: row.body, mine: row.sender_id === userId, time: new Date(row.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) }]); if (row.sender_id !== userId) void supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', row.id) }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => { const row = payload.new as Notification; setNotifications(current => [row, ...current.filter(item => item.id !== row.id)].slice(0, 30)) })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [activeConversationId, supabase, userId])

  const send = async () => {
    const value = text.trim(); if (!value || !userId || !activeConversationId || sending) return
    setSending(true); setError('')
    try {
      const response = await fetch('/api/chat/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: activeConversationId, text: value }) })
      const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || 'Xabar yuborilmadi')
      const data = result.message
      if (data) { setMessages(current => current.some(message => message.id === data.id) ? current : [...current, { id: data.id, text: data.body, mine: true, time: new Date(data.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) }]); setConversations(current => current.map(item => item.id === activeConversationId ? { ...item, lastMessage: data.body, updated_at: data.created_at } : item)) }
      setText('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Xabar yuborilmadi') } finally { setSending(false) }
  }

  const unreadCount = notifications.filter(item => !item.read_at).length
  const activeConversation = conversations.find(item => item.id === activeConversationId)
  const markNotificationRead = async (id: string) => { const now = new Date().toISOString(); await supabase.from('notifications').update({ read_at: now }).eq('id', id); setNotifications(current => current.map(item => item.id === id ? { ...item, read_at: now } : item)) }

  return <main className="min-h-screen bg-slate-50">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6"><Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white">⌂</span>Pro<span className="text-emerald-500">house</span></Link><div className="flex items-center gap-2"><Link href="/account" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Kabinet</Link><Link href="/listings" className="text-sm font-bold text-slate-600 hover:text-emerald-600">← E’lonlarga qaytish</Link></div></div></header>
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[300px_1fr]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-extrabold">Xabarlar</h2>{unreadCount > 0 && <span className="rounded-full bg-emerald-600 px-2 py-1 text-[11px] font-black text-white">{unreadCount} yangi</span>}</div><p className="mt-1 text-xs text-slate-500">Barcha e’lonlar bo‘yicha yozishmalar.</p><div className="mt-4 space-y-2">{loading ? <p className="p-3 text-sm text-slate-400">Yuklanmoqda...</p> : conversations.length === 0 ? <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-400">Hozircha suhbatlar yo‘q.</p> : conversations.map(item => <button key={item.id} onClick={() => setActiveConversationId(item.id)} className={`w-full rounded-xl p-3 text-left ${item.id === activeConversationId ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'hover:bg-slate-50'}`}><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-extrabold text-slate-800">{item.title}</span>{item.unread > 0 && <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-black text-white">{item.unread}</span>}</span><span className="mt-1 block truncate text-xs text-slate-500">{item.lastMessage}</span></button>)}</div><div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Bildirishnomalar</p>{notifications.slice(0, 6).map(note => <button key={note.id} onClick={() => { if (note.conversation_id) setActiveConversationId(note.conversation_id); void markNotificationRead(note.id) }} className={`mt-2 w-full rounded-xl p-3 text-left ${note.read_at ? 'bg-slate-50' : 'bg-emerald-50'}`}><span className="block text-xs font-extrabold text-slate-800">{note.title}</span><span className="mt-1 block line-clamp-2 text-xs text-slate-500">{note.body || 'Yangi xabar'}</span></button>)}</div></aside>
      <section className="flex min-h-[calc(100vh-128px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><p className="text-xs font-bold uppercase tracking-wide text-emerald-600">E’lon bo‘yicha chat</p><div className="mt-1 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-lg font-black text-emerald-700">P</div><div><h1 className="font-extrabold">{activeConversation?.title || 'Suhbatni tanlang'}</h1><p className="text-xs text-slate-500">{activeConversation ? 'Sotuvchi/xaridor bilan yozishma' : 'E’lon sahifasidan chatni boshlang'}</p></div></div>{activeConversationId && userId && <TransactionPanel conversationId={activeConversationId} userId={userId} />}</div><div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 sm:p-6">{error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : !activeConversationId ? <p className="py-16 text-center text-sm text-slate-400">Chap tomondan suhbatni tanlang.</p> : messages.length === 0 ? <p className="py-16 text-center text-sm text-slate-400">Hali xabarlar yo‘q.</p> : messages.map(message => <div key={message.id} className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.mine ? 'rounded-br-md bg-emerald-600 text-white' : 'rounded-bl-md bg-white text-slate-700'}`}><p className="leading-6">{message.text}</p><p className={`mt-1 text-[10px] ${message.mine ? 'text-emerald-100' : 'text-slate-400'}`}>{message.time}</p></div></div>)}</div><div className="border-t border-slate-200 bg-white p-3 sm:p-4"><div className="flex items-end gap-2"><textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }} disabled={!activeConversationId} rows={1} placeholder="Xabaringizni yozing..." className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-50"/><button onClick={() => void send()} disabled={sending || !activeConversationId} className="h-11 shrink-0 rounded-xl bg-emerald-600 px-5 font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{sending ? 'Yuborilmoqda...' : 'Yuborish'}</button></div><p className="mt-2 text-[11px] text-slate-400">Enter — yuborish · Shift+Enter — yangi qator</p></div></section>
    </div>
  </main>
}

export default function ChatPage() { return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><p className="text-sm font-medium text-slate-500">Chat yuklanmoqda...</p></main>}><ChatPageContent /></Suspense> }
