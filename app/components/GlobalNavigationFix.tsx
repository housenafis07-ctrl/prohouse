'use client'

import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

type Taxonomy={code:string;name_uz:string;name_ru:string|null;section_code:string;parent_code:string|null;sort_order:number}

export default function GlobalNavigationFix(){
 useEffect(()=>{
  const supabase=createClient();let mounted=true;let userId:string|null=null
  const getRussian=()=>window.localStorage.getItem('prohouse-lang')==='ru'
  const close=()=>{document.querySelector('.prohouse-services-overlay')?.remove();document.querySelector('.prohouse-services-style')?.remove();document.body.style.overflow=''}
  const openServices=async()=>{
   if(document.querySelector('.prohouse-services-overlay'))return
   const ru=getRussian();let services:Taxonomy[]=[]
   try{const{data}=await supabase.from('partner_listing_taxonomy').select('code,name_uz,name_ru,section_code,parent_code,sort_order').eq('section_code','services').eq('parent_code','services').eq('is_active',true).eq('allows_partner_listing',true).order('sort_order');services=(data||[]) as Taxonomy[]}catch{}
   if(!mounted)return
   const icons:Record<string,string>={services_repair:'🔧',services_cleaning:'🧹',services_design:'🎨',services_construction:'🏗️',services_furniture:'🪑',services_plumbing:'🚿',services_electric:'⚡',services_moving:'🚚',services_other:'🛠️',services_landscape:'🌳',services_cctv:'📹',services_ac_installation:'❄️'}
   const style=document.createElement('style');style.className='prohouse-services-style';style.textContent=`
     .prohouse-services-overlay{position:fixed;inset:0;z-index:9999;background:rgba(4,10,20,.72);backdrop-filter:blur(10px);display:flex;align-items:flex-start;justify-content:center;padding:60px 20px 30px;overflow-y:auto}
     .prohouse-services-modal{position:relative;width:min(1180px,100%);background:#fff;border-radius:24px;box-shadow:0 24px 70px rgba(0,0,0,.28);padding:32px;box-sizing:border-box}
     .prohouse-services-head{display:flex;align-items:center;gap:16px;padding-right:50px}
     .prohouse-services-head-icon{width:58px;height:58px;border-radius:18px;background:#ecfdf5;display:flex;align-items:center;justify-content:center;font-size:28px;flex:none}
     .prohouse-services-title{margin:0 0 8px;font-size:30px;font-weight:900;color:#0f172a;line-height:1.1}
     .prohouse-services-subtitle{margin:0;color:#64748b;font-size:14px}
     .prohouse-services-close{position:absolute;right:16px;top:12px;border:0;background:#f1f5f9;color:#64748b;border-radius:50%;width:38px;height:38px;font-size:26px;cursor:pointer}
     .prohouse-services-search{width:100%;margin:24px 0 16px;padding:14px 16px;border:1px solid #dbe3ea;border-radius:16px;background:#f8fafc;color:#0f172a;font-size:15px;outline:none;box-sizing:border-box}
     .prohouse-services-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
     .prohouse-service-card{display:flex;align-items:center;gap:14px;min-height:92px;padding:16px;border:1px solid #dbe3ea;border-radius:16px;background:#fff;text-decoration:none;color:#0f172a;box-sizing:border-box;transition:.15s;min-width:0}
     .prohouse-service-card:hover{border-color:#10b981;background:#f8fffb}
     .prohouse-service-icon{display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:#ecfdf5;font-size:24px;flex:none}
     .prohouse-service-content{min-width:0;flex:1}
     .prohouse-service-name{display:block;font-size:15px;font-weight:900;line-height:1.25;overflow-wrap:anywhere}
     .prohouse-service-sub{display:block;margin-top:4px;color:#64748b;font-size:12px}
     .prohouse-service-arrow{font-size:22px;color:#94a3b8;flex:none}
     .prohouse-services-note{margin-top:18px;padding:14px 16px;border-radius:14px;background:#f8fafc;color:#64748b;font-size:13px;line-height:1.45}
     @media(max-width:640px){
       .prohouse-services-overlay{padding:12px 8px 18px;align-items:flex-start}
       .prohouse-services-modal{width:100%;min-height:calc(100vh - 30px);padding:18px 12px 16px;border-radius:28px;background:linear-gradient(180deg,#111827 0%,#172131 100%);border:1px solid rgba(148,163,184,.22);box-shadow:0 24px 70px rgba(0,0,0,.45);color:#f8fafc}
       .prohouse-services-head{gap:12px;padding:4px 48px 0 2px}
       .prohouse-services-head-icon{width:54px;height:54px;border-radius:17px;background:rgba(16,185,129,.16);font-size:25px}
       .prohouse-services-title{font-size:28px;color:#f8fafc;margin-bottom:6px}
       .prohouse-services-subtitle{font-size:14px;color:#94a3b8}
       .prohouse-services-close{right:14px;top:14px;width:48px;height:48px;background:#475569;color:#dbeafe;font-size:31px}
       .prohouse-services-search{margin:20px 0 14px;height:50px;padding:0 15px;border-radius:16px;background:rgba(30,41,59,.9);border:1px solid rgba(148,163,184,.38);color:#f8fafc;font-size:15px}
       .prohouse-services-search::placeholder{color:#94a3b8}
       .prohouse-services-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
       .prohouse-service-card{min-height:116px;padding:10px 7px 9px;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:7px;border-radius:17px;background:rgba(30,41,59,.74);border:1px solid rgba(100,116,139,.42);color:#f8fafc;box-shadow:inset 0 1px 0 rgba(255,255,255,.03)}
       .prohouse-service-card:hover{background:rgba(30,41,59,.9);border-color:#10b981}
       .prohouse-service-icon{width:43px;height:43px;font-size:22px;background:rgba(0,90,75,.55)}
       .prohouse-service-name{font-size:12.5px;line-height:1.2;color:#f8fafc;max-height:31px;overflow:hidden}
       .prohouse-service-sub{font-size:10.5px;color:#94a3b8;margin-top:2px}
       .prohouse-service-arrow{display:none}
       .prohouse-services-note{margin-top:12px;padding:13px 14px;border-radius:16px;background:rgba(30,41,59,.75);color:#a8b6c9;font-size:12.5px}
     }
   `;document.head.appendChild(style)
   const overlay=document.createElement('div');overlay.className='prohouse-services-overlay';overlay.onclick=close
   const modal=document.createElement('div');modal.className='prohouse-services-modal';modal.onclick=e=>e.stopPropagation()
   const x=document.createElement('button');x.type='button';x.textContent='×';x.className='prohouse-services-close';x.onclick=close
   const head=document.createElement('div');head.className='prohouse-services-head'
   const headIcon=document.createElement('div');headIcon.className='prohouse-services-head-icon';headIcon.textContent='▦'
   const headText=document.createElement('div');const h=document.createElement('h2');h.className='prohouse-services-title';h.textContent=ru?'Услуги':'Xizmatlar';const p=document.createElement('p');p.className='prohouse-services-subtitle';p.textContent=ru?'Выберите нужную услугу':'Kerakli xizmat yo‘nalishini tanlang';headText.append(h,p);head.append(headIcon,headText)
   const search=document.createElement('input');search.className='prohouse-services-search';search.type='search';search.placeholder=ru?'Поиск услуги...':'Xizmat qidirish...';search.setAttribute('aria-label',ru?'Поиск услуги':'Xizmat qidirish')
   const grid=document.createElement('div');grid.className='prohouse-services-grid'
   services.forEach(s=>{const name=ru?(s.name_ru||s.name_uz):s.name_uz;const a=document.createElement('a');a.href=`/listings?tab=all&taxonomy=${encodeURIComponent(s.code)}`;a.className='prohouse-service-card';a.dataset.search=`${name} ${s.name_uz}`.toLowerCase();const i=document.createElement('span');i.className='prohouse-service-icon';i.textContent=icons[s.code]||'🛠️';const c=document.createElement('span');c.className='prohouse-service-content';const n=document.createElement('strong');n.className='prohouse-service-name';n.textContent=name;const sub=document.createElement('span');sub.className='prohouse-service-sub';sub.textContent=ru?'Услуга':'Xizmat';const arrow=document.createElement('span');arrow.className='prohouse-service-arrow';arrow.textContent='›';c.append(n,sub);a.append(i,c,arrow);grid.appendChild(a)})
   search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();grid.querySelectorAll<HTMLElement>('.prohouse-service-card').forEach(card=>{card.style.display=!q||card.dataset.search?.includes(q)?'flex':'none'})})
   const note=document.createElement('div');note.className='prohouse-services-note';note.textContent=ru?'Категории совпадают с категориями размещения партнёра.':'Bu kategoriyalar hamkor e’lon joylashtirishdagi kategoriyalar bilan bir xil.'
   modal.append(x,head,search,grid,note);overlay.appendChild(modal);document.body.appendChild(overlay);document.body.style.overflow='hidden'
  }
  const updateAccountButton=()=>{const button=document.querySelector('.account-btn') as HTMLButtonElement|null;if(!button)return;const ru=getRussian();const logged=Boolean(userId);const nextText=logged?(ru?'Личный кабинет':'Shaxsiy kabinet'):(ru?'Войти / Регистрация':'Kirish / Ro‘yxatdan o‘tish');if(button.textContent!==nextText)button.textContent=nextText}
  const handleClick=(event:MouseEvent)=>{const target=event.target as HTMLElement|null;const link=target?.closest('a') as HTMLAnchorElement|null;if(link){const text=link.textContent?.trim()||'';if(text==='Услуги'||text==='Xizmatlar'){event.preventDefault();void openServices();return}}const button=target?.closest('.account-btn') as HTMLButtonElement|null;if(button){event.preventDefault();window.location.assign(userId?'/account':'/register')}}
  const sync=async()=>{try{const{data:{user}}=await supabase.auth.getUser();if(!mounted)return;userId=user?.id??null;updateAccountButton()}catch{}}
  const onLanguageChange=()=>updateAccountButton()
  document.addEventListener('click',handleClick);window.addEventListener('prohouse-language-change',onLanguageChange);updateAccountButton();void sync()
  const{data:listener}=supabase.auth.onAuthStateChange((_e,s)=>{userId=s?.user?.id??null;updateAccountButton()})
  return()=>{mounted=false;document.removeEventListener('click',handleClick);window.removeEventListener('prohouse-language-change',onLanguageChange);listener.subscription.unsubscribe();close()}
 },[])
 return null
}
