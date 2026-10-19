export function isWebOtpSupported() {
  return typeof window !== 'undefined' && 'OTPCredential' in window && !!navigator?.credentials?.get;
}

export function normalizeCode(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 6);
}

export function splitCode(value) {
  const code = normalizeCode(value);
  return Array.from({ length: 6 }, (_, index) => code[index] ?? '');
}

export function listenForSmsOtp({ onCode, onError, timeoutMs = 60000 } = {}) {
  if (!isWebOtpSupported()) return () => {};

  const controller = new AbortController();
  let timer;

  const listen = async () => {
    try {
      timer = setTimeout(() => controller.abort(), timeoutMs);
      const credential = await navigator.credentials.get({
        otp: { transport: ['sms'] },
        signal: controller.signal,
      });
      const code = normalizeCode(credential?.code);
      if (code.length === 6) onCode?.(code);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      onError?.(error);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  void listen();
  return () => controller.abort();
}
