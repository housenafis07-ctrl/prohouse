'use client'

import { useEffect } from 'react'

export default function DailySearchNavigationFix(){
 useEffect(()=>{
  const onClick=(event:MouseEvent)=>{
   if(window.location.pathname!=='/')return
   const target=event.target as HTMLElement|null
   const button=target?.closest('button') as HTMLButtonElement|null
   if(!button)return
   const label=button.textContent?.trim()||''
   if(label!=='Qidirish'&&label!=='Найти')return
   const tabs=Array.from(document.querySelectorAll('button')) as HTMLButtonElement[]
   const daily=tabs.find(b=>{const t=b.textContent?.trim();return t==='Kunlik'||t==='Посуточно'})
   if(!daily)return
   const active=daily.className.includes('bg-emerald-500')
   if(!active)return
   event.preventDefault();event.stopPropagation()
   const selects=Array.from(document.querySelectorAll('select')) as HTMLSelectElement[]
   const inputs=Array.from(document.querySelectorAll('input')) as HTMLInputElement[]
   const params=new URLSearchParams()
   const region=selects[0]?.value||''; const district=selects[1]?.value||''
   if(region)params.set('region',region); if(district)params.set('district',district)
   window.location.assign(`/daily${params.toString()?`?${params.toString()}`:''}`)
  }
  document.addEventListener('click',onClick,true)
  return()=>document.removeEventListener('click',onClick,true)
 },[])
 return null
}
