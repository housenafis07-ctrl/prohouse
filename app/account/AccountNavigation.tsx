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

      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null)

      if (mounted) setUnreadCount(error ? 0 : (count ?? 0))
    }

    void loadUnread()

    const channel = supabase
      .channel(`account-notifications-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
        const row = payload.new as { user_id?: string; read_at?: string | null }
        if (row.user_id && row.read_at == null) void loadUnread()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, payload => {
        const row = payload.new as { user_id?: string }
        if (row.user_id) void loadUnread()
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
              className="absolute -right-1 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black leading-none text-white ring-2 ring-white"
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
