export const OTP_LENGTH = 6;

const onlyDigits = (raw) => String(raw ?? '').replace(/\D/g, '');

export function applyInput(digits, index, raw, length = OTP_LENGTH) {
  const next = digits.slice(0, length);
  while (next.length < length) next.push('');
  let incoming = onlyDigits(raw);

  if (incoming === '') {
    next[index] = '';
    return { digits: next, focus: index };
  }

  if (incoming.length === 2 && next[index] !== '') {
    incoming = incoming[0] === next[index] ? incoming[1] : incoming[0];
  }

  const start = incoming.length >= length ? 0 : index;
  let i = start;
  for (const ch of incoming) {
    if (i >= length) break;
    next[i] = ch;
    i++;
  }
  return { digits: next, focus: Math.min(i, length - 1) };
}

export function applyBackspace(digits, index, length = OTP_LENGTH) {
  const next = digits.slice(0, length);
  while (next.length < length) next.push('');
  if (next[index] !== '') {
    next[index] = '';
    return { digits: next, focus: index };
  }
  const prev = Math.max(0, index - 1);
  next[prev] = '';
  return { digits: next, focus: prev };
}

export const joinDigits = (digits) => digits.join('');
export const isComplete = (digits, length = OTP_LENGTH) =>
  digits.length === length && digits.every((d) => /^\d$/.test(d));

export function createSubmitGuard() {
  let inFlight = false;
  let last = null;
  return {
    tryStart(code) {
      if (inFlight || code === last) return false;
      inFlight = true;
      last = code;
      return true;
    },
    finish() { inFlight = false; },
    reset() { inFlight = false; last = null; },
  };
}
