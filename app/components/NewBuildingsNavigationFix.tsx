'use client'
import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

type T={code:string;name_uz:string;name_ru:string|null;sort_order:number}

export default function NewBuildingsNavigationFix(){
 useEffect(()=>{
  let overlay:HTMLDivElement|null=null
  const close=()=>{overlay?.remove();overlay=null;document.body.style.overflow=''}
  const open=async()=>{
   if(overlay)return
   const ru=(document.body?.innerText||'').includes('Новостройки')
   let rows:T[]=[]
   try{const{data}=await createClient().from('partner_listing_taxonomy').select('code,name_uz,name_ru,sort_order').eq('section_code','new_building').eq('parent_code','new_building').eq('is_active',true).order('sort_order');rows=(data||[]) as T[]}catch{}
   const style=document.createElement('style');style.className='prohouse-new-buildings-style';style.textContent=`
     .prohouse-new-buildings-overlay{position:fixed;inset:0;z-index:10000;background:rgba(4,10,20,.72);backdrop-filter:blur(10px);display:flex;align-items:flex-start;justify-content:center;padding:60px 20px 30px;overflow-y:auto}
     .prohouse-new-buildings-modal{position:relative;width:min(1180px,100%);background:#fff;border-radius:24px;box-shadow:0 24px 70px rgba(0,0,0,.28);padding:32px;box-sizing:border-box}
     .prohouse-new-buildings-head{display:flex;align-items:center;gap:16px;padding-right:50px}
     .prohouse-new-buildings-icon{width:58px;height:58px;border-radius:18px;background:#ecfdf5;display:flex;align-items:center;justify-content:center;font-size:28px;flex:none}
     .prohouse-new-buildings-title{margin:0 0 8px;font-size:30px;font-weight:900;color:#0f172a;line-height:1.1}
     .prohouse-new-buildings-subtitle{margin:0;color:#64748b;font-size:14px}
     .prohouse-new-buildings-close{position:absolute;right:16px;top:12px;border:0;background:#f1f5f9;color:#64748b;border-radius:50%;width:38px;height:38px;font-size:26px;cursor:pointer}
     .prohouse-new-buildings-search{width:100%;margin:24px 0 16px;padding:14px 16px;border:1px solid #dbe3ea;border-radius:16px;background:#f8fafc;color:#0f172a;font-size:15px;outline:none;box-sizing:border-box}
     .prohouse-new-buildings-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
     .prohouse-new-building-card{display:flex;align-items:center;gap:14px;min-height:92px;padding:16px;border:1px solid #dbe3ea;border-radius:16px;background:#fff;text-decoration:none;color:#0f172a;box-sizing:border-box;transition:.15s;min-width:0}
     .prohouse-new-building-card:hover{border-color:#10b981;background:#f8fffb}
     .prohouse-new-building-card-icon{display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:#ecfdf5;font-size:24px;flex:none}
     .prohouse-new-building-card-content{min-width:0;flex:1}
     .prohouse-new-building-name{display:block;font-size:15px;font-weight:900;line-height:1.25;overflow-wrap:anywhere}
     .prohouse-new-building-sub{display:block;margin-top:4px;color:#64748b;font-size:12px}
     .prohouse-new-building-arrow{font-size:22px;color:#94a3b8;flex:none}
     .prohouse-new-buildings-note{margin-top:18px;padding:14px 16px;border-radius:14px;background:#f8fafc;color:#64748b;font-size:13px;line-height:1.45}
     @media(max-width:640px){
       .prohouse-new-buildings-overlay{padding:12px 8px 18px;align-items:flex-start}
       .prohouse-new-buildings-modal{width:100%;min-height:calc(100vh - 30px);padding:18px 12px 16px;border-radius:28px;background:linear-gradient(180deg,#111827 0%,#172131 100%);border:1px solid rgba(148,163,184,.22);box-shadow:0 24px 70px rgba(0,0,0,.45);color:#f8fafc}
       .prohouse-new-buildings-head{gap:12px;padding:4px 48px 0 2px}
       .prohouse-new-buildings-icon{width:54px;height:54px;border-radius:17px;background:rgba(16,185,129,.16);font-size:25px}
       .prohouse-new-buildings-title{font-size:28px;color:#f8fafc;margin-bottom:6px}
       .prohouse-new-buildings-subtitle{font-size:14px;color:#94a3b8}
       .prohouse-new-buildings-close{right:14px;top:14px;width:48px;height:48px;background:#475569;color:#dbeafe;font-size:31px}
       .prohouse-new-buildings-search{margin:20px 0 14px;height:50px;padding:0 15px;border-radius:16px;background:rgba(30,41,59,.9);border:1px solid rgba(148,163,184,.38);color:#f8fafc;font-size:15px}
       .prohouse-new-buildings-search::placeholder{color:#94a3b8}
       .prohouse-new-buildings-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
       .prohouse-new-building-card{min-height:116px;padding:10px 7px 9px;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:7px;border-radius:17px;background:rgba(30,41,59,.74);border:1px solid rgba(100,116,139,.42);color:#f8fafc;box-shadow:inset 0 1px 0 rgba(255,255,255,.03)}
       .prohouse-new-building-card:hover{background:rgba(30,41,59,.9);border-color:#10b981}
       .prohouse-new-building-card-icon{width:43px;height:43px;font-size:22px;background:rgba(0,90,75,.55)}
       .prohouse-new-building-name{font-size:12.5px;line-height:1.2;color:#f8fafc;max-height:31px;overflow:hidden}
       .prohouse-new-building-sub{font-size:10.5px;color:#94a3b8;margin-top:2px}
       .prohouse-new-building-arrow{display:none}
       .prohouse-new-buildings-note{margin-top:12px;padding:13px 14px;border-radius:16px;background:rgba(30,41,59,.75);color:#a8b6c9;font-size:12.5px}
     }
   `;document.head.appendChild(style)
   overlay=document.createElement('div');overlay.className='prohouse-new-buildings-overlay';overlay.onclick=close
   const m=document.createElement('div');m.className='prohouse-new-buildings-modal';m.onclick=e=>e.stopPropagation()
   const x=document.createElement('button');x.type='button';x.textContent='×';x.className='prohouse-new-buildings-close';x.onclick=close
   const head=document.createElement('div');head.className='prohouse-new-buildings-head'
   const hi=document.createElement('div');hi.className='prohouse-new-buildings-icon';hi.textContent='🏢'
   const ht=document.createElement('div');const h=document.createElement('h2');h.className='prohouse-new-buildings-title';h.textContent=ru?'Новостройки':'Yangi uylar';const p=document.createElement('p');p.className='prohouse-new-buildings-subtitle';p.textContent=ru?'Выберите нужное направление':'Kerakli yo‘nalishni tanlang';ht.append(h,p);head.append(hi,ht)
   const search=document.createElement('input');search.className='prohouse-new-buildings-search';search.type='search';search.placeholder=ru?'Поиск категории...':'Kategoriya qidirish...';search.setAttribute('aria-label',ru?'Поиск категории':'Kategoriya qidirish')
   const grid=document.createElement('div');grid.className='prohouse-new-buildings-grid'
   const icons:Record<string,string>={new_building_complexes:'🏗️',new_building_discounts:'🏷️',new_building_apartments:'🏢'}
   rows.forEach(r=>{const name=ru?(r.name_ru||r.name_uz):r.name_uz;const a=document.createElement('a');a.href=`/listings?tab=sale&taxonomy=${encodeURIComponent(r.code)}`;a.className='prohouse-new-building-card';a.dataset.search=`${name} ${r.name_uz}`.toLowerCase();const i=document.createElement('span');i.className='prohouse-new-building-card-icon';i.textContent=icons[r.code]||'🏢';const c=document.createElement('span');c.className='prohouse-new-building-card-content';const n=document.createElement('strong');n.className='prohouse-new-building-name';n.textContent=name;const s=document.createElement('span');s.className='prohouse-new-building-sub';s.textContent=ru?'Объявления':'E’lonlar';const ar=document.createElement('span');ar.className='prohouse-new-building-arrow';ar.textContent='›';c.append(n,s);a.append(i,c,ar);grid.appendChild(a)})
   search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();grid.querySelectorAll<HTMLElement>('.prohouse-new-building-card').forEach(card=>{card.style.display=!q||card.dataset.search?.includes(q)?'flex':'none'})})
   const note=document.createElement('div');note.className='prohouse-new-buildings-note';note.textContent=ru?'Каждая карточка ведёт к своей категории объявлений.':'Har bir karta o‘zining aniq e’lon kategoriyasiga olib boradi.'
   m.append(x,head,search,grid,note);overlay.appendChild(m);document.body.appendChild(overlay);document.body.style.overflow='hidden'
  }
  const onClick=(e:MouseEvent)=>{const a=(e.target as HTMLElement|null)?.closest('a') as HTMLAnchorElement|null;if(!a)return;const t=a.textContent?.trim()||'';if(t==='Yangi uylar'||t==='Новостройки'){e.preventDefault();e.stopPropagation();void open()}}
  document.addEventListener('click',onClick,true)
  return()=>{document.removeEventListener('click',onClick,true);close()}
 },[])
 return null
}
