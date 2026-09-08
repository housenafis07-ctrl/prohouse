'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Message = { id: string; text: string; mine: boolean; time: string }
type Notification = { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }

export default function ChatPage() {
  const searchParams = useSearchParams()
  const conversationId = searchParams.get('conversationId')
  const listingId = searchParams.get('listingId')
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return
      if (!user) { setError('Chatdan foydalanish uchun tizimga kiring.'); setLoading(false); return }
      setUserId(user.id)

      let activeConversationId = conversationId
      if (!activeConversationId && listingId) {
        const { data: participantRows } = await supabase.from('conversation_participants').select('conversation_id').eq('user_id', user.id)
        const ids = participantRows?.map(row => row.conversation_id) ?? []
        if (ids.length) {
          const { data: existing } = await supabase.from('conversations').select('id').eq('listing_id', listingId).in('id', ids).order('updated_at', { ascending: false }).limit(1).maybeSingle()
          activeConversationId = existing?.id ?? null
        }
      }

      if (activeConversationId) {
        const { data, error: messageError } = await supabase.from('messages').select('id,conversation_id,sender_id,body,created_at,read_at').eq('conversation_id', activeConversationId).order('created_at', { ascending: true })
        if (messageError) setError(messageError.message)
        if (mounted) setMessages((data ?? []).map(message => ({ id: message.id, text: message.body, mine: message.sender_id === user.id, time: new Date(message.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) })))
        await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('conversation_id', activeConversationId).neq('sender_id', user.id).is('read_at', null)
      } else {
        if (mounted) setError('Suhbat topilmadi. E’lon sahifasidan “Chatga yozish” tugmasi orqali kiring.')
      }

      const { data: noteRows } = await supabase.from('notifications').select('id,title,body,link,read_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
      if (mounted) setNotifications(noteRows ?? [])
      setLoading(false)
    }
    void load()
    return () => { mounted = false }
  }, [conversationId, listingId, supabase])

  useEffect(() => {
    if (!userId || !conversationId) return
    const channel = supabase.channel(`prohouse-chat-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, payload => {
        const row = payload.new as any
        setMessages(current => current.some(message => message.id === row.id) ? current : [...current, { id: row.id, text: row.body, mine: row.sender_id === userId, time: new Date(row.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) }])
        if (row.sender_id !== userId) void supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', row.id)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => {
        const row = payload.new as Notification
        setNotifications(current => [row, ...current.filter(item => item.id !== row.id)].slice(0, 20))
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [conversationId, supabase, userId])

  const send = async () => {
    const value = text.trim()
    if (!value || !userId || !conversationId || sending) return
    setSending(true); setError('')
    const { error: sendError } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: userId, body: value })
    if (sendError) setError(sendError.message)
    else setText('')
    setSending(false)
  }

  const unreadCount = notifications.filter(item => !item.read_at).length

  const markNotificationRead = async (id: string) => {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    setNotifications(current => current.map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item))
  }

  return <main className="min-h-screen bg-slate-50">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white">⌂</span>Pro<span className="text-emerald-500">house</span></Link>
        <div className="flex items-center gap-2"><Link href="/account" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Kabinet</Link><Link href="/listings" className="text-sm font-bold text-slate-600 hover:text-emerald-600">← E’lonlarga qaytish</Link></div>
      </div>
    </header>

    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between"><h2 className="font-extrabold">Prohouse Chat</h2>{unreadCount > 0 && <span className="rounded-full bg-emerald-600 px-2 py-1 text-[11px] font-black text-white">{unreadCount} yangi</span>}</div>
        <p className="mt-2 text-sm leading-6 text-slate-500">Sotuvchi yoki rieltor bilan yozishmalar shu yerda saqlanadi.</p>
        <div className="mt-5 space-y-2"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Bildirishnomalar</p>{notifications.length === 0 ? <p className="text-sm text-slate-400">Hozircha yangi xabar yo‘q.</p> : notifications.slice(0, 8).map(note => <button key={note.id} onClick={() => markNotificationRead(note.id)} className={`w-full rounded-xl p-3 text-left ${note.read_at ? 'bg-slate-50' : 'bg-emerald-50'}`}><span className="block text-xs font-extrabold text-slate-800">{note.title}</span><span className="mt-1 block line-clamp-2 text-xs text-slate-500">{note.body || 'Yangi xabar'}</span></button>)}</div>
        <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">✓ Xabarlar Supabase orqali saqlanadi va real vaqtda yangilanadi.</div>
      </aside>

      <section className="flex min-h-[calc(100vh-128px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5"><p className="text-xs font-bold uppercase tracking-wide text-emerald-600">E’lon bo‘yicha chat</p><div className="mt-1 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-lg font-black text-emerald-700">P</div><div><h1 className="font-extrabold">Prohouse sotuvchisi</h1><p className="text-xs text-slate-500">Onlayn muloqot</p></div></div></div>
        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 sm:p-6">{loading ? <p className="text-center text-sm text-slate-400">Yuklanmoqda...</p> : messages.length === 0 ? <p className="text-center text-sm text-slate-400">Hali xabarlar yo‘q.</p> : messages.map(message => <div key={message.id} className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.mine ? 'rounded-br-md bg-emerald-600 text-white' : 'rounded-bl-md bg-white text-slate-700'}`}><p className="leading-6">{message.text}</p><p className={`mt-1 text-[10px] ${message.mine ? 'text-emerald-100' : 'text-slate-400'}`}>{message.time}</p></div></div>)}</div>
        <div className="border-t border-slate-200 bg-white p-3 sm:p-4"><div className="flex items-end gap-2"><textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }} rows={1} placeholder="Xabaringizni yozing..." className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"/><button onClick={() => void send()} disabled={sending || !conversationId} className="h-11 shrink-0 rounded-xl bg-emerald-600 px-5 font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{sending ? 'Yuborilmoqda...' : 'Yuborish'}</button></div><p className="mt-2 text-[11px] text-slate-400">Enter — yuborish · Shift+Enter — yangi qator</p></div>
      </section>
    </div>
  </main>
}
