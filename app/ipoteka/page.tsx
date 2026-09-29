import type { Metadata } from 'next'
import Link from 'next/link'
import { getMortgagePrograms } from '@/lib/mortgage-programs'

export const metadata: Metadata = {
 title:'Ipoteka kreditlari O‘zbekistonda | Royalhouse',
 description:'Royalhouse’da O‘zbekistondagi ipoteka dasturlarini solishtiring, mos uylarni xaritada ko‘ring va ipoteka kalkulyatorida oylik to‘lovni hisoblang.',
 alternates:{canonical:'/ipoteka'},
 openGraph:{title:'Ipoteka kreditlari | Royalhouse',description:'Birlamchi va ikkilamchi bozor uchun ipoteka dasturlari va kalkulyator.',type:'website'},
}

export default function IpotekaPage(){
 const secondary=getMortgagePrograms('secondary'),primary=getMortgagePrograms('primary')
 return <main className="min-h-screen bg-slate-50">
  <header className="border-b border-slate-200 bg-white">
    <div className="mx-auto flex h-16 max-w-7xl items-center px-4">
      <Link href="/" className="flex items-center gap-2" aria-label="Royalhouse — bosh sahifa">
        <img src="/royalhouse-icon.svg" alt="Royalhouse" className="h-10 w-10 rounded-xl object-cover" />
        <span className="text-2xl font-black tracking-tight text-slate-900">Royal<span className="text-emerald-500">house</span></span>
      </Link>
    </div>
  </header>
  <section className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 text-white"><div className="mx-auto max-w-7xl px-4 py-16 sm:py-20"><p className="text-sm font-black uppercase tracking-[.2em] text-emerald-100">ROYALHOUSE</p><h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Ипотечные кредиты</h1><p className="mt-4 max-w-2xl text-base text-emerald-50 sm:text-lg">Amaldagi bank dasturlarini ko‘ring, shartlarini solishtiring va mos obyektni ipoteka kalkulyatori bilan hisoblang.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/ipoteka/vtorichnyy-rynok" className="rounded-2xl bg-white px-5 py-3 font-black text-emerald-700">Ипотека на вторичном рынке</Link><Link href="/ipoteka/novostroyka" className="rounded-2xl border border-white/40 px-5 py-3 font-black text-white">Ипотека на новостройку</Link></div></div></section><div className="mx-auto max-w-7xl px-4 py-10"><div className="grid gap-5 md:grid-cols-2"><Link href="/ipoteka/vtorichnyy-rynok" className="group rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg"><div className="text-3xl">🏠</div><h2 className="mt-5 text-2xl font-black">Ипотека на вторичном рынке</h2><p className="mt-2 text-slate-500">{secondary.length} ta bank dasturi · tayyor uy-joylar · ipotekaga mos obyektlar xaritasi</p><span className="mt-6 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white">Ko‘rish</span></Link><Link href="/ipoteka/novostroyka" className="group rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg"><div className="text-3xl">🏗️</div><h2 className="mt-5 text-2xl font-black">Ипотека на новостройку</h2><p className="mt-2 text-slate-500">{primary.length} ta bank dasturi · yangi qurilish · mos obyektlar xaritasi</p><span className="mt-6 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white">Ko‘rish</span></Link></div></div></main>
}
