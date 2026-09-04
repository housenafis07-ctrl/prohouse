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
  self_employed: 'O‘zini o‘zi band qilgan — O‘BQ',
  sole_proprietor: 'Yakka tartibdagi tadbirkor — YaTT',
  llc: 'Mas’uliyati cheklangan jamiyat — MChJ',
}

type FieldProps = {
  label: string
  value: string | null
  form: Profile
  field: keyof Profile
  editing: boolean
  required?: boolean
  disabled?: boolean
  onChange: (field: keyof Profile, value: string) => void
}

function ProfileField({ label, value, form, field, editing, required = false, disabled = false, onChange }: FieldProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      {editing && !disabled ? (
        <input value={String(form[field] ?? '')} onChange={e => onChange(field, e.target.value)} required={required} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-semibold text-slate-900 outline-none focus:border-emerald-500" />
      ) : (
        <p className="mt-2 font-bold text-slate-900">{value || '—'}</p>
      )}
    </div>
  )
}

function StatusIcon({ type }: { type: 'check' | 'user' | 'home' | 'plus' | 'help' }) {
  const symbols = { check: '✓', user: '◉', home: '⌂', plus: '+', help: '?' }
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg font-black text-emerald-600">{symbols[type]}</span>
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
      const { data, error: profileError } = await supabase.from('profiles').select('phone,full_name,account_type,partner_type,company_name,inn,bank_name,bank_account,mfo,oked,director_full_name').eq('id', user.id).maybeSingle()
      if (!mounted) return
      if (profileError) setError(profileError.message)
      const value: Profile = data ?? { phone: user.phone ?? null, full_name: null, account_type: 'individual', partner_type: null, company_name: null, inn: null, bank_name: null, bank_account: null, mfo: null, oked: null, director_full_name: null }
      setProfile(value)
      setForm(value)
      setLoading(false)
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
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/register'); return }
      const { data, error: updateError } = await supabase.from('profiles').update({ full_name: form.full_name?.trim() || null, account_type: form.account_type || 'individual', partner_type: form.account_type === 'partner' ? form.partner_type : null, company_name: form.company_name?.trim() || null, inn: form.inn?.trim() || null, bank_name: form.bank_name?.trim() || null, bank_account: form.bank_account?.trim() || null, mfo: form.mfo?.trim() || null, oked: form.oked?.trim() || null, director_full_name: form.director_full_name?.trim() || null }).eq('id', user.id).select('phone,full_name,account_type,partner_type,company_name,inn,bank_name,bank_account,mfo,oked,director_full_name').single()
      if (updateError) throw updateError
      setProfile(data)
      setForm(data)
      setEditing(false)
      setSuccess('Profil ma’lumotlari saqlandi.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Profilni saqlashda xatolik')
    } finally {
      setSaving(false)
    }
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/')
    router.refresh()
  }

  if (loading) return <main className="min-h-screen bg-slate-50 px-4 py-12"><div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 text-center shadow-sm">Yuklanmoqda...</div></main>
  if (!profile || !form) return null

  const isPartner = profile.account_type === 'partner'
  const display = editing ? form : profile
  const hasName = Boolean(profile.full_name?.trim())
  const hasPhone = Boolean(profile.phone?.trim())
  const hasPartnerData = !isPartner || Boolean(profile.inn?.trim())
  const completed = [hasPhone, hasName, hasPartnerData].filter(Boolean).length
  const completion = Math.round((completed / 3) * 100)

  const actions = isPartner ? [
    { icon: 'plus' as const, title: 'E’lon joylashtirish', text: 'Mulkingizni Prohouse’da soting yoki ijaraga bering.', href: '/listings', primary: true },
    { icon: 'home' as const, title: 'E’lonlarni ko‘rish', text: 'Bozordagi yangi uylar va boshqa takliflarni ko‘ring.', href: '/listings', primary: false },
  ] : [
    { icon: 'home' as const, title: 'Uy topishni boshlash', text: 'Sotuv va ijara bo‘yicha mos takliflarni ko‘ring.', href: '/listings', primary: true },
    { icon: 'user' as const, title: 'Profilni to‘ldirish', text: 'Ma’lumotlaringizni yangilang va keyingi xizmatlarga tayyor bo‘ling.', href: '#profile', primary: false },
  ]

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-extrabold text-emerald-700">← Prohouse</Link>
          <button onClick={signOut} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Chiqish</button>
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.55fr_.8fr]">
          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="bg-slate-900 px-6 py-7 text-white sm:px-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-300">Shaxsiy kabinet</p>
                  <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{profile.full_name || 'Prohouse foydalanuvchisi'}</h1>
                  <p className="mt-2 text-sm text-slate-300">{profile.phone || 'Telefon raqami ko‘rsatilmagan'}</p>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-2 text-center">
                  <div className="text-xl font-black">{completion}%</div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-300">profil</div>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8" id="profile">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div><h2 className="text-lg font-extrabold text-slate-900">Shaxsiy ma’lumotlar</h2><p className="mt-1 text-sm text-slate-500">Akkauntingizga tegishli asosiy ma’lumotlar.</p></div>
                {!editing && <button onClick={() => { setForm(profile); setEditing(true); setError(''); setSuccess('') }} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200">Tahrirlash</button>}
              </div>

              <form onSubmit={saveProfile}>
                {editing && <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Telefon raqami tasdiqlangan akkauntga bog‘langan va bu yerda o‘zgartirilmaydi.</div>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <ProfileField label="F.I.O." value={display.full_name} form={form} field="full_name" editing={editing} required onChange={setField} />
                  <ProfileField label="Telefon raqami" value={display.phone} form={form} field="phone" editing={editing} disabled onChange={setField} />
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Akkaunt turi</p><p className="mt-2 font-bold text-slate-900">{isPartner ? 'Hamkor' : 'Jismoniy shaxs'}</p></div>
                  {isPartner && <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Hamkor turi</p>{editing ? <select value={form.partner_type || ''} onChange={e => setField('partner_type', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-semibold"><option value="self_employed">O‘zini o‘zi band qilgan — O‘BQ</option><option value="sole_proprietor">Yakka tartibdagi tadbirkor — YaTT</option><option value="llc">Mas’uliyati cheklangan jamiyat — MChJ</option></select> : <p className="mt-2 font-bold text-slate-900">{partnerLabels[profile.partner_type || ''] || '—'}</p>}</div>}
                  {isPartner && <ProfileField label="INN" value={display.inn} form={form} field="inn" editing={editing} required onChange={setField} />}
                  {isPartner && <ProfileField label="Tashkilot" value={display.company_name} form={form} field="company_name" editing={editing} onChange={setField} />}
                  {isPartner && <ProfileField label="Rahbar F.I.O." value={display.director_full_name} form={form} field="director_full_name" editing={editing} onChange={setField} />}
                  {isPartner && <ProfileField label="Bank nomi" value={display.bank_name} form={form} field="bank_name" editing={editing} onChange={setField} />}
                  {isPartner && <ProfileField label="Hisob raqami" value={display.bank_account} form={form} field="bank_account" editing={editing} onChange={setField} />}
                  {isPartner && <ProfileField label="MFO" value={display.mfo} form={form} field="mfo" editing={editing} onChange={setField} />}
                  {isPartner && <ProfileField label="OKED" value={display.oked} form={form} field="oked" editing={editing} onChange={setField} />}
                </div>
                {error && <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}
                {success && <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}
                {editing && <div className="mt-6 flex gap-3"><button type="button" onClick={() => { setForm(profile); setEditing(false); setError(''); setSuccess('') }} className="flex-1 rounded-2xl border border-slate-200 px-5 py-4 font-bold text-slate-700">Bekor qilish</button><button disabled={saving} className="flex-1 rounded-2xl bg-emerald-600 px-5 py-4 font-bold text-white disabled:opacity-50">{saving ? 'Saqlanmoqda...' : 'Saqlash'}</button></div>}
              </form>
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-extrabold text-slate-900">Akkaunt holati</h2>
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-50 p-4"><StatusIcon type="check" /><div><p className="font-extrabold text-emerald-800">Akkaunt faol</p><p className="text-xs text-emerald-700">Telefon raqami tasdiqlangan</p></div></div>
              <div className="mt-4"><div className="flex justify-between text-xs font-bold text-slate-500"><span>Profil to‘liqligi</span><span>{completion}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${completion}%` }} /></div></div>
              {!hasName && <p className="mt-4 text-sm text-slate-600">Profilni to‘liq ishlatish uchun F.I.O. ma’lumotini kiriting.</p>}
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-extrabold text-slate-900">Keyingi qadamlar</h2>
              <div className="mt-4 space-y-3">
                {actions.map(action => <Link key={action.title} href={action.href} className={`flex gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 ${action.primary ? 'border-emerald-100 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}><StatusIcon type={action.icon} /><span><span className="block font-extrabold text-slate-900">{action.title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{action.text}</span></span></Link>)}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-3"><StatusIcon type="help" /><div><h2 className="font-extrabold text-slate-900">Yordam kerakmi?</h2><p className="mt-1 text-sm leading-6 text-slate-500">Prohouse xizmatlari bo‘yicha savolingiz bo‘lsa, biz bilan bog‘lanishingiz mumkin.</p><Link href="/" className="mt-3 inline-block text-sm font-extrabold text-emerald-700">Bosh sahifaga qaytish →</Link></div></div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
