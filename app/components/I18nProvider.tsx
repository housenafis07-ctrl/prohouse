'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { DEFAULT_LANG, LANG_EVENT, LANG_STORAGE_KEY, getStoredLang, translate, type I18nKey, type Lang } from '@/lib/i18n'

type I18nContextValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  toggleLang: () => void
  t: (key: I18nKey) => string
  tx: (uz: string, ru: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG)

  useEffect(() => {
    const sync = () => setLangState(getStoredLang())
    sync()
    window.addEventListener(LANG_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(LANG_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const setLang = (next: Lang) => {
    setLangState(next)
    window.localStorage.setItem(LANG_STORAGE_KEY, next)
    window.dispatchEvent(new Event(LANG_EVENT))
  }

  const value = useMemo<I18nContextValue>(() => ({
    lang,
    setLang,
    toggleLang: () => setLang(lang === 'uz' ? 'ru' : 'uz'),
    t: (key) => translate(lang, key),
    tx: (uz, ru) => lang === 'ru' ? ru : uz,
  }), [lang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}
