'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function AccountNavigation() {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    const loadUnread = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted || !user) {
        if (mounted) setUnreadCount(0)
        return
      }

      const { data: participantRows } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id)

      const conversationIds = (participantRows ?? []).map(row => row.conversation_id)
      if (!conversationIds.length) {
        if (mounted) setUnreadCount(0)
        return
      }

      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .neq('sender_id', user.id)
        .is('read_at', null)

      if (mounted) setUnreadCount(count ?? 0)
    }

    void loadUnread()

    const channel = supabase
      .channel(`account-unread-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        void loadUnread()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => {
        void loadUnread()
      })
      .subscribe()

    const onFocus = () => { void loadUnread() }
    window.addEventListener('focus', onFocus)

    return () => {
      mounted = false
      window.removeEventListener('focus', onFocus)
      void supabase.removeChannel(channel)
    }
  }, [])

  return (
    <nav className="border-b border-slate-100 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-end gap-2">
        <Link href="/account" className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
          Kabinet
        </Link>
        <Link href="/chat" className="relative rounded-xl bg-emerald-50 px-4 py-2 text-sm font-extrabold text-emerald-700 hover:bg-emerald-100">
          <span>💬 Xabarlar</span>
          {unreadCount > 0 && (
            <span
              aria-label={`${unreadCount} ta o‘qilmagan xabar`}
              className="absolute -right-1 -top-2 flex min-w-5 h-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black leading-none text-white ring-2 ring-white"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
        <Link href="/account/trusted-profile" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-extrabold text-emerald-700 hover:bg-emerald-100">
          ✓ Ishonchli profil
        </Link>
        <Link href="/account/wallet" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-extrabold text-emerald-700 hover:bg-emerald-100">
          Hisob va tranzaksiyalar
        </Link>
      </div>
    </nav>
  )
}
