'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Message = { id: number; text: string; mine: boolean; time: string }

const initialMessages: Message[] = [
  { id: 1, text: 'Assalomu alaykum! E’lon bo‘yicha savolingizni yozishingiz mumkin.', mine: false, time: '10:24' },
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [text, setText] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('prohouse-chat-demo')
      if (saved) setMessages(JSON.parse(saved))
    } catch {}
  }, [])

  const send = () => {
    const value = text.trim()
    if (!value) return
    const now = new Date()
    const message: Message = {
      id: Date.now(),
      text: value,
      mine: true,
      time: now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
    }
    const next = [...messages, message]
    setMessages(next)
    localStorage.setItem('prohouse-chat-demo', JSON.stringify(next))
    setText('')
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white">⌂</span>
            Pro<span className="text-emerald-500">house</span>
          </Link>
          <Link href="/listings" className="text-sm font-bold text-slate-600 hover:text-emerald-600">← E’lonlarga qaytish</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[280px_1fr]">
        <aside className="hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:block">
          <h2 className="font-extrabold">Prohouse Chat</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Sotuvchi yoki rieltor bilan e’lon bo‘yicha yozishmalar shu yerda saqlanadi.</p>
          <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">✓ Yozishmalar brauzeringizda vaqtincha saqlanadi.</div>
        </aside>

        <section className="flex min-h-[calc(100vh-128px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">E’lon bo‘yicha chat</p>
            <div className="mt-1 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-lg font-black text-emerald-700">P</div>
              <div><h1 className="font-extrabold">Prohouse sotuvchisi</h1><p className="text-xs text-slate-500">Onlayn muloqot</p></div>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 sm:p-6">
            {messages.map(message => (
              <div key={message.id} className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.mine ? 'rounded-br-md bg-emerald-600 text-white' : 'rounded-bl-md bg-white text-slate-700'}`}>
                  <p className="leading-6">{message.text}</p>
                  <p className={`mt-1 text-[10px] ${message.mine ? 'text-emerald-100' : 'text-slate-400'}`}>{message.time}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex items-end gap-2">
              <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} rows={1} placeholder="Xabaringizni yozing..." className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500" />
              <button onClick={send} className="h-11 shrink-0 rounded-xl bg-emerald-600 px-5 font-bold text-white hover:bg-emerald-700">Yuborish</button>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Enter — yuborish · Shift+Enter — yangi qator</p>
          </div>
        </section>
      </div>
    </main>
  )
}
