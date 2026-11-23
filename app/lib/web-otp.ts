export function isWebOtpSupported(): boolean {
  return typeof window !== 'undefined' && 'OTPCredential' in window && !!navigator.credentials?.get
}

export function normalizeCode(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '').slice(0, 6)
}

export function splitCode(value: unknown): string[] {
  const code = normalizeCode(value)
  return Array.from({ length: 6 }, (_, index) => code[index] ?? '')
}

type WebOtpCredential = Credential & { code?: string }

type ListenOptions = {
  onCode?: (code: string) => void
  onError?: (error: unknown) => void
  timeoutMs?: number
}

export function listenForSmsOtp({ onCode, onError, timeoutMs = 60000 }: ListenOptions = {}): () => void {
  if (!isWebOtpSupported()) return () => {}

  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let settled = false

  const finish = () => {
    if (timer) clearTimeout(timer)
    timer = undefined
  }

  const listen = async () => {
    try {
      timer = setTimeout(() => controller.abort(), timeoutMs)
      const credential = await navigator.credentials.get({
        otp: { transport: ['sms'] },
        signal: controller.signal,
      } as CredentialRequestOptions & { otp: { transport: string[] } }) as WebOtpCredential | null

      settled = true
      const code = normalizeCode(credential?.code)
      if (code.length === 6) {
        console.debug('[otp-autofill] WebOTP resolved')
        // React owns the OTP input value. The consumer writes the code to its
        // controlled state, which keeps the visual input and verification flow
        // in one source of truth.
        onCode?.(code)
      }
    } catch (error) {
      settled = true
      if ((error as { name?: string } | null)?.name === 'AbortError') return
      console.debug('[otp-autofill] WebOTP rejected', (error as { name?: string } | null)?.name || error)
      onError?.(error)
    } finally {
      finish()
    }
  }

  void listen()

  return () => {
    if (!settled) controller.abort()
    finish()
  }
}
