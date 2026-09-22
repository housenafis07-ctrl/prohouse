'use client'

import Link from 'next/link'
import { useState } from 'react'

const groups = [
  { id: 'realtor', label: 'Rieltorlar va agentliklar', title: 'Ko‘proq mijoz, qulayroq ish jarayoni', description: 'Royalhouse’da ko‘chmas mulk e’lonlaringizni joylashtiring, murojaatlarni bir joyda boshqaring va mijozlar bilan ishlashni soddalashtiring.', bullets: ['E’lonlarni joylashtirish va boshqarish', 'Mijozlar murojaatlarini qabul qilish', 'Rieltor profilini to‘ldirish va ishonchni oshirish', 'Sotuv va ijara takliflarini bitta platformada yuritish'] },
  { id: 'developer', label: 'Quruvchilar va developerlar', title: 'Yangi qurilish loyihalarini namoyish qiling', description: 'Yangi uylar va qurilish loyihalarini xaridorlarga tushunarli ko‘rinishda taqdim eting va loyihaga qiziqqan mijozlardan murojaat oling.', bullets: ['Yangi qurilish e’lonlarini joylashtirish', 'Loyiha va obyektlarni alohida ko‘rsatish', 'Xonadonlar haqidagi ma’lumotlarni taqdim etish', 'Mijozlar bilan to‘g‘ridan-to‘g‘ri aloqa qilish'] },
  { id: 'contractor', label: 'Pudratchilar', title: 'Qurilish xizmatlaringizni topiladigan qiling', description: 'Uy qurish, ta’mirlash va boshqa ko‘chmas mulk bilan bog‘liq xizmatlaringizni Royalhouse foydalanuvchilariga taqdim eting.', bullets: ['Xizmatlar uchun professional profil', 'Xizmat e’lonlarini joylashtirish', 'Xizmat turiga mos mijozlardan murojaatlar', 'Ishlaringiz va takliflaringizni namoyish qilish'] },
  { id: 'service', label: 'Xizmat ko‘rsatuvchilar', title: 'Ko‘chmas mulk atrofidagi xizmatlarni taklif qiling', description: 'Tozalash, ta’mirlash, ko‘chirish va boshqa tegishli xizmatlarni izlayotgan mijozlarga o‘z xizmatlaringizni ko‘rsating.', bullets: ['Xizmat kategoriyasini tanlash', 'Xizmat e’lonini joylashtirish', 'Mijoz murojaatlarini olish', 'Profil va xizmat ma’lumotlarini boshqarish'] },
]

const steps = [
  ['01', 'Ro‘yxatdan o‘ting', 'Royalhouse’da hamkor akkauntini yarating va faoliyat turini belgilang.'],
  ['02', 'Profilni to‘ldiring', 'Kontaktlar va biznes haqidagi asosiy ma’lumotlarni kiriting.'],
  ['03', 'E’lon yoki xizmat joylang', 'Ko‘chmas mulk yoki xizmat haqidagi ma’lumotlarni kiriting.'],
  ['04', 'Mijozlar bilan ishlang', 'Kelgan murojaatlarni qabul qiling va kelishuvni davom ettiring.'],
]

