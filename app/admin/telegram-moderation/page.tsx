'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/app/components/I18nProvider'

type Status = { configured:boolean; groupConfigured:boolean; moderatorCount:number; webhookUrl:string }
type Moderator = {
  id:string
  telegram_user_id:string
  chat_id:string
  username:string|null
  first_name:string|null
  is_active:boolean
  linked_at:string
  created_at:string
}
type Invite = { inviteUrl:string; expiresAt:string }

export default function TelegramModerationAdminPage() {
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const t = (uz:string, rt:string) => ru ? rt : uz
  const [status,setStatus] = useState<Status|null>(null)
  const [moderators,setModerators] = useState<Moderator[]>([])
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState(false)
  const [updatingId,setUpdatingId] = useState('')
  const [message,setMessage] = useState('')
  const [invite,setInvite] = useState<Invite|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [statusResponse, moderatorsResponse] = await Promise.all([
        fetch('/api/admin/telegram/moderation/setup',{cache:'no-store'}),
        fetch('/api/admin/telegram/moderators',{cache:'no-store'}),
      ])
      const [statusData, moderatorsData] = await Promise.all([
        statusResponse.json().catch(()=>({})),
        moderatorsResponse.json().catch(()=>({})),
      ])
      if(statusResponse.ok) setStatus(statusData)
      else throw new Error(statusData.error || t('Bot holatini yuklab bo‘lmadi.','Не удалось загрузить состояние бота.'))
      if(moderatorsResponse.ok) setModerators(moderatorsData.moderators || [])
      else throw new Error(moderatorsData.error || t('Moderatorlar ro‘yxatini yuklab bo‘lmadi.','Не удалось загрузить список модераторов.'))
    } catch(error) {
      setMessage(error instanceof Error ? error.message : t('Ma’lumotlarni yuklashda xatolik.','Ошибка загрузки данных.'))
    } finally { setLoading(false) }
  }, [lang])

  useEffect(()=>{void load()},[load])

  async function setup() {
    setBusy(true);setMessage('')
    try {
      const response = await fetch('/api/admin/telegram/moderation/setup',{method:'POST'})
      const data = await response.json()
      if(!response.ok) throw new Error(data.error || t('Webhook sozlanmadi.','Не удалось настроить webhook.'))
      setMessage(t('Telegram moderatsiya botining webhook’i muvaffaqiyatli sozlandi.','Webhook бота модерации Telegram успешно настроен.'))
      await load()
    } catch(error) {
      setMessage(error instanceof Error ? error.message : t('Xatolik yuz berdi.','Произошла ошибка.'))
    } finally { setBusy(false) }
  }

  async function createInvite() {
    setBusy(true);setMessage('');setInvite(null)
    try {
      const response = await fetch('/api/admin/telegram/moderators',{method:'POST'})
      const data = await response.json()
      if(!response.ok) throw new Error(data.error || t('Taklif havolasi yaratilmadi.','Не удалось создать ссылку-приглашение.'))
      setInvite({inviteUrl:data.inviteUrl,expiresAt:data.expiresAt})
    } catch(error) {
      setMessage(error instanceof Error ? error.message : t('Xatolik yuz berdi.','Произошла ошибка.'))
    } finally { setBusy(false) }
  }

  async function toggleModerator(moderator:Moderator) {
    setUpdatingId(moderator.id);setMessage('')
    try {
      const response = await fetch('/api/admin/telegram/moderators',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:moderator.id,isActive:!moderator.is_active})})
      const data = await response.json()
      if(!response.ok) throw new Error(data.error || t('Moderator holati o‘zgartirilmadi.','Не удалось изменить статус модератора.'))
      await load()
    } catch(error) {
      setMessage(error instanceof Error ? error.message : t('Xatolik yuz berdi.','Произошла ошибка.'))
    } finally { setUpdatingId('') }
  }

  async function copyInvite() {
    if(!invite?.inviteUrl) return
    try {
      await navigator.clipboard.writeText(invite.inviteUrl)
      setMessage(t('Taklif havolasi nusxalandi.','Ссылка-приглашение скопирована.'))
    } catch {
      setMessage(t('Havolani qo‘lda nusxalang.','Скопируйте ссылку вручную.'))
    }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-8">
    <div className="mx-auto max-w-4xl">
      <Link href="/admin" className="text-sm font-bold text-emerald-700">← {t('Admin panel','Панель администратора')}</Link>
      <h1 className="mt-4 text-3xl font-black">{t('Telegram moderatsiya boti','Telegram-бот модерации')}</h1>
      <p className="mt-2 text-sm text-slate-500">{t('Moderatorlar ro‘yxati va yopiq guruhga yuboriladigan moderatsiya xabarnomalarini boshqarish.','Управление списком модераторов и уведомлениями о модерации в закрытой группе.')}</p>

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black">{t('Ulanish holati','Состояние подключения')}</h2>
        {loading ? <p className="mt-4 text-sm text-slate-500">{t('Tekshirilmoqda...','Проверка...')}</p> : <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between"><span>{t('Bot token va webhook secret','Токен бота и webhook secret')}</span><b>{status?.configured ? '✓' : '—'}</b></div>
          <div className="flex items-center justify-between"><span>{t('Yopiq guruh ID','ID закрытой группы')}</span><b>{status?.groupConfigured ? '✓' : '—'}</b></div>
          <div className="flex items-center justify-between"><span>{t('Faol moderatorlar','Активные модераторы')}</span><b>{status?.moderatorCount ?? 0}</b></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{t('Webhook manzili','Адрес webhook')}</p><p className="mt-1 break-all font-mono text-xs">{status?.webhookUrl}</p></div>
        </div>}
        <button onClick={()=>void setup()} disabled={busy||loading||!status?.configured} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-40">{busy?t('Sozlanmoqda...','Настройка...'):t('Bot webhook’ini sozlash','Настроить webhook бота')}</button>
      </section>

      <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-lg font-black">{t('Moderatorlar boshqaruvi','Управление модераторами')}</h2><p className="mt-1 text-sm text-slate-500">{t('Moderatorni bir martalik havola orqali Telegram akkauntiga ulang. Havola 15 daqiqa amal qiladi.','Привяжите Telegram-аккаунт модератора одноразовой ссылкой. Ссылка действует 15 минут.')}</p></div>
          <button onClick={()=>void createInvite()} disabled={busy||!status?.configured} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{t('+ Moderator qo‘shish','+ Добавить модератора')}</button>
        </div>
        {invite && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-bold text-emerald-900">{t('Taklif havolasi tayyor','Ссылка-приглашение готова')}</p>
          <p className="mt-1 break-all text-xs text-emerald-900">{invite.inviteUrl}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3"><button onClick={()=>void copyInvite()} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white">{t('Havolani nusxalash','Скопировать ссылку')}</button><span className="text-xs text-emerald-800">{t('Amal qilish muddati: 15 daqiqa','Срок действия: 15 минут')}</span></div>
        </div>}
        {message && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">{message}</p>}
        {loading ? <p className="mt-5 text-sm text-slate-500">{t('Yuklanmoqda...','Загрузка...')}</p> : moderators.length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{t('Hali moderator bog‘lanmagan. “Moderator qo‘shish” tugmasi orqali taklif havolasini yarating.','Пока ни один модератор не подключён. Создайте ссылку кнопкой «Добавить модератора».')}</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm">
          <thead><tr className="border-b text-xs uppercase text-slate-400"><th className="py-3 pr-3">{t('Moderator','Модератор')}</th><th className="py-3 pr-3">Telegram ID</th><th className="py-3 pr-3">{t('Ulangan sana','Дата подключения')}</th><th className="py-3 pr-3">{t('Holat','Статус')}</th><th className="py-3">{t('Amal','Действие')}</th></tr></thead>
          <tbody>{moderators.map(moderator=><tr key={moderator.id} className="border-b last:border-0">
            <td className="py-3 pr-3"><b>{moderator.first_name || (moderator.username ? '@'+moderator.username : t('Telegram foydalanuvchisi','Пользователь Telegram'))}</b>{moderator.username && <p className="text-xs text-slate-500">@{moderator.username}</p>}</td>
            <td className="py-3 pr-3 font-mono text-xs">{moderator.telegram_user_id}</td>
            <td className="py-3 pr-3 text-xs text-slate-500">{moderator.linked_at ? new Date(moderator.linked_at).toLocaleString(ru?'ru-RU':'uz-UZ') : '—'}</td>
            <td className="py-3 pr-3"><span className={moderator.is_active?'rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700':'rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500'}>{moderator.is_active?t('Faol','Активен'):t('Nofaol','Неактивен')}</span></td>
            <td className="py-3"><button disabled={updatingId===moderator.id} onClick={()=>void toggleModerator(moderator)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40">{updatingId===moderator.id?t('Saqlanmoqda...','Сохранение...'):moderator.is_active?t('Huquqni bekor qilish','Отключить'):t('Faollashtirish','Активировать')}</button></td>
          </tr>)}</tbody>
        </table></div>}
        <p className="mt-4 text-xs leading-5 text-slate-500">{t('Moderatorni o‘chirish uning huquqini darhol bekor qiladi. Tarixiy tasdiqlash va rad etish yozuvlari saqlanadi. Faqat super-admin ushbu bo‘limni boshqaradi.','Отключение модератора сразу отзывает его права. История подтверждений и отклонений сохраняется. Управлять этим разделом может только супер-администратор.')}</p>
      </section>

      <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black">{t('Dastlabki sozlash tartibi','Первоначальная настройка')}</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-600">
          <li>{t('BotFather orqali alohida RoyalHouse Moderatsiya botini yarating. Mavjud mijozlar botining tokenini ishlatmang.','Создайте отдельного бота RoyalHouse Moderation через BotFather. Не используйте токен клиентского бота.')}</li>
          <li>{t('Vercel Preview muhitiga TELEGRAM_MODERATION_BOT_TOKEN va TELEGRAM_MODERATION_WEBHOOK_SECRET o‘zgaruvchilarini kiriting.','Добавьте в Vercel Preview переменные TELEGRAM_MODERATION_BOT_TOKEN и TELEGRAM_MODERATION_WEBHOOK_SECRET.')}</li>
          <li>{t('Botni yopiq moderatorlar guruhiga qo‘shing va ROYALHOUSE_MODERATION_GROUP_ID qiymatini sozlang.','Добавьте бота в закрытую группу модераторов и настройте ROYALHOUSE_MODERATION_GROUP_ID.')}</li>
          <li>{t('Webhook’ni yuqoridagi tugma orqali ulang. Keyin “Moderator qo‘shish” orqali har bir moderatorga shaxsiy taklif havolasini yuboring.','Подключите webhook кнопкой выше. Затем отправьте каждому модератору персональную ссылку через «Добавить модератора».')}</li>
        </ol>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{t('Bot tokeni va webhook secret’ni chatga yubormang. Ularni faqat Vercel Environment Variables orqali kiriting. Hozircha Production muhitiga o‘zgartirish kiritmang.','Не отправляйте токен бота и webhook secret в чат. Добавляйте их только через Vercel Environment Variables. Пока не меняйте Production.')}</p>
      </section>
    </div>
  </main>
}
