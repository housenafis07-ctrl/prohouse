'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/app/components/I18nProvider'

const KEY='royalhouse-compare'

export default function CompareButton({listingId}:{listingId:string}){
  const {lang}=useI18n()
  const ru=lang==='ru'
  const [active,setActive]=useState(false)
  const [count,setCount]=useState(0)

  useEffect(()=>{
    try{const ids=JSON.parse(localStorage.getItem(KEY)||'[]') as string[];setActive(ids.includes(listingId));setCount(ids.length)}catch{}
  },[listingId])

  const toggle=()=>{
    try{
      const ids=(JSON.parse(localStorage.getItem(KEY)||'[]') as string[]).filter(Boolean)
      let next:string[]
      if(ids.includes(listingId)) next=ids.filter(x=>x!==listingId)
      else next=ids.length>=3?[...ids.slice(1),listingId]:[...ids,listingId]
      localStorage.setItem(KEY,JSON.stringify(next));setActive(next.includes(listingId));setCount(next.length)
      window.dispatchEvent(new CustomEvent('royalhouse-compare-change'))
    }catch{}
  }

  return <div className="flex flex-wrap items-center gap-2">
    <button type="button" onClick={toggle} className={'rounded-xl border px-4 py-3 text-sm font-black ' + (active?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-slate-200 bg-white text-slate-700')}>
      {active ? '✓ ' : '⚖️ '}{ru ? (active?'В сравнении':'Сравнить') : (active?'Solishtirishda':'Solishtirish')}
    </button>
    {count>0 && <Link href="/solishtirish" className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white">{ru?'Сравнение':'Solishtirish'} ({count}/3)</Link>}
  </div>
}
