import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/utils/admin/auth'

export default async function AdminHome(){
 const admin=await getCurrentAdmin(); if(!admin)redirect('/admin/login')
 return <main className="min-h-screen bg-slate-50"><header className="border-b bg-white"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4"><b className="text-xl">Prohouse Admin</b><span className="text-sm text-slate-500">{admin.user.email}</span></div></header><div className="mx-auto max-w-6xl px-4 py-10"><p className="font-bold text-emerald-600">Boshqaruv markazi</p><h1 className="mt-1 text-3xl font-black">Admin panel</h1><div className="mt-7 grid gap-5 md:grid-cols-2"><Link href="/admin/moderation" className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5"><div className="text-3xl">✓</div><h2 className="mt-4 text-xl font-black">E’lonlar moderatsiyasi</h2><p className="mt-2 text-sm text-slate-500">Hamkorlar yuborgan e’lonlarni tekshirish, tasdiqlash yoki rad etish.</p></Link>{admin.role.role==='super_admin'&&<Link href="/admin/administrators" className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5"><div className="text-3xl">♙</div><h2 className="mt-4 text-xl font-black">Administratorlar</h2><p className="mt-2 text-sm text-slate-500">Oddiy adminlarni yaratish, vakolatlarini berish va bloklash.</p></Link>}</div></div></main>
}
