import { normalizeText } from "../shared/text.mjs";

export function redactSensitiveEvidence(text) {
  return normalizeText(text)
    .replace(/\s*\r?\n\s*/g, " ")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email-redacted]")
    .replace(/(^|[^\d])1[3-9]\d\*{3,}\d{2,4}($|[^\d])/g, "$1[phone-redacted]$2")
    .replace(/(^|[^\d])1[3-9]\d{9}($|[^\d])/g, "$1[phone-redacted]$2")
    .replace(/((?:微信|V信|联系方式|(?:WeChat|wechat|VX|vx|wx)\b)(?:\s*[:：]?\s*|\s+))[A-Za-z0-9_.-]{4,}/gi, "$1[contact-redacted]")
    .replace(/\bwxid_[A-Za-z0-9_-]+\b/gi, "[wechat-redacted]");
}