export default function PartnersPage() {
  const [active, setActive] = useState('realtor')
  const current = groups.find((item) => item.id === active) ?? groups[0]

  return (
    <main className="min-h-screen bg-[#f6f8f8] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center justify-between gap-6 px-5 lg:px-8">
          <Link href="/" className="flex items-center text-2xl font-black tracking-tight"><span className="mr-2 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-xl text-white">⌂</span>Royal<span className="text-emerald-500">house</span></Link>
          <div className="flex items-center gap-3"><Link href="/" className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Bosh sahifa</Link><Link href="/account" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">Shaxsiy kabinet</Link></div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#07232d]">
        <div className="absolute -right-40 -top-48 h-[520px] w-[520px] rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="absolute -bottom-56 left-1/3 h-[500px] w-[500px] rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-[1280px] gap-12 px-5 py-20 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-28">
          <div className="flex flex-col justify-center"><div className="mb-6 inline-flex w-fit rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">Royalhouse hamkorlari</div><h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">Biznesingizni Royalhouse bilan birga rivojlantiring</h1><p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Ko‘chmas mulk, yangi qurilish va tegishli xizmatlar bo‘yicha professional hamkor sifatida o‘z takliflaringizni O‘zbekiston bozoridagi foydalanuvchilarga taqdim eting.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/register?type=partner" className="rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-950/20 hover:bg-emerald-400">Hamkor sifatida boshlash →</Link><Link href="/listings/new" className="rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-black text-white hover:bg-white/10">E’lon joylashtirish</Link></div></div>
          <div className="relative flex items-center justify-center"><div className="w-full max-w-[500px] rounded-[32px] border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur"><div className="rounded-[25px] bg-white p-6 sm:p-8"><div className="flex items-center justify-between border-b border-slate-100 pb-5"><div><div className="text-xs font-bold text-slate-400">ROYALHOUSE</div><div className="mt-1 text-xl font-black">Hamkor kabineti</div></div><div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">PRO</div></div><div className="grid gap-3 pt-5 sm:grid-cols-2">{['E’lonlarim', 'Murojaatlar', 'Profil', 'Xizmatlar'].map((item, index) => <div key={item} className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-bold text-slate-400">0{index + 1}</div><div className="mt-3 font-black">{item}</div><div className="mt-1 text-xs text-slate-500">Boshqarish</div></div>)}</div></div></div></div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 py-16 lg:px-8 lg:py-20">
        <div className="text-center"><div className="text-sm font-black uppercase tracking-[.18em] text-emerald-600">Kimlar uchun?</div><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Faoliyatingizga mos hamkorlik</h2><p className="mx-auto mt-4 max-w-2xl text-slate-500">Royalhouse’da turli professional hamkorlar uchun alohida ish ssenariylari mavjud.</p></div>
        <div className="mt-10 flex flex-wrap justify-center gap-2">{groups.map((group) => <button key={group.id} type="button" onClick={() => setActive(group.id)} className={`rounded-full px-5 py-3 text-sm font-black transition ${active === group.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}>{group.label}</button>)}</div>
        <div className="mt-8 grid overflow-hidden rounded-[28px] bg-white ring-1 ring-slate-200 lg:grid-cols-[.9fr_1.1fr]"><div className="bg-emerald-600 p-8 text-white sm:p-10"><div className="text-sm font-bold text-emerald-100">Royalhouse hamkori</div><h3 className="mt-3 text-3xl font-black leading-tight">{current.title}</h3><p className="mt-5 leading-7 text-emerald-50">{current.description}</p></div><div className="p-8 sm:p-10"><h4 className="text-xl font-black">Siz nimalardan foydalanishingiz mumkin?</h4><div className="mt-6 grid gap-4 sm:grid-cols-2">{current.bullets.map((bullet) => <div key={bullet} className="flex gap-3 rounded-2xl bg-slate-50 p-4"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700">✓</span><span className="text-sm font-bold leading-6 text-slate-700">{bullet}</span></div>)}</div></div></div>
      </section>

      <section className="bg-white py-16 lg:py-20"><div className="mx-auto max-w-[1280px] px-5 lg:px-8"><div className="text-center"><h2 className="text-3xl font-black tracking-tight sm:text-4xl">Qanday boshlanadi?</h2><p className="mt-3 text-slate-500">Hamkorlik jarayoni oddiy va tushunarli.</p></div><div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{steps.map(([number, title, text]) => <div key={number} className="rounded-3xl border border-slate-200 p-6"><div className="text-4xl font-black text-emerald-500">{number}</div><h3 className="mt-5 text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div>)}</div></div></section>

      <section className="mx-auto max-w-[1000px] px-5 py-16 text-center lg:py-20"><div className="rounded-[32px] bg-[#07232d] px-6 py-12 text-white sm:px-12"><h2 className="text-3xl font-black sm:text-4xl">Royalhouse’da hamkor bo‘ling</h2><p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-300">Faoliyatingizga mos profil yarating va o‘z e’lon yoki xizmatlaringizni platformada boshqarishni boshlang.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/register?type=partner" className="rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-black hover:bg-emerald-400">Hamkor sifatida ro‘yxatdan o‘tish</Link><Link href="/" className="rounded-xl border border-white/15 px-6 py-3.5 text-sm font-black">Bosh sahifaga qaytish</Link></div></div></section>

      <footer className="bg-[#07232d] text-white"><div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-5 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-8"><div><div className="text-xl font-black">Royal<span className="text-emerald-400">house</span></div><p className="mt-2 text-xs text-slate-400">© 2026 Royalhouse. Barcha huquqlar himoyalangan.</p></div><div className="flex gap-5 text-sm font-bold text-slate-300"><Link href="/listings">E’lonlar</Link><Link href="/account">Shaxsiy kabinet</Link></div></div></footer>
    </main>
  )
}
