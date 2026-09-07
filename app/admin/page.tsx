import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentAdmin, serviceClient } from '@/utils/admin/auth'

async function getStats() {
  const supabase = serviceClient()
  const [{ count: total }, { count: moderation }, { count: active }, { count: rejected }, { count: partners }, { count: today }] = await Promise.all([
    supabase.from('listings').select('*', { count: 'exact', head: true }),
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'moderation'),
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'partner'),
    supabase.from('listings').select('*', { count: 'exact', head: true }).gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
  ])
  return { total: total ?? 0, moderation: moderation ?? 0, active: active ?? 0, rejected: rejected ?? 0, partners: partners ?? 0, today: today ?? 0 }
}

export default async function AdminHome() {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/admin/login')
  const stats = await getStats()
  const cards = [
    ['Jami e’lonlar', stats.total, 'Barcha e’lonlar'],
    ['Moderatsiyada', stats.moderation, 'Tekshiruv kutilmoqda'],
    ['Faol e’lonlar', stats.active, 'Saytda ko‘rinayotgan'],
    ['Rad etilgan', stats.rejected, 'Qayta ishlash mumkin'],
    ['Hamkorlar', stats.partners, 'Hamkor akkauntlar'],
    ['Bugun qo‘shilgan', stats.today, 'Bugungi yangi e’lonlar'],
  ]
  return <main className="min-h-screen bg-slate-50"><header className="border-b bg-white"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4"><b className="text-xl">Prohouse Admin</b><span className="text-sm text-slate-500">{admin.user.email}</span></div></header><div className="mx-auto max-w-6xl px-4 py-8"><p className="font-bold text-emerald-600">Boshqaruv markazi</p><h1 className="mt-1 text-3xl font-black">Admin panel</h1><div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3"><>{cards.map(([label,value,desc])=><div key={label} className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-black">{value}</p><p className="mt-1 text-xs text-slate-400">{desc}</p></div>)}</></div><div className="mt-7 grid gap-5 md:grid-cols-2"><Link href="/admin/moderation" className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5"><div className="text-3xl">✓</div><h2 className="mt-4 text-xl font-black">E’lonlar moderatsiyasi</h2><p className="mt-2 text-sm text-slate-500">Hamkorlar yuborgan e’lonlarni tekshirish, tasdiqlash yoki rad etish.</p><span className="mt-5 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">{stats.moderation} ta e’lonni ko‘rish</span></Link>{admin.role.role==='super_admin'&&<Link href="/admin/administrators" className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5"><div className="text-3xl">♙</div><h2 className="mt-4 text-xl font-black">Administratorlar</h2><p className="mt-2 text-sm text-slate-500">Oddiy adminlarni yaratish, vakolatlarini berish va bloklash.</p><span className="mt-5 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Boshqarish</span></Link>}</div></div></main>
}
