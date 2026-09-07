'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function AdminLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) { setError('Login yoki parol noto‘g‘ri.'); setLoading(false); return }
    const res = await fetch('/api/admin/me', { cache: 'no-store' })
    if (!res.ok) { await supabase.auth.signOut(); setError('Bu akkauntga admin panelga kirish vakolati berilmagan.'); setLoading(false); return }
    router.replace('/admin')
    router.refresh()
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
      <div className="mb-8"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-xl font-black text-white">P</div><h1 className="mt-5 text-3xl font-black text-slate-900">Prohouse Admin</h1><p className="mt-2 text-sm text-slate-500">Boshqaruv paneliga xavfsiz kirish</p></div>
      <form onSubmit={submit} className="space-y-4">
        <div><label className="text-sm font-bold text-slate-700">Login / Email</label><input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="username" required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" placeholder="admin@prohouse.uz" /></div>
        <div><label className="text-sm font-bold text-slate-700">Parol</label><input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" /></div>
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
        <button disabled={loading} className="w-full rounded-xl bg-slate-900 px-5 py-3.5 font-bold text-white disabled:opacity-50">{loading ? 'Kirilmoqda...' : 'Kirish'}</button>
      </form>
    </div>
  </main>
}
