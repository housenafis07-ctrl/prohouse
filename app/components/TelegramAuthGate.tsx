'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type TelegramAuthGateValue = {
  ready: boolean
  waitForReady: () => Promise<void>
  markReady: () => void
}

const TelegramAuthGateContext = createContext<TelegramAuthGateValue | null>(null)

export function TelegramAuthGateProvider({ children }: { children: ReactNode }) {
  const resolveRef = useRef<(() => void) | null>(null)
  const promiseRef = useRef<Promise<void> | null>(null)
  const [ready, setReady] = useState(false)

  if (!promiseRef.current) {
    promiseRef.current = new Promise<void>((resolve) => {
      resolveRef.current = resolve
    })
  }

  const markReady = () => {
    if (ready) return
    setReady(true)
    resolveRef.current?.()
    resolveRef.current = null
  }

  const value = useMemo<TelegramAuthGateValue>(() => ({
    ready,
    waitForReady: () => promiseRef.current!,
    markReady,
  }), [ready])

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_TG_AUTH_BARRIER !== '1') markReady()
  }, [])

  return (
    <TelegramAuthGateContext.Provider value={value}>
      {children}
    </TelegramAuthGateContext.Provider>
  )
}

export function useTelegramAuthGate() {
  const value = useContext(TelegramAuthGateContext)
  if (!value) throw new Error('useTelegramAuthGate must be used inside TelegramAuthGateProvider')
  return value
}
