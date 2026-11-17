'use client'

import { useCallback, useEffect, useState } from 'react'
import { startRegistration } from '@simplewebauthn/browser'

type Passkey = { credential_id: string; friendly_name: string | null; device_type: string; backed_up: boolean; created_at: string; last_used_at: string | null }

export default function PasskeyManager({ mode = 'settings', onClose }: { mode?: 'settings' | 'prompt'; onClose?: () => void }) {
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/account/passkeys', { cache: 'no-store', credentials: 'same-origin' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'PASSKEYS_LOAD_FAILED')
      setPasskeys(data.passkeys || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PASSKEYS_LOAD_FAILED')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function enable() {
    setBusy(true); setError(''); setMessage('')
    try {
      const optionsResponse = await fetch('/api/account/passkeys/register/options', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
      })
      const options = await optionsResponse.json()
      if (!optionsResponse.ok) throw new Error(options.error || 'PASSKEY_OPTIONS_FAILED')
      const credential = await startRegistration({ optionsJSON: options })
      const verifyResponse = await fetch('/api/account/passkeys/register/verify', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: credential, friendlyName: 'Ushbu qurilma' }),
      })
      const result = await verifyResponse.json()
      if (!verifyResponse.ok || !result.verified) throw new Error(result.error || 'PASSKEY_REGISTRATION_FAILED')
      setMessage('Biometrik kirish muvaffaqiyatli yoqildi.')
      await load()
      onClose?.()
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      setError(name === 'NotAllowedError' ? 'Tasdiqlash bekor qilindi yoki qurilmada Passkey sozlanmagan.' : err instanceof Error ? err.message : 'PASSKEY_REGISTRATION_FAILED')
    } finally { setBusy(false) }
  }

  async function remove(credentialId: string) {
    if (!window.confirm('Ushbu qurilmadagi Passkey o‘chirilsinmi?')) return
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/account/passkeys', {
        method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'PASSKEY_DELETE_FAILED')
      setMessage('Passkey o‘chirildi.')
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'PASSKEY_DELETE_FAILED') }
    finally { setBusy(false) }
  }

  const content = <div className={mode === 'prompt' ? 'space-y-4' : 'space-y-5'}>
    {mode === 'settings' && <div><h1 className="text-2xl font-black text-slate-900">Xavfsizlik va kirish</h1><p className="mt-2 text-sm text-slate-500">Akkauntingizga kirish uchun Passkey qurilmalarini boshqaring.</p></div>}
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-2xl">⌁</span>
        <div><h2 className="font-extrabold text-slate-900">Biometrik kirish (Passkey)</h2><p className="mt-1 text-sm leading-6 text-slate-600">Keyingi safar barmoq izi, Face ID yoki qurilma PIN-kodi orqali tez va xavfsiz kirishingiz mumkin. Biometrik ma’lumotlar RoyalHouse serverida saqlanmaydi.</p></div>
      </div>
    </div>
    {loading ? <p className="text-sm text-slate-500">Qurilmalar tekshirilmoqda…</p> : passkeys.length > 0 ? <div className="space-y-2">{passkeys.map(item => <div key={item.credential_id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{item.friendly_name || 'Passkey qurilmasi'}</p><p className="mt-1 text-xs text-slate-500">{item.backed_up ? 'Bulut bilan sinxronlangan' : 'Qurilmada saqlangan'} · {new Date(item.created_at).toLocaleDateString()}</p></div><button type="button" disabled={busy} onClick={() => void remove(item.credential_id)} className="shrink-0 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">O‘chirish</button></div>)}</div> : <p className="text-sm text-slate-500">Hozircha biometrik kirish qurilmasi ulanmagan.</p>}
    <button type="button" disabled={busy} onClick={() => void enable()} className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-extrabold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">{busy ? 'Bajarilmoqda…' : passkeys.length ? 'Yana qurilma qo‘shish' : 'Biometrik kirishni yoqish'}</button>
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
    {error && <div role="alert" className="space-y-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"><p>{error === 'PASSKEY_RECENT_AUTH_REQUIRED' ? 'Xavfsizlik uchun avval SMS kod bilan qayta kiring, so‘ng Passkey qo‘shing.' : error === 'PASSKEY_RATE_LIMITED' ? 'Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.' : error}</p>{error === 'PASSKEY_RECENT_AUTH_REQUIRED' && <button type="button" onClick={() => { window.location.href = '/account/login?next=%2Faccount%2Fsecurity' }} className="rounded-lg bg-rose-100 px-3 py-2 font-bold">SMS kod bilan qayta kirish</button>}</div>}
    {mode === 'prompt' && <button type="button" onClick={onClose} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600">Hozir emas</button>}
  </div>

  if (mode === 'prompt') return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="passkey-prompt-title" className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-6"><div className="mb-4 text-center"><div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">⌁</div><h2 id="passkey-prompt-title" className="text-xl font-black text-slate-900">RoyalHouse xavfsizligi</h2><p className="mt-2 text-sm leading-6 text-slate-600">Keyingi safar akkauntingizga barmoq izi yoki Face ID orqali tez va xavfsiz kirishni xohlaysizmi?</p></div>{content}</section></div>
  return content
}
