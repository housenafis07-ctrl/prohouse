declare module '@/app/lib/otp-state.mjs' {
  export const OTP_LENGTH: number
  export function applyInput(digits: string[], index: number, raw: unknown, length?: number): { digits: string[]; focus: number }
  export function applyBackspace(digits: string[], index: number, length?: number): { digits: string[]; focus: number }
  export function joinDigits(digits: string[]): string
  export function isComplete(digits: string[], length?: number): boolean
  export function createSubmitGuard(): {
    tryStart(code: string): boolean
    finish(): void
    reset(): void
  }
}
