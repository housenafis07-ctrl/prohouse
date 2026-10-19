'use client'

import { useEffect, useRef } from 'react'

type Props = { value: string; disabled?: boolean; onChange: (value: string) => void; onComplete: (value: string) => void }

export default function OtpSixDigitInput({ value, disabled, onChange, onComplete }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const lastSubmitted = useRef('')
  const normalize = (raw: string) => raw.replace(/\D/g, '').slice(0, 6)
  const apply = (raw: string) => {
    const next = normalize(raw)
    onChange(next)
    if (next.length === 6 && next !== lastSubmitted.current) {
      lastSubmitted.current = next
      onComplete(next)
    }
  }
  useEffect(() => { if (value.length < 6) lastSubmitted.current = '' }, [value])
  return (
    <div className="relative grid grid-cols-6 gap-2" role="group" aria-label="SMS kodi" onClick={() => inputRef.current?.focus()}>
      {Array.from({ length: 6 }, (_, index) => <div key={index} className="flex h-14 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-xl font-bold text-slate-900">{value[index] || ''}</div>)}
      <input ref={inputRef} value={value} disabled={disabled} type="text" inputMode="numeric" autoComplete="one-time-code" name="one-time-code" aria-label="SMS kodi" enterKeyHint="done" maxLength={6}
        onChange={e => apply(e.target.value)} onInput={e => apply((e.target as HTMLInputElement).value)}
        onPaste={e => { e.preventDefault(); apply(e.clipboardData.getData('text')) }}
        onKeyDown={e => { if (e.key === 'Enter' && value.length === 6) onComplete(value) }}
        className="absolute inset-0 h-full w-full cursor-text rounded-xl border-0 bg-transparent text-transparent opacity-[0.02] outline-none caret-transparent"
        style={{ WebkitTextFillColor: 'transparent' }} />
    </div>
  )
}
