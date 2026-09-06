'use client'

import Link from 'next/link'

const services = [
  { icon: '▣', title: 'Loyiha tanlash', sub: 'Tayyor uy loyihalari' },
  { icon: '⌂', title: 'Loyihalar katalogi', sub: '1000+ tayyor loyiha' },
  { icon: '♙', title: 'Pudratchi tanlash', sub: 'Ishonchli pudratchilar' },
  { icon: '⌖', title: 'Yer uchastkasini topish', sub: 'Qurilish uchun yerlar' },
  { icon: '▤', title: 'Hisob-kitob qilish', sub: 'Taxminiy xarajatlar' },
]

const projects = [
  { title: 'Karkasli uy 7,5×12 K-1.1', meta: '139,3 m² · 4 xona · 2 qavat', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=85' },
  { title: 'Brusdan uy 6×9 D-81', meta: '98 m² · 3 xona · 2 qavat', image: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=85' },
  { title: 'Zamonaviy uy Z-120', meta: '120 m² · 4 xona · 2 qavat', image: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=85' },
  { title: 'Premium uy P-200', meta: '200 m² · 5 xona · 2 qavat', image: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=900&q=85' },
]

export default function BuildHome() {
  return <main className="min-h-screen bg-[#f6f7f8] text-slate-900">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex min-h-[72px] max-w-[1400px] items-center gap-8 px-4">
        <Link href="/" className="flex items-center text-2xl font-black"><span className="mr-2 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white">⌂</span>Pro<span className="text-emerald-500">house</span></Link>
        <nav className="hidden flex-1 items-center gap-6 text-sm font-semibold lg:flex">
          <Link href="/listings?tab=sale">Sotib olish</Link><Link href="/listings?tab=rent">Ijara</Link><Link href="/listings?tab=sale&type=new_building">Yangi uylar</Link><Link className="text-emerald-700" href="/uy-qurish">Uy qurish</Link><Link href="/listings">Xizmatlar</Link><Link href="/realtors">Rieltorlar</Link>
        </nav>
        <Link href="/account" className="ml-auto rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white">Shaxsiy kabinet</Link>
      </div>
    </header>

    <section className="relative overflow-hidden border-b border-slate-200 bg-white">
      <div className="mx-auto grid max-w-[1400px] items-center gap-8 px-4 py-14 lg:grid-cols-[1fr_1fr] lg:px-8">
        <div><p className="text-xs font-black tracking-[.2em] text-emerald-600">PROHOUSE CONSTRUCTION</p><h1 className="mt-3 text-5xl font-black leading-tight sm:text-6xl">Uy qurish</h1><p className="mt-4 max-w-xl text-lg text-slate-500">Orzuyingizdagi uyni biz bilan birga quring. Loyiha, yer, pudratchi va xarajatlar — barchasi bir joyda.</p><button className="mt-7 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white">Loyihani tanlash →</button></div>
        <div className="relative h-[300px] overflow-hidden rounded-3xl bg-slate-100"><img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85" alt="Uy qurish" className="h-full w-full object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 to-transparent"/><div className="absolute bottom-5 left-5 text-white"><div className="text-xl font-black">O‘zingizga mos uy</div><div className="text-sm text-white/80">Loyihadan kalitgacha</div></div></div>
      </div>
    </section>

    <section className="mx-auto max-w-[1400px] px-4 py-10 lg:px-8"><div className="mb-5"><h2 className="text-2xl font-black">Uy qurish xizmatlari</h2><p className="mt-1 text-sm text-slate-500">Kerakli bosqichni tanlang</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{services.map(s=><button key={s.title} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-xl font-black text-emerald-600">{s.icon}</div><div className="mt-5 text-sm font-black">{s.title}</div><div className="mt-1 text-xs text-slate-500">{s.sub}</div></button>)}</div></section>

    <section className="mx-auto max-w-[1400px] px-4 pb-14 lg:px-8"><div className="mb-5 flex items-end justify-between"><div><h2 className="text-2xl font-black">Tayyor uy loyihalari</h2><p className="mt-1 text-sm text-slate-500">Turli uslub va maydondagi loyihalar</p></div><Link href="/listings?tab=sale&type=house" className="font-bold text-emerald-700">Barchasini ko‘rish →</Link></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{projects.map(p=><Link href="/listings?tab=sale&type=house" key={p.title} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="aspect-[4/3] overflow-hidden bg-slate-100"><img src={p.image} alt={p.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/></div><div className="p-4"><h3 className="font-black">{p.title}</h3><p className="mt-1 text-xs text-slate-500">{p.meta}</p></div></Link>)}</div></section>
  </main>
}
