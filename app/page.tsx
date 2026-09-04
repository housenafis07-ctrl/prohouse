'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'

type Lang = 'uz' | 'ru'
type ModalMode = 'buy' | 'rent' | 'mortgage' | 'build' | 'services' | 'agents' | 'all' | null

type Listing = {
  id: string
  title: string
  listing_type: string
  property_type: string
  price: number
  currency: string
  area_m2: number | null
  rooms: number | null
  floor: number | null
  floors_total: number | null
  district: string | null
  city: string
  seller_type: string
  seller_name: string | null
  is_mortgage_available: boolean
  is_verified: boolean
  is_featured: boolean
  published_at: string | null
  image_url?: string
}

const fallback: Listing[] = [
  { id: '1', title: '2 xonali zamonaviy kvartira', listing_type: 'sale', property_type: 'apartment', price: 860000000, currency: 'UZS', area_m2: 58, rooms: 2, floor: 5, floors_total: 9, district: 'Yunusobod', city: 'Toshkent', seller_type: 'owner', seller_name: 'Sotuvchi', is_mortgage_available: true, is_verified: true, is_featured: true, published_at: null, image_url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=85' },
  { id: '2', title: 'Yangi qurilgan premium uy', listing_type: 'sale', property_type: 'new_building', price: 1240000000, currency: 'UZS', area_m2: 120, rooms: 4, floor: 2, floors_total: 2, district: 'Mirzo Ulug‘bek', city: 'Toshkent', seller_type: 'developer', seller_name: 'Rieltor', is_mortgage_available: true, is_verified: true, is_featured: true, published_at: null, image_url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=85' },
  { id: '3', title: '3 xonali yorug‘ kvartira', listing_type: 'sale', property_type: 'apartment', price: 950000000, currency: 'UZS', area_m2: 72, rooms: 3, floor: 7, floors_total: 12, district: 'Chilonzor', city: 'Toshkent', seller_type: 'owner', seller_name: 'Sotuvchi', is_mortgage_available: true, is_verified: true, is_featured: true, published_at: null, image_url: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1000&q=85' },
  { id: '4', title: 'Keng hovlili xususiy uy', listing_type: 'sale', property_type: 'house', price: 185000, currency: 'USD', area_m2: 190, rooms: 5, floor: 2, floors_total: 2, district: 'Mirzo Ulug‘bek', city: 'Toshkent', seller_type: 'owner', seller_name: 'Sotuvchi', is_mortgage_available: false, is_verified: true, is_featured: false, published_at: null, image_url: 'https://images.unsplash.com/photo-1605146769289-440113cc3d00?auto=format&fit=crop&w=800&q=85' },
  { id: '5', title: 'Hovlili uy, tayyor holatda', listing_type: 'sale', property_type: 'house', price: 149000, currency: 'USD', area_m2: 200, rooms: 5, floor: 2, floors_total: 2, district: 'Sergeli', city: 'Toshkent', seller_type: 'realtor', seller_name: 'Rieltor', is_mortgage_available: false, is_verified: true, is_featured: false, published_at: null, image_url: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=800&q=85' },
  { id: '6', title: '2 xonali kvartira', listing_type: 'sale', property_type: 'apartment', price: 90000, currency: 'USD', area_m2: 64, rooms: 2, floor: 4, floors_total: 9, district: 'Yakkasaroy', city: 'Toshkent', seller_type: 'owner', seller_name: 'Sotuvchi', is_mortgage_available: false, is_verified: true, is_featured: false, published_at: null, image_url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=85' },
  { id: '7', title: 'Tijorat uchun qulay bino', listing_type: 'sale', property_type: 'commercial', price: 135000, currency: 'USD', area_m2: 123, rooms: 0, floor: 1, floors_total: 1, district: 'Chilonzor', city: 'Toshkent', seller_type: 'realtor', seller_name: 'Rieltor', is_mortgage_available: false, is_verified: true, is_featured: false, published_at: null, image_url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=800&q=85' },
]

const ruTitles: Record<string, string> = {
  '2 xonali zamonaviy kvartira': 'Современная 2-комнатная квартира',
  'Yangi qurilgan premium uy': 'Новый дом премиум-класса',
  '3 xonali yorug‘ kvartira': 'Светлая 3-комнатная квартира',
  'Keng hovlili xususiy uy': 'Просторный частный дом с двором',
  'Hovlili uy, tayyor holatda': 'Готовый дом с двором',
  '2 xonali kvartira': '2-комнатная квартира',
  'Tijorat uchun qulay bino': 'Коммерческое помещение',
}

const t = {
  uz: { buy:'Sotib olish',rent:'Ijara',new:'Yangi uylar',build:'Uy qurish',mortgage:'Ipoteka',services:'Xizmatlar',agents:'Rieltorlar',all:'Barchasi',kicker:'O‘ZBEKISTONDA KO‘CHMAS MULK',hero:'Orzuyingizdagi uy',hero2:'Prohouse’da',heroText:'Sotib oling, ijaraga oling, investitsiya qiling.',heroText2:'Barchasi bir platformada.',active:'faol e’lonlar',verified:'tasdiqlangan rieltorlar',bank:'bank ipoteka takliflari',guarantee:'Prohouse kafolati',sale:'Sotuv',daily:'Kunlik',search:'Qidirish',location:'Joylashuv',district:'Tuman',type:'Ko‘chmas mulk turi',price:'Narx oralig‘i',allDistricts:'Barcha tumanlar',allTypes:'Barcha turlar',anyPrice:'Istalgan narx',owner:'Egasi',mortgageOk:'Ipotekaga mumkin',construction:'Yangi qurilish',week:'Oxirgi hafta',month:'Oxirgi oy',filters:'Batafsil filtrlar',categories:['Kvartiralar','Xususiy uylar','Yer uchastkalari','Tijorat mulki','Yangi binolar','Ipoteka','Rieltorlar','Barcha toifalar'],top:'Top e’lonlar',topSub:'Tasdiqlangan va eng yaxshi takliflar',latest:'So‘nggi e’lonlar',found:'ta e’lon',newest:'Yangi qo‘shilganlar',map:'Xaritani ochish',why:'Nega aynan Prohouse?',whySub:'Uy topishdan bitimgacha — kerakli xizmatlar bir joyda.',trust:'Ishonchli e’lonlar',trustText:'Har bir e’lon moderatsiyadan o‘tadi',choice:'Keng tanlov',choiceText:'100 000+ real e’lonlar',mapSearch:'Xarita orqali qidiring',mapText:'Hududni xaritada ko‘ring',ipoteka:'Ipoteka imkoniyatlari',ipotekaText:'Banklar shartlarini solishtiring',agentsPro:'Professional rieltorlar',agentsText:'Tasdiqlangan agentliklar',safe:'Xavfsiz bitim',safeText:'Xotirjamligingiz biz uchun muhim',partners:'Hamkorlarimiz',sellerKicker:'SOTUVCHILAR VA RIELTORLAR UCHUN',sellerTitle:'Mulkingizni Prohouse’da soting yoki ijaraga bering',sellerText:'E’lon joylashtiring, mijozlarni qabul qiling va statistika orqali natijani kuzating.',post:'E’lon joylashtirish',footer:'O‘zbekistonning zamonaviy ko‘chmas mulk platformasi.',property:'Ko‘chmas mulk',about:'Biz haqimizda',help:'Yordam',contact:'Aloqa'},
  ru: { buy:'Купить',rent:'Аренда',new:'Новостройки',build:'Построить дом',mortgage:'Ипотека',services:'Услуги',agents:'Риелторы',all:'Все',kicker:'НЕДВИЖИМОСТЬ В УЗБЕКИСТАНЕ',hero:'Найдите дом мечты',hero2:'на Prohouse',heroText:'Покупайте, арендуйте, инвестируйте.',heroText2:'Всё на одной платформе.',active:'активных объявлений',verified:'проверенных риелторов',bank:'ипотечных предложений банков',guarantee:'Гарантия Prohouse',sale:'Продажа',daily:'Посуточно',search:'Найти',location:'Расположение',district:'Район',type:'Тип недвижимости',price:'Диапазон цены',allDistricts:'Все районы',allTypes:'Все типы',anyPrice:'Любая цена',owner:'От владельца',mortgageOk:'Ипотека доступна',construction:'Новостройки',week:'Последняя неделя',month:'Последний месяц',filters:'Все фильтры',categories:['Квартиры','Частные дома','Земельные участки','Коммерция','Новостройки','Ипотека','Риелторы','Все категории'],top:'Лучшие объявления',topSub:'Проверенные и выгодные предложения',latest:'Последние объявления',found:'объявлений',newest:'Новые',map:'Открыть карту',why:'Почему Prohouse?',whySub:'Всё необходимое — от поиска дома до сделки.',trust:'Надёжные объявления',trustText:'Каждое объявление проходит модерацию',choice:'Большой выбор',choiceText:'100 000+ реальных объявлений',mapSearch:'Поиск на карте',mapText:'Смотрите районы на карте',ipoteka:'Возможности ипотеки',ipotekaText:'Сравнивайте условия банков',agentsPro:'Профессиональные риелторы',agentsText:'Проверенные агентства',safe:'Безопасная сделка',safeText:'Ваше спокойствие для нас важно',partners:'Наши партнёры',sellerKicker:'ДЛЯ ПРОДАВЦОВ И РИЕЛТОРОВ',sellerTitle:'Продавайте или сдавайте недвижимость на Prohouse',sellerText:'Размещайте объявления, принимайте клиентов и отслеживайте результат.',post:'Разместить объявление',footer:'Современная платформа недвижимости Узбекистана.',property:'Недвижимость',about:'О нас',help:'Помощь',contact:'Контакты'}
}

const money = (value:number,currency:string) => `${new Intl.NumberFormat('ru-RU').format(value)} ${currency === 'USD' ? 'у.е.' : 'сўм'}`

type MenuItem = [string,string,string,string]

const menus: Record<Exclude<ModalMode,null>, { uz: MenuItem[]; ru: MenuItem[] }> = {
  buy: { uz:[['▥','Kvartiralar','Kvartira','apartment'],['⌂','Xususiy uylar','Uy','house'],['▦','Yangi binolar','Yangi bino','new_building'],['⌁','Yer uchastkalari','Yer','land'],['▣','Tijorat mulki','Tijorat','commercial'],['₿','Ipoteka uchun','Ipoteka','mortgage'],['♙','Rieltor orqali','Rieltor','agents'],['••','Barcha takliflar','Barchasi','all']], ru:[['▥','Квартиры','Квартира','apartment'],['⌂','Частные дома','Дом','house'],['▦','Новостройки','Новостройка','new_building'],['⌁','Земельные участки','Земля','land'],['▣','Коммерческая недвижимость','Коммерция','commercial'],['₿','Ипотека','Ипотека','mortgage'],['♙','Через риелтора','Риелтор','agents'],['••','Все предложения','Все','all']] },
  rent: { uz:[['▥','Kvartira ijarasi','Kvartira','apartment'],['⌂','Uy ijarasi','Uy','house'],['▣','Tijorat ijarasi','Tijorat','commercial'],['⌁','Yer ijarasi','Yer','land'],['◷','Kunlik ijara','Kunlik','daily'],['♙','Rieltor orqali','Rieltor','agents'],['✓','Tasdiqlangan ijara','Tekshirilgan','verified'],['••','Barcha ijaralar','Barchasi','all']], ru:[['▥','Аренда квартир','Квартира','apartment'],['⌂','Аренда домов','Дом','house'],['▣','Коммерческая аренда','Коммерция','commercial'],['⌁','Аренда земли','Земля','land'],['◷','Посуточная аренда','Посуточно','daily'],['♙','Через риелтора','Риелтор','agents'],['✓','Проверенная аренда','Проверено','verified'],['••','Вся аренда','Все','all']] },
  mortgage: { uz:[['▣','Ipoteka ikkilamchi uylar uchun','Batafsil','mortgage'],['▦','Ipoteka kalkulyatori','Hisoblash','calculator'],['₿','Barcha ipoteka kreditlari','Ko‘rish','mortgage'],['₽','Ipoteka imkoniyati','Ko‘rish','mortgage'],['▦','Yangi uylar uchun ipoteka','Batafsil','new_building'],['▤','Ipoteka bo‘yicha xizmat','Batafsil','services'],['▣','Garov ostida kredit','Hisoblash','mortgage'],['%','Refinanslash','Batafsil','mortgage']], ru:[['▣','Ипотека на вторичку','Подробнее','mortgage'],['▦','Калькулятор ипотеки','Рассчитать','calculator'],['₿','Все ипотечные кредиты','Смотреть','mortgage'],['₽','Ипотечный потенциал','Смотреть','mortgage'],['▦','Ипотека на новостройку','Подробнее','new_building'],['▤','Обслуживание ипотеки','Подробнее','services'],['▣','Кредит под залог','Рассчитать','mortgage'],['%','Рефинансирование','Подробнее','mortgage']] },
  build: { uz:[['⌂','Uy loyihalari','Loyihalarni ko‘rish','projects'],['▤','Quruvchi tanlash','Quruvchilar','builders'],['⌁','Yer topish','Uchastkalar','land'],['▥','Tayyor uylar','Uylar','house'],['▣','Kottej shaharchalari','Shaharchalar','house'],['✓','Qurilishni nazorat qilish','Xizmatlar','services'],['▤','Smeta va loyiha','Hisoblash','services'],['••','Barcha imkoniyatlar','Ko‘rish','all']], ru:[['⌂','Каталог проектов','Смотреть проекты','projects'],['▤','Выбрать подрядчика','Подрядчики','builders'],['⌁','Найти участок','Участки','land'],['▥','Готовые дома','Дома','house'],['▣','Коттеджные посёлки','Посёлки','house'],['✓','Контроль строительства','Услуги','services'],['▤','Смета и проект','Рассчитать','services'],['••','Все возможности','Смотреть','all']] },
  services: { uz:[['⌕','Ko‘chmas mulk baholash','Baholash','services'],['₿','Ipoteka va kredit','Hisoblash','mortgage'],['▤','Ta’mirlash va dizayn','Xizmatlar','services'],['✓','Huquqiy tekshiruv','Batafsil','services'],['⌂','Sug‘urta','Batafsil','services'],['▣','Notarius','Batafsil','services'],['♙','Rieltor topish','Topish','agents'],['••','Barcha xizmatlar','Ko‘rish','all']], ru:[['⌕','Оценка недвижимости','Подробнее','services'],['₿','Ипотека и кредит','Рассчитать','mortgage'],['▤','Ремонт и дизайн','Услуги','services'],['✓','Юридическая проверка','Подробнее','services'],['⌂','Страхование','Подробнее','services'],['▣','Нотариус','Подробнее','services'],['♙','Найти риелтора','Найти','agents'],['••','Все услуги','Смотреть','all']] },
  agents: { uz:[['♙','Tasdiqlangan rieltorlar','Topish','agents'],['▣','Agentliklar','Ko‘rish','agents'],['✓','Premium rieltorlar','Ko‘rish','agents'],['⌕','Rieltor bo‘yicha qidirish','Qidirish','agents'],['⌂','Uy sotish bo‘yicha yordam','Batafsil','services'],['▤','Uy ijarasi bo‘yicha yordam','Batafsil','services'],['₿','Ipoteka bo‘yicha rieltor','Topish','mortgage'],['••','Barcha rieltorlar','Ko‘rish','agents']], ru:[['♙','Проверенные риелторы','Найти','agents'],['▣','Агентства','Смотреть','agents'],['✓','Премиальные риелторы','Смотреть','agents'],['⌕','Поиск риелтора','Найти','agents'],['⌂','Помощь при продаже','Подробнее','services'],['▤','Помощь при аренде','Подробнее','services'],['₿','Риелтор по ипотеке','Найти','mortgage'],['••','Все риелторы','Смотреть','agents']] },
  all: { uz:[['▥','Kvartiralar','Kvartira','apartment'],['⌂','Xususiy uylar','Uy','house'],['▦','Yangi binolar','Yangi bino','new_building'],['⌁','Yer uchastkalari','Yer','land'],['▣','Tijorat mulki','Tijorat','commercial'],['₿','Ipoteka','Kreditlar','mortgage'],['♙','Rieltorlar','Topish','agents'],['••','Barcha e’lonlar','Ko‘rish','all']], ru:[['▥','Квартиры','Квартира','apartment'],['⌂','Частные дома','Дом','house'],['▦','Новостройки','Новостройка','new_building'],['⌁','Земельные участки','Земля','land'],['▣','Коммерция','Коммерция','commercial'],['₿','Ипотека','Кредиты','mortgage'],['♙','Риелторы','Найти','agents'],['••','Все объявления','Смотреть','all']] }
}

const modalTitles: Record<Exclude<ModalMode,null>, {uz:string;ru:string}> = {
  buy:{uz:'Sotib olish',ru:'Покупка'}, rent:{uz:'Ijara',ru:'Аренда'}, mortgage:{uz:'Ipoteka',ru:'Ипотека'}, build:{uz:'Uy qurish',ru:'Построить дом'}, services:{uz:'Xizmatlar',ru:'Услуги'}, agents:{uz:'Rieltorlar',ru:'Риелторы'}, all:{uz:'Barchasi',ru:'Все'}
}

export default function Home() {
  const [lang,setLang] = useState<Lang>('uz')
  const [listings,setListings] = useState<Listing[]>(fallback)
  const [tab,setTab] = useState('sale')
  const [modal,setModal] = useState<ModalMode>(null)
  const text=t[lang]

  useEffect(()=>{
    const saved=window.localStorage.getItem('prohouse-lang') as Lang|null
    if(saved==='uz'||saved==='ru') setLang(saved)
    const supabase=createClient()
    if(!supabase) return
    void supabase.from('listings').select('*, listing_images(image_url,sort_order)').eq('status','active').order('is_featured',{ascending:false}).order('published_at',{ascending:false}).then(({data})=>{
      if(!data?.length) return
      setListings(data.map((row:any)=>({...row,image_url:row.listing_images?.sort((a:any,b:any)=>a.sort_order-b.sort_order)?.[0]?.image_url})))
    })
  },[])

  useEffect(()=>{
    if(!modal) return
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape') setModal(null)}
    document.addEventListener('keydown',onKey)
    document.body.style.overflow='hidden'
    return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=''}
  },[modal])

  const setLanguage=(next:Lang)=>{setLang(next);window.localStorage.setItem('prohouse-lang',next)}
  const featured=useMemo(()=>listings.filter(x=>x.is_featured).slice(0,3),[listings])
  const latest=useMemo(()=>listings.filter(x=>!x.is_featured).slice(0,4),[listings])
  const display=(p:Listing)=>lang==='ru'?(ruTitles[p.title]||p.title):p.title

  const openModal=(mode:Exclude<ModalMode,null>)=>setModal(mode)
  const target=(kind:string, modalMode:Exclude<ModalMode,null>)=>{
    const base=modalMode==='rent'?'rent':modalMode==='buy'?'sale':'all'
    if(kind==='mortgage') return `/listings?tab=${base}&mortgage=true`
    if(kind==='calculator') return '/listings?mortgage=true'
    if(kind==='new_building') return '/listings?type=new_building'
    if(kind==='apartment'||kind==='house'||kind==='land'||kind==='commercial') return `/listings?tab=${base}&type=${kind}`
    if(kind==='daily') return '/listings?tab=daily'
    if(kind==='verified') return '/listings?verified=true'
    return `/listings?tab=${base}`
  }

  return <main>
    <header className="header"><div className="container nav">
      <Link className="brand" href="/"><span className="brand-mark">⌂</span><span>Pro<span>house</span></span></Link>
      <nav className="main-nav">
        <button className="nav-link active" type="button" onClick={()=>openModal('buy')}>{text.buy}</button>
        <button className="nav-link" type="button" onClick={()=>openModal('rent')}>{text.rent}</button>
        <button className="nav-link" type="button" onClick={()=>openModal('build')}>{text.new}</button>
        <button className="nav-link" type="button" onClick={()=>openModal('build')}>{text.build}</button>
        <button className="nav-link" type="button" onClick={()=>openModal('mortgage')}>{text.mortgage}</button>
        <button className="nav-link" type="button" onClick={()=>openModal('services')}>{text.services}</button>
        <button className="nav-link" type="button" onClick={()=>openModal('agents')}>{text.agents}</button>
        <button className="nav-link" type="button" onClick={()=>openModal('all')}>{text.all}⌄</button>
      </nav>
      <div className="nav-actions"><button className="language-btn" type="button" onClick={()=>setLanguage(lang==='uz'?'ru':'uz')}>{lang==='uz'?'O‘z/Ru':'Ru/O‘z'}</button><span className="location-pill">⌖ Toshkent⌄</span><button className="round-btn" type="button">♡</button><button className="round-btn" type="button">♧</button><button className="account-btn" type="button">{lang==='uz'?'Kirish / Ro‘yxatdan o‘tish':'Войти / Регистрация'}</button></div>
    </div></header>

    <section className="hero-modern"><div className="hero-bg"/><div className="container hero-inner">
      <div className="hero-content"><span className="hero-kicker">{text.kicker}</span><h1>{text.hero}<br/><span>{text.hero2}</span></h1><p>{text.heroText}<br/>{text.heroText2}</p></div>
      <aside className="hero-stats"><div><b>10 000+</b><span>{text.active}</span></div><div><b>1 200+</b><span>{text.verified}</span></div><div><b>12+</b><span>{text.bank}</span></div><div><b>✓</b><span>{text.guarantee}</span></div></aside>
      <div className="search-card modern-search"><div className="search-tabs">{[['sale',text.sale],['rent',text.rent],['daily',text.daily],['new',text.new]].map(([key,label])=><button key={key} type="button" className={tab===key?'selected':''} onClick={()=>setTab(key)}>{label}</button>)}</div>
        <div className="search-row"><div className="field"><small>{text.location}</small><strong>⌖ Toshkent</strong></div><div className="field"><small>{text.district}</small><strong>{text.allDistricts}⌄</strong></div><div className="field"><small>{text.type}</small><strong>{text.allTypes}⌄</strong></div><div className="field"><small>{text.price}</small><strong>{text.anyPrice}⌄</strong></div><Link className="search-btn" href={`/listings?tab=${tab}`}>⌕ {text.search}</Link></div>
        <div className="quick-filters"><Link href={`/listings?tab=${tab}&owner=true`}>♙ {text.owner}</Link><Link href={`/listings?tab=${tab}&mortgage=true`}>▣ {text.mortgageOk}</Link><Link href={`/listings?tab=${tab}&type=new_building`}>⌂ {text.construction}</Link><Link href={`/listings?tab=${tab}&period=week`}>◷ {text.week}</Link><Link href={`/listings?tab=${tab}&period=month`}>□ {text.month}</Link><button className="all-filter" type="button" onClick={()=>openModal('all')}>☷ {text.filters}</button></div>
      </div>
    </div></section>

    <section className="container category-row">{text.categories.map((category,i)=><button type="button" className="category" key={category} onClick={()=>openModal(i===0?'buy':i===5?'mortgage':i===6?'agents':'all')}><span className={`cat-icon c${i}`}>{['▥','⌂','⌁','▣','▥','₿','♙','••'][i]}</span><b>{category}</b></button>)}</section>

    <section className="container marketplace-section"><div className="section-head"><div><h2>♛ {text.top}</h2><p>{text.topSub}</p></div><Link href="/listings">{lang==='uz'?'Barchasini ko‘rish →':'Смотреть все →'}</Link></div><div className="market-layout"><div className="listing-grid top-grid">{featured.map(p=><PropertyCard key={p.id} p={p} title={display(p)} lang={lang}/>)}</div><MapCard text={text}/></div></section>

    <section className="container marketplace-section latest-section"><div className="section-head"><div><h2>{text.latest}</h2><p>{lang==='uz'?'Topildi:':'Найдено:'} <strong>{listings.length?'86 146':'0'}</strong> {text.found}</p></div><div className="sort">{lang==='uz'?'Saralash:':'Сортировка:'} <b>{text.newest}⌄</b> <button type="button">▦</button><button type="button">☷</button></div></div><div className="market-layout"><div className="listing-grid latest-grid">{latest.map(p=><PropertyCard key={p.id} p={p} compact title={display(p)} lang={lang}/>)}</div><div className="side-stack"><MortgageCard text={text}/><AppCard lang={lang}/></div></div></section>

    <section className="why-section"><div className="container"><div className="section-head"><div><h2>{text.why}</h2><p>{text.whySub}</p></div></div><div className="why-grid">{[["◈",text.trust,text.trustText],["▥",text.choice,text.choiceText],["⌖",text.mapSearch,text.mapText],["₿",text.ipoteka,text.ipotekaText],["♙",text.agentsPro,text.agentsText],["✓",text.safe,text.safeText]].map(([icon,title,desc])=><div className="why-card" key={title}><span>{icon}</span><b>{title}</b><p>{desc}</p></div>)}</div></div></section>
    <section className="container partners"><span>{text.partners}</span><div><b>IPOTEKA BANK</b><b>HAMKORBANK</b><b>TBC BANK</b><b>XALQ BANKI</b><b>KAPITALBANK</b></div></section>
    <section className="container cta"><div><span className="muted-label">{text.sellerKicker}</span><h2>{text.sellerTitle}</h2><p>{text.sellerText}</p></div><button className="green-btn" type="button">{text.post} →</button></section>
    <footer><div className="container footer-grid"><div><Link className="brand" href="/"><span className="brand-mark">⌂</span><span>Pro<span>house</span></span></Link><p>{text.footer}</p></div><div><b>{text.property}</b><Link href="/listings">{text.buy}</Link><Link href="/listings?tab=rent">{text.rent}</Link><Link href="/listings?type=new_building">{text.new}</Link><a href="#">{text.build}</a></div><div><b>{text.services}</b><a href="#">{text.mortgage}</a><a href="#">{lang==='uz'?'Baholash':'Оценка'}</a><a href="#">{lang==='uz'?'Sug‘urta':'Страхование'}</a><a href="#">{lang==='uz'?'Notarius':'Нотариус'}</a></div><div><b>Prohouse</b><a href="#">{text.about}</a><a href="#">{lang==='uz'?'Yangiliklar':'Новости'}</a><a href="#">{text.help}</a><a href="#">{text.contact}</a></div><div><b>{lang==='uz'?'Yangiliklardan xabardor bo‘ling':'Будьте в курсе новостей'}</b><div className="subscribe"><input placeholder={lang==='uz'?'Email manzilingiz':'Ваш email'}/><button type="button">{lang==='uz'?'Obuna':'Подписаться'}</button></div><p>Telegram · Instagram · YouTube</p></div></div><div className="container footer-bottom">© 2026 Prohouse. {lang==='uz'?'Barcha huquqlar himoyalangan.':'Все права защищены.'}</div></footer>

    {modal && <div className="property-modal-overlay" role="presentation" onMouseDown={()=>setModal(null)}><section className="property-modal" role="dialog" aria-modal="true" aria-labelledby="property-modal-title" onMouseDown={event=>event.stopPropagation()}>
      <button className="modal-close" type="button" onClick={()=>setModal(null)} aria-label="Yopish">×</button>
      <div className="modal-heading"><span className="modal-kicker">PROHOUSE</span><h2 id="property-modal-title">{modalTitles[modal][lang]}</h2><p>{lang==='uz'?'Kerakli yo‘nalishni tanlang va mos takliflarni ko‘ring.':'Выберите нужное направление и смотрите подходящие предложения.'}</p></div>
      <div className="modal-category-grid">{menus[modal][lang].map(([icon,title,short,kind],index)=><Link key={`${title}-${index}`} href={target(kind,modal)} className="modal-category" onClick={()=>setModal(null)}><span className={`modal-icon mi-${index}`}>{icon}</span><strong>{title}</strong><small>{short}</small><span className="modal-arrow">→</span></Link>)}</div>
      <div className="modal-footer"><span>✓ {lang==='uz'?'Tasdiqlangan takliflar':'Проверенные предложения'}</span><span>⌖ Toshkent</span><Link href={target('all',modal)} onClick={()=>setModal(null)}>{lang==='uz'?'Barchasini ko‘rish →':'Смотреть все →'}</Link></div>
    </section></div>}
  </main>
}

function PropertyCard({p,compact=false,title,lang}:{p:Listing;compact?:boolean;title:string;lang:Lang}) { const seller=p.seller_name||(p.seller_type==='realtor'?(lang==='uz'?'Rieltor':'Риелтор'):(lang==='uz'?'Sotuvchi':'Владелец')); return <article className={`property-card ${compact?'compact':''}`}><div className="property-image" style={{backgroundImage:`url(${p.image_url})`}}><span className={`badge ${p.is_featured?'':'top'}`}>{p.is_featured?'VIP':'TOP'}</span><button className="heart" type="button">♡</button></div><div className="property-body"><h3>{money(p.price,p.currency)}</h3><p className="property-title">{title}</p><p className="location">⌖ {p.city}{p.district?`, ${p.district}`:''}</p><div className="meta">{p.area_m2?`${p.area_m2} m² · `:''}{p.rooms!==null?`${p.rooms} ${lang==='uz'?'xona':'комн.'} · `:''}{p.floor&&p.floors_total?`${p.floor}/${p.floors_total} ${lang==='uz'?'qavat':'эт.'}`:''}</div><div className="seller">◉ {seller} {p.is_verified&&<span>✓</span>}</div></div></article> }
function MapCard({text}:{text:typeof t.uz}) { return <aside className="map-card"><div className="map-toolbar"><span>✓ {text.mapSearch}</span><b>＋</b><b>−</b></div><div className="map-art"><span className="map-city">Toshkent</span>{[[25,32,'850 mln'],[54,25,'1.2 mlrd'],[72,52,'950 mln'],[35,68,'620 mln'],[59,76,'1.6 mlrd']].map(([x,y,label])=><span className="map-pin" style={{left:`${x}%`,top:`${y}%`}} key={`${x}-${y}`}><i/>{label}</span>)}</div><Link className="map-open" href="/listings">{text.map} →</Link></aside> }
function MortgageCard({text}:{text:typeof t.uz}) { return <div className="side-card mortgage-card"><span className="side-icon">₿</span><div><h3>{text.mortgage}</h3><p>{text.ipotekaText}</p><Link className="side-button" href="/listings?type=apartment&mortgage=true">{text.search} →</Link></div></div> }
function AppCard({lang}:{lang:Lang}) { return <div className="side-card app-card"><div><h3>Prohouse {lang==='uz'?'ilovasi':'приложение'}</h3><p>{lang==='uz'?'Uy izlash endi yanada qulay.':'Искать жильё стало ещё удобнее.'}</p><span>App Store · Google Play</span></div><div className="phone">▯</div></div> }
