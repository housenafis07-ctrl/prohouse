'use client'

import { useEffect } from 'react'

export default function RentalNavigationFix() {
  useEffect(() => {
    const close = () => { document.querySelector('.prohouse-rental-overlay')?.remove(); document.body.style.overflow = '' }
    const open = (isRussian: boolean) => {
      if (document.querySelector('.prohouse-rental-overlay')) return
      const overlay=document.createElement('div'); overlay.className='prohouse-rental-overlay'; overlay.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.58);backdrop-filter:blur(2px);display:flex;align-items:flex-start;justify-content:center;padding:84px 20px 30px;overflow-y:auto;'; overlay.onclick=close
      const modal=document.createElement('div'); modal.style.cssText='position:relative;width:min(1180px,100%);background:#fff;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.28);padding:32px;box-sizing:border-box;'; modal.onclick=e=>e.stopPropagation()
      const closeButton=document.createElement('button'); closeButton.type='button'; closeButton.textContent='×'; closeButton.style.cssText='position:absolute;right:14px;top:10px;border:0;background:transparent;color:#94a3b8;font-size:32px;cursor:pointer;padding:6px 10px;'; closeButton.onclick=close
      const title=document.createElement('h2'); title.textContent=isRussian?'Аренда':'Ijara'; title.style.cssText='margin:0 0 8px;font-size:30px;font-weight:900;color:#0f172a;'
      const subtitle=document.createElement('p'); subtitle.textContent=isRussian?'Выберите подходящий вариант аренды':'O‘zingizga mos ijara turini tanlang'; subtitle.style.cssText='margin:0 0 26px;color:#64748b;font-size:14px;'
      const grid=document.createElement('div'); grid.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;'
      const cards=isRussian?[['🏢','Снять долгосрочно','Квартиры и дома на длительный срок','/listings?tab=rent'],['🗓️','Снять посуточно','Жильё, апартаменты и отели на сутки','/daily'],['🏬','Коммерческая недвижимость','Офисы, магазины и другие объекты','/listings?tab=rent&type=commercial'],['🏡','Дачы','Дачи и загородные дома для отдыха','/listings?tab=rent&type=house']]:[['🏢','Uzoq muddatga ijaraga','Kvartira va uylarni uzoq muddatga ijaraga oling','/listings?tab=rent'],['🗓️','Kunlik ijaraga','Uy-joy, apartament va mehmonxonalar','/daily'],['🏬','Tijorat ko‘chmas mulki','Ofis, do‘kon va boshqa tijorat obyektlari','/listings?tab=rent&type=commercial'],['🏡','Dacha','Dam olish uchun uylar va hovlilar','/listings?tab=rent&type=house']]
      cards.forEach(([icon,name,sub,href])=>{const a=document.createElement('a');a.href=href;a.style.cssText='display:flex;align-items:center;gap:16px;min-height:126px;padding:20px;border:1px solid #dbe3ea;border-radius:12px;background:#fff;text-decoration:none;color:#0f172a;box-sizing:border-box;';const i=document.createElement('span');i.textContent=icon;i.style.cssText='display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:#ecfdf5;font-size:27px;flex:none;';const c=document.createElement('span');const n=document.createElement('strong');n.textContent=name;n.style.cssText='display:block;font-size:16px;font-weight:900;';const s=document.createElement('span');s.textContent=sub;s.style.cssText='display:block;margin-top:6px;color:#64748b;font-size:13px;';c.append(n,s);a.append(i,c);grid.appendChild(a)})
      modal.append(closeButton,title,subtitle,grid); overlay.appendChild(modal); document.body.appendChild(overlay); document.body.style.overflow='hidden'
    }
    const onClick=(event:MouseEvent)=>{if(window.location.pathname!=='/')return;const target=event.target as HTMLElement|null;const link=target?.closest('a') as HTMLAnchorElement|null;if(!link)return;const label=link.textContent?.trim()||'';if((label==='Ijara'||label==='Аренда')&&link.href.includes('tab=rent')){event.preventDefault();event.stopPropagation();open(label==='Аренда')}}
    document.addEventListener('click',onClick,true); return()=>document.removeEventListener('click',onClick,true)
  },[])
  return null
}
