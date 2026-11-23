'use client'

import Link from 'next/link'
import {useEffect,useState} from 'react'
import {createClient} from '@/utils/supabase/client'
import {useI18n} from '@/app/components/I18nProvider'

type Agency={id:string;name:string;slug:string;description:string|null;logo_url:string|null;verification_status:string}

export default function AgenciesPage(){
 const {lang}=useI18n()
 const ru=lang==='ru'
 const tx=(uz:string,rr:string)=>ru?rr:uz
 const [items,setItems]=useState<Agency[]>([])
 useEffect(()=>{createClient().from('agency_profiles').select('*').in('verification_status',['pending','verified']).order('name').then(({data})=>setItems(data||[]))},[])
 return <main className="min-h-screen bg-slate-50"><header className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5"><Link href="/" className="text-2xl font-black">Royal<span className="text-emerald-500">house</span></Link><Link href="/account" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">{tx('Kabinet','Кабинет')}</Link></div></header><section className="mx-auto max-w-7xl px-4 py-10"><p className="text-xs font-black tracking-[.18em] text-emerald-600">PROFESSIONALS</p><h1 className="mt-2 text-4xl font-black">{tx('Ko‘chmas mulk agentliklari','Агентства недвижимости')}</h1><p className="mt-3 text-slate-500">{tx('Agentliklar va ularning professional jamoalarini toping.','Найдите агентства и их профессиональные команды.')}</p><div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{items.map(a=><Link key={a.id} href={'/agencies/'+a.slug} className="rounded-3xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5"><div className="flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 font-black">{a.logo_url?<img src={a.logo_url} alt="" className="h-full w-full object-cover"/>:'A'}</div><div><h2 className="font-black">{a.name}</h2><p className="text-xs text-emerald-600">{a.verification_status==='verified'?('✓ '+tx('Tasdiqlangan agentlik','Проверенное агентство')):tx('Professional agentlik','Профессиональное агентство')}</p></div></div><p className="mt-4 line-clamp-2 text-sm text-slate-500">{a.description||tx('Ko‘chmas mulk bo‘yicha professional agentlik.','Профессиональное агентство недвижимости.')}</p></Link>)}</div>{!items.length&&<div className="mt-8 rounded-3xl bg-white p-12 text-center text-slate-500">{tx('Hozircha agentliklar yo‘q.','Пока нет агентств.')}</div>}</section></main>
}