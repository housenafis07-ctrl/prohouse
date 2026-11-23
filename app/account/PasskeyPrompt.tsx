'use client'

import { useEffect, useState } from 'react'
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser'
import PasskeyManager from './PasskeyManager'

const DISMISSED_KEY = 'royalhouse.passkey-prompt-dismissed.v1'

export default function PasskeyPrompt() {
  const [visible, setVisible] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let active = true
    async function check() {
      try {
        if (localStorage.getItem(DISMISSED_KEY) === '1' || !browserSupportsWebAuthn()) return
        const response = await fetch('/api/account/passkeys', { cache: 'no-store', credentials: 'same-origin' })
        if (!response.ok) return
        const data = await response.json()
        if (!active || (data.passkeys || []).length > 0) return
        const platformAvailable = await platformAuthenticatorIsAvailable()
        if (active && platformAvailable) setVisible(true)
      } catch {
        // A failed capability check must never block the cabinet.
      } finally { if (active) setChecked(true) }
    }
    void check()
    return () => { active = false }
  }, [])

  function close() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  if (!checked || !visible) return null
  return <PasskeyManager mode="prompt" onClose={close} />
}
