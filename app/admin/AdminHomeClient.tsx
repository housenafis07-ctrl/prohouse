'use client'

import Link from 'next/link'
import { useI18n } from '@/app/components/I18nProvider'

type Props = {
  email: string
  role: string
  stats: { total:number; moderation:number; active:number; rejected:number; partners:number; today:number; trustedProfiles:number; clients:number }
}

export default function AdminHomeClient({ email, role, stats }: Props) {
  const { lang, setLang } = useI18n()
  const ru = lang === 'ru'
  const t = (uz:string, ruText:string) => ru ? ruText : uz
  const cards = [
    [t('Jami e’lonlar','Всего объявлений'), stats.total, t('Barcha e’lonlar','Все объявления')],
    [t('Jami mijozlar','Всего клиентов'), stats.clients, t('Hamkorlar va jismoniy shaxslar','Партнёры и физические лица')],
    [t('Moderatsiyada','На модерации'), stats.moderation, t('Tekshiruv kutilmoqda','Ожидают проверки')],
    [t('Faol e’lonlar','Активные объявления'), stats.active, t('Saytda ko‘rinayotgan','Опубликованы на сайте')],
    [t('Rad etilgan','Отклонённые'), stats.rejected, t('Qayta ishlash mumkin','Можно переработать')],
    [t('Hamkorlar','Партнёры'), stats.partners, t('Hamkor akkauntlar','Аккаунты партнёров')],
    [t('Bugun qo‘shilgan','Добавлено сегодня'), stats.today, t('Bugungi yangi e’lonlar','Новые объявления за сегодня')],
  ]
  return <main className="min-h-screen bg-slate-50">
    <header className="border-b bg-white"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
      <b className="text-xl">Royalhouse Admin</b>
      <div className="flex items-center gap-4"><div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white text-xs font-bold">
        <button onClick={()=>setLang('uz')} className={`px-3 py-2 ${!ru?'bg-slate-900 text-white':'text-slate-600'}`}>UZ</button>
        <button onClick={()=>setLang('ru')} className={`px-3 py-2 ${ru?'bg-slate-900 text-white':'text-slate-600'}`}>RU</button>
      </div><span className="text-sm text-slate-500">{email}</span></div>
    </div></header>
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="font-bold text-emerald-600">{t('Boshqaruv markazi','Центр управления')}</p>
      <h1 className="mt-1 text-3xl font-black">{t('Admin panel','Панель администратора')}</h1>
      <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">{cards.map(([label,value,desc])=><div key={String(label)} className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-black">{value}</p><p className="mt-1 text-xs text-slate-400">{desc}</p></div>)}</div>
      <Link href="/admin/directory" className="mt-6 block rounded-3xl bg-slate-900 p-6 text-white shadow-sm transition hover:-translate-y-0.5"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="text-3xl">🔎</div><h2 className="mt-3 text-xl font-black">{t('Mijozlar va e’lonlarni qidirish','Поиск клиентов и объявлений')}</h2><p className="mt-2 text-sm text-slate-300">{t('Hamkor ID, e’lon ID, ism, telefon yoki kompaniya bo‘yicha toping. E’lonni qoralamaga qaytaring yoki o‘chiring.','Поиск по ID партнёра, ID объявления, имени, телефону или компании. Возврат объявления в черновик или удаление.')}</p></div><span className="rounded-xl bg-emerald-500 px-5 py-3 font-black text-white">{t('Qidiruvni ochish →','Открыть поиск →')}</span></div></Link>
      <div className="mt-7 grid gap-5 md:grid-cols-3">
        <Link href="/admin/moderation" className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5"><div className="text-3xl">✓</div><h2 className="mt-4 text-xl font-black">{t('E’lonlar moderatsiyasi','Модерация объявлений')}</h2><p className="mt-2 text-sm text-slate-500">{t('Hamkorlar yuborgan e’lonlarni tekshirish, tasdiqlash yoki rad etish.','Проверяйте, подтверждайте или отклоняйте объявления от партнёров.')}</p><span className="mt-5 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">{stats.moderation} {t('ta e’lonni ko‘rish','объявлений')}</span></Link>
        <Link href="/admin/messages" className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5"><div className="text-3xl">📨</div><h2 className="mt-4 text-xl font-black">{t('Xabarlar','Сообщения')}</h2><p className="mt-2 text-sm text-slate-500">{t('Sayt va Telegram orqali kelgan murojaatlarni ko‘ring va holatini boshqaring.','Просматривайте обращения с сайта и Telegram и управляйте их статусами.')}</p><span className="mt-5 inline-block rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">{t('Xabarlarni ochish','Открыть сообщения')}</span></Link>
        <Link href="/admin/trusted-partners" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-emerald-100 transition hover:-translate-y-0.5"><div className="text-3xl">🤝</div><h2 className="mt-4 text-xl font-black">{t('Ishonchli hamkorlar','Доверенные партнёры')}</h2><p className="mt-2 text-sm text-slate-500">{t('Hamkorlarning hujjatlarini ko‘ring, arxivlang, tasdiqlang yoki rad eting.','Просматривайте документы партнёров, архивируйте, подтверждайте или отклоняйте заявки.')}</p><span className="mt-5 inline-block rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">{t('So‘rovlarni ko‘rish','Открыть заявки')}</span></Link>
        <Link href="/admin/trusted-partners?section=individuals" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-sky-100 transition hover:-translate-y-0.5"><div className="text-3xl">✓</div><h2 className="mt-4 text-xl font-black">{t('Ishonchli profillar','Доверенные профили')}</h2><p className="mt-2 text-sm text-slate-500">{t('MyID orqali tasdiqlangan jismoniy shaxslarning ishonchli profil so‘rovlarini ko‘rib chiqing va tasdiqlang.','Проверяйте и подтверждайте заявки на доверенный профиль физических лиц, прошедших MyID.')}</p><span className="mt-5 inline-block rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white">{stats.trustedProfiles} {t('ta profilni ko‘rib chiqish','профилей')}</span></Link>
        {role==='super_admin'&&<Link href="/admin/administrators" className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5"><div className="text-3xl">♙</div><h2 className="mt-4 text-xl font-black">{t('Administratorlar','Администраторы')}</h2><p className="mt-2 text-sm text-slate-500">{t('Oddiy adminlarni yaratish, vakolatlarini berish va bloklash.','Создавайте администраторов, назначайте права и блокируйте их.')}</p><span className="mt-5 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">{t('Boshqarish','Управление')}</span></Link>}
      </div>
      <Link href="/admin/payments" className="mt-5 block rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 hover:ring-emerald-300"><p className="text-xs font-black uppercase tracking-wider text-emerald-600">{t('MOLIYA', 'ФИНАНСЫ')}</p><h2 className="mt-2 text-xl font-black">{t('To‘lovlar hisoboti', 'Отчёт по платежам')}</h2><p className="mt-1 text-sm text-slate-500">{t('Mijozlar, xizmatlar, oy/yil boshidan va jami tushum statistikasi.', 'Клиенты, услуги и статистика поступлений за месяц, год и за всё время.')}</p><span className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white">{t('Hisobotni ochish', 'Открыть отчёт')}</span></Link>
      <Link href="/admin/mortgage" className="mt-5 block rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 hover:ring-emerald-300"><p className="text-xs font-black uppercase tracking-wider text-emerald-600">Royalhouse</p><h2 className="mt-2 text-xl font-black">{t('Ipoteka arizalari','Ипотечные заявки')}</h2><p className="mt-1 text-sm text-slate-500">{t('Bank, kalkulyator va aniq e’lon bilan bog‘langan mortgage leadlar.','Заявки, связанные с банком, калькулятором и конкретными объявлениями.')}</p><span className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white">{t('Ochish','Открыть')}</span></Link>
    </div>
  </main>
}
