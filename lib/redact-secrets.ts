export function redactSecrets(text: string) {
  return text
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, "[PRIVATE KEY REDACTED]")
    .replace(/\b(password|secret|token|api[_-]?key)([\s"']*[:=][\s"']*)[^\s,;}'"]+/gi, "$1$2[REDACTED]")
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|sk_(?:live|test)_[A-Za-z0-9]{12,}|AIza[A-Za-z0-9_-]{20,})\b/g, "[REDACTED]");
}
