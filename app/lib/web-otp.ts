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

function syncOtpInput(code: string) {
  if (typeof document === 'undefined') return
  const input = document.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')
  if (!input || input.disabled) return

  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  nativeSetter?.call(input, code)
  input.dispatchEvent(new Event('input', { bubbles: true }))
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
        syncOtpInput(code)
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
