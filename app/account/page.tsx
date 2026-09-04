'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Profile = {
  phone: string | null
  full_name: string | null
  account_type: 'individual' | 'partner' | null
  partner_type: string | null
  company_name: string | null
  inn: string | null
  bank_name: string | null
  bank_account: string | null
  mfo: string | null
  oked: string | null
  director_full_name: string | null
}

const partnerLabels: Record<string, string> = {
  self_employed: "O‘zini o‘zi band qilgan — O‘BQ",
  sole_proprietor: 'Yakka tartibdagi tadbirkor — YaTT',
  llc: 'Mas’uliyati cheklangan jamiyat — MChJ',
}

export default function AccountPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/register'); return }
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('phone,full_name,account_type,partner_type,company_name,inn,bank_name,bank_account,mfo,oked,director_full_name')
        .eq('id', user.id).maybeSingle()
      if (!mounted) return
      if (profileError) setError(profileError.message)
      const value: Profile = data ?? {
        phone: user.phone ?? null, full_name: null, account_type: 'individual', partner_type: null,
        company_name: null, inn: null, bank_name: null, bank_account: null, mfo: null, oked: null, director_full_name: null,
      }
      setProfile(value); setForm(value); setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [router])

  const setField = (key: keyof Profile, value: string) => setForm(v => v ? { ...v, [key]: value } : v)

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    if (!form.full_name?.trim()) { setError('F.I.O. ni kiriting.'); return }
    if (form.account_type === 'partner' && !form.inn?.trim()) { setError('INN ni kiriting.'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/register'); return }
      const { data, error: updateError } = await supabase.from('profiles').update({
        full_name: form.full_name?.trim() || null,
        account_type: form.account_type || 'individual',
        partner_type: form.account_type === 'partner' ? form.partner_type : null,
        company_name: form.company_name?.trim() || null,
        inn: form.inn?.trim() || null,
        bank_name: form.bank_name?.trim() || null,
        bank_account: form.bank_account?.trim() || null,
        mfo: form.mfo?.trim() || null,
        oked: form.oked?.trim() || null,
        director_full_name: form.director_full_name?.trim() || null,
      }).eq('id', user.id).select('phone,full_name,account_type,partner_type,company_name,inn,bank_name,bank_account,mfo,oked,director_full_name').single()
      if (updateError) throw updateError
      setProfile(data); setForm(data); setEditing(false); setSuccess('Profil ma’lumotlari saqlandi.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Profilni saqlashda xatolik') }
    finally { setSaving(false) }
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut(); router.replace('/'); router.refresh()
  }

  if (loading) return <main className="min-h-screen bg-slate-50 px-4 py-12"><div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 text-center shadow-sm">Yuklanmoqda...</div></main>
  if (!profile || !form) return null

  const isPartner = profile.account_type === 'partner'
  const display = editing ? form : profile

  const Field = ({ label, value, field, required = false, disabled = false }: { label: string; value: string | null; field: keyof Profile; required?: boolean; disabled?: boolean }) => (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      {editing && !disabled ? <input value={String(form[field] ?? '')} onChange={e => setField(field, e.target.value)} required={required} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-semibold text-slate-900 outline-none focus:border-emerald-500" /> : <p className="mt-2 font-bold text-slate-900">{value || '—'}</p>}
    </div>
  )

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-bold text-emerald-700">← Prohouse</Link>
          <button onClick={signOut} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Chiqish</button>
        </div>

        <section className="mt-5 overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="bg-slate-900 px-6 py-7 text-white sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-sm font-semibold text-slate-300">Shaxsiy kabinet</p><h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{profile.full_name || 'Prohouse foydalanuvchisi'}</h1><p className="mt-2 text-sm text-slate-300">{profile.phone || 'Telefon raqami ko‘rsatilmagan'}</p></div>
              {!editing && <button onClick={() => { setForm(profile); setEditing(true); setError(''); setSuccess('') }} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20">Tahrirlash</button>}
            </div>
          </div>

          <form onSubmit={saveProfile} className="p-6 sm:p-8">
            {editing && <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Telefon raqami tasdiqlangan akkauntga bog‘langan va bu yerda o‘zgartirilmaydi.</div>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="F.I.O." value={display.full_name} field="full_name" required />
              <Field label="Telefon raqami" value={display.phone} field="phone" disabled />
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Akkaunt turi</p><p className="mt-2 font-bold text-slate-900">{isPartner ? 'Hamkor' : 'Jismoniy shaxs'}</p></div>
              {isPartner && <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Hamkor turi</p>{editing ? <select value={form.partner_type || ''} onChange={e => setField('partner_type', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-semibold"><option value="self_employed">O‘zini o‘zi band qilgan — O‘BQ</option><option value="sole_proprietor">Yakka tartibdagi tadbirkor — YaTT</option><option value="llc">Mas’uliyati cheklangan jamiyat — MChJ</option></select> : <p className="mt-2 font-bold text-slate-900">{partnerLabels[profile.partner_type || ''] || '—'}</p>}</div>}
              {isPartner && <Field label="INN" value={display.inn} field="inn" required />}
              {isPartner && <Field label="Tashkilot" value={display.company_name} field="company_name" />}
              {isPartner && <Field label="Rahbar F.I.O." value={display.director_full_name} field="director_full_name" />}
              {isPartner && <Field label="Bank nomi" value={display.bank_name} field="bank_name" />}
              {isPartner && <Field label="Hisob raqami" value={display.bank_account} field="bank_account" />}
              {isPartner && <Field label="MFO" value={display.mfo} field="mfo" />}
              {isPartner && <Field label="OKED" value={display.oked} field="oked" />}
            </div>

            {error && <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}
            {success && <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}

            {editing && <div className="mt-6 flex gap-3"><button type="button" onClick={() => { setForm(profile); setEditing(false); setError(''); setSuccess('') }} className="flex-1 rounded-2xl border border-slate-200 px-5 py-4 font-bold text-slate-700">Bekor qilish</button><button disabled={saving} className="flex-1 rounded-2xl bg-emerald-600 px-5 py-4 font-bold text-white disabled:opacity-50">{saving ? 'Saqlanmoqda...' : 'Saqlash'}</button></div>}

            {!editing && <div className="mt-6 grid gap-3 sm:grid-cols-2"><Link href="/listings" className="rounded-2xl border border-slate-200 px-5 py-4 text-center font-bold text-slate-900 hover:bg-slate-50">E’lonlarni ko‘rish</Link><Link href="/" className="rounded-2xl bg-emerald-600 px-5 py-4 text-center font-bold text-white hover:bg-emerald-700">Bosh sahifaga qaytish</Link></div>}
          </form>
        </section>
      </div>
    </main>
  )
}
