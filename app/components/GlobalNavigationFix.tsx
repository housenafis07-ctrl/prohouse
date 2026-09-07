'use client'

import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

type Taxonomy={code:string;name_uz:string;name_ru:string|null;section_code:string;parent_code:string|null;sort_order:number}

export default function GlobalNavigationFix(){
 useEffect(()=>{
  const supabase=createClient();let mounted=true;let userId:string|null=null
  const close=()=>{document.querySelector('.prohouse-services-overlay')?.remove();document.body.style.overflow=''}
  const openServices=async()=>{
   if(document.querySelector('.prohouse-services-overlay'))return
   const ru=(document.body?.innerText||'').includes('Купить')||(document.body?.innerText||'').includes('Недвижимость')
   let services:Taxonomy[]=[]
   try{const{data}=await supabase.from('partner_listing_taxonomy').select('code,name_uz,name_ru,section_code,parent_code,sort_order').eq('section_code','services').eq('parent_code','services').eq('is_active',true).eq('allows_partner_listing',true).order('sort_order');services=(data||[]) as Taxonomy[]}catch{}
   const icons:Record<string,string>={services_repair:'🔧',services_cleaning:'🧹',services_design:'🎨',services_construction:'🏗️',services_furniture:'🪑',services_plumbing:'🚿',services_electric:'⚡',services_moving:'🚚',services_other:'🛠️'}
   const overlay=document.createElement('div');overlay.className='prohouse-services-overlay';overlay.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.58);backdrop-filter:blur(2px);display:flex;align-items:flex-start;justify-content:center;padding:60px 20px 30px;overflow-y:auto;';overlay.onclick=close
   const modal=document.createElement('div');modal.style.cssText='position:relative;width:min(1180px,100%);background:#fff;border-radius:24px;box-shadow:0 24px 70px rgba(0,0,0,.28);padding:32px;box-sizing:border-box;';modal.onclick=e=>e.stopPropagation()
   const x=document.createElement('button');x.type='button';x.textContent='×';x.style.cssText='position:absolute;right:16px;top:12px;border:0;background:#f1f5f9;color:#64748b;border-radius:50%;width:38px;height:38px;font-size:26px;cursor:pointer';x.onclick=close
   const h=document.createElement('h2');h.textContent=ru?'Услуги':'Xizmatlar';h.style.cssText='margin:0 0 8px;font-size:30px;font-weight:900;color:#0f172a'
   const p=document.createElement('p');p.textContent=ru?'Выберите нужную услугу':'Kerakli xizmat yo‘nalishini tanlang';p.style.cssText='margin:0 0 24px;color:#64748b;font-size:14px'
   const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px'
   services.forEach(s=>{const a=document.createElement('a');a.href=`/listings?tab=all&taxonomy=${encodeURIComponent(s.code)}`;a.style.cssText='display:flex;align-items:center;gap:14px;min-height:92px;padding:16px;border:1px solid #dbe3ea;border-radius:16px;background:#fff;text-decoration:none;color:#0f172a;box-sizing:border-box;transition:.15s';a.onmouseenter=()=>{a.style.borderColor='#10b981';a.style.background='#f8fffb'};a.onmouseleave=()=>{a.style.borderColor='#dbe3ea';a.style.background='#fff'};const i=document.createElement('span');i.textContent=icons[s.code]||'🛠️';i.style.cssText='display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:#ecfdf5;font-size:24px;flex:none';const c=document.createElement('span');const n=document.createElement('strong');n.textContent=ru?(s.name_ru||s.name_uz):s.name_uz;n.style.cssText='display:block;font-size:15px;font-weight:900';const sub=document.createElement('span');sub.textContent=ru?'Услуга':'Xizmat';sub.style.cssText='display:block;margin-top:4px;color:#64748b;font-size:12px';c.append(n,sub);a.append(i,c);grid.appendChild(a)})
   const note=document.createElement('div');note.textContent=ru?'Категории совпадают с категориями размещения партнёра.':'Bu kategoriyalar hamkor e’lon joylashtirishdagi kategoriyalar bilan bir xil.';note.style.cssText='margin-top:18px;padding:14px 16px;border-radius:14px;background:#f8fafc;color:#64748b;font-size:13px'
   modal.append(x,h,p,grid,note);overlay.appendChild(modal);document.body.appendChild(overlay);document.body.style.overflow='hidden'
  }
  const apply=()=>{if(!mounted)return;const links=Array.from(document.querySelectorAll('a')) as HTMLAnchorElement[];links.forEach(link=>{const t=link.textContent?.trim()||'';if(t==='Услуги'||t==='Xizmatlar'){link.href='#services';link.onclick=e=>{e.preventDefault();void openServices()}}if(t==='Разместить объявление'||t==='E’lon joylashtirish'){link.href='/listings/new'}});const button=document.querySelector('.account-btn') as HTMLButtonElement|null;if(button){const ru=(document.body?.innerText||'').includes('Купить');const logged=Boolean(userId);button.textContent=logged?(ru?'Личный кабинет':'Shaxsiy kabinet'):(ru?'Войти / Регистрация':'Kirish / Ro‘yxatdan o‘tish');button.onclick=e=>{e.preventDefault();window.location.assign(logged?'/account':'/register')}}}
  const sync=async()=>{const{data:{user}}=await supabase.auth.getUser();if(!mounted)return;userId=user?.id??null;apply()}
  const observer=new MutationObserver(()=>apply());observer.observe(document.body,{childList:true,subtree:true});void sync();const{data:listener}=supabase.auth.onAuthStateChange((_e,s)=>{userId=s?.user?.id??null;apply()})
  return()=>{mounted=false;observer.disconnect();listener.subscription.unsubscribe();close()}
 },[]);return null
}
