'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useI18n } from '@/app/components/I18nProvider'

type Status = { configured:boolean; groupConfigured:boolean; moderatorCount:number; webhookUrl:string }

export default function TelegramModerationAdminPage() {
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const t = (uz:string, rt:string) => ru ? rt : uz
  const [status,setStatus] = useState<Status|null>(null)
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('')
  async function load() {
    setLoading(true)
    const response = await fetch('/api/admin/telegram/moderation/setup',{cache:'no-store'})
    const data = await response.json().catch(()=>({}))
    if(response.ok) setStatus(data)
    else setMessage(data.error || t('Holatni yuklab bo‘lmadi.','Не удалось загрузить статус.'))
    setLoading(false)
  }
  useEffect(()=>{void load()},[])
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
  return <main className="min-h-screen bg-slate-50 px-4 py-8">
    <div className="mx-auto max-w-3xl">
      <Link href="/admin" className="text-sm font-bold text-emerald-700">← {t('Admin panel','Панель администратора')}</Link>
      <h1 className="mt-4 text-3xl font-black">{t('Telegram moderatsiya boti','Telegram-бот модерации')}</h1>
      <p className="mt-2 text-sm text-slate-500">{t('Yopiq moderatorlar guruhi va moderatorlarning shaxsiy bot xabarnomalarini boshqarish.','Управление уведомлениями в закрытой группе модераторов и личных чатах.')}</p>
      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black">{t('Ulanish holati','Состояние подключения')}</h2>
        {loading ? <p className="mt-4 text-sm text-slate-500">{t('Tekshirilmoqda...','Проверка...')}</p> : <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between"><span>{t('Bot token va webhook secret','Токен бота и webhook secret')}</span><b>{status?.configured ? '✓' : '—'}</b></div>
          <div className="flex items-center justify-between"><span>{t('Yopiq guruh ID','ID закрытой группы')}</span><b>{status?.groupConfigured ? '✓' : '—'}</b></div>
          <div className="flex items-center justify-between"><span>{t('Ruxsatli moderatorlar','Разрешённые модераторы')}</span><b>{status?.moderatorCount ?? 0}</b></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{t('Webhook manzili','Адрес webhook')}</p><p className="mt-1 break-all font-mono text-xs">{status?.webhookUrl}</p></div>
        </div>}
        {message && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">{message}</p>}
        <button onClick={()=>void setup()} disabled={busy||loading||!status?.configured} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-40">{busy?t('Sozlanmoqda...','Настройка...'):t('Bot webhook’ini sozlash','Настроить webhook бота')}</button>
      </section>
      <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black">{t('Dastlabki sozlash tartibi','Первоначальная настройка')}</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-600">
          <li>{t('BotFather orqali alohida RoyalHouse Moderatsiya botini yarating. Mavjud mijozlar botining tokenini ishlatmang.','Создайте отдельного бота RoyalHouse Moderation через BotFather. Не используйте токен клиентского бота.')}</li>
          <li>{t('Vercel Preview muhitiga quyidagi to‘rtta environment variable’ni kiriting: TELEGRAM_MODERATION_BOT_TOKEN, TELEGRAM_MODERATION_WEBHOOK_SECRET, ROYALHOUSE_MODERATION_GROUP_ID, ROYALHOUSE_MODERATOR_TELEGRAM_IDS.','Добавьте в среду Vercel Preview четыре переменные: TELEGRAM_MODERATION_BOT_TOKEN, TELEGRAM_MODERATION_WEBHOOK_SECRET, ROYALHOUSE_MODERATION_GROUP_ID, ROYALHOUSE_MODERATOR_TELEGRAM_IDS.')}</li>
          <li>{t('Moderatorlar botga /start yuboradi. Botdan /chatid yuborib har bir moderatorning Telegram ID sini oling.','Каждый модератор отправляет боту /start. Командой /chatid получите Telegram ID каждого модератора.')}</li>
          <li>{t('Botni yopiq moderatorlar guruhiga qo‘shing va guruhda /chatid yuborib chat ID ni oling.','Добавьте бота в закрытую группу модераторов и отправьте /chatid, чтобы получить ID группы.')}</li>
          <li>{t('ID larni Vercel Preview environment’iga kiriting va yuqoridagi tugma orqali webhook’ni ulang.','Добавьте ID в переменные Vercel Preview и подключите webhook кнопкой выше.')}</li>
        </ol>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{t('Bot tokeni va webhook secret’ni chatga yubormang. Ularni faqat Vercel Environment Variables orqali kiriting. Hozircha Production muhitiga o‘zgartirish kiritmang.','Не отправляйте токен бота и webhook secret в чат. Добавляйте их только через Vercel Environment Variables. Пока не меняйте Production.')}</p>
      </section>
    </div>
  </main>
}
