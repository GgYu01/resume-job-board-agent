import { normalizeText } from "../shared/text.mjs";

export function redactSensitiveEvidence(text) {
  return normalizeText(text)
    .replace(/\s*\r?\n\s*/g, " ")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email-redacted]")
    .replace(/(^|[^\d])1[3-9]\d\*{3,}\d{2,4}($|[^\d])/g, "$1[phone-redacted]$2")
    .replace(/(^|[^\d])1[3-9]\d{9}($|[^\d])/g, "$1[phone-redacted]$2")
    .replace(/\b[A-Za-z0-9_.-]{4,}\b(?=\s*(?:[\u4e00-\u9fffA-Za-z0-9_.-]{1,30}\u7684)?\u5fae\u4fe1\u53f7)/gi, "[contact-redacted]")
    .replace(/((?:(?:[\u4e00-\u9fffA-Za-z0-9_.-]{1,30}\u7684)?\u5fae\u4fe1\u53f7|\u5fae\u4fe1|V\u4fe1|\u8054\u7cfb\u65b9\u5f0f|(?:WeChat|wechat|VX|vx|wx)\b)(?:\s*[:\uff1a]?\s*|\s+))[A-Za-z0-9_.-]{4,}/gi, "$1[contact-redacted]")
    .replace(/\bwxid_[A-Za-z0-9_-]+\b/gi, "[wechat-redacted]");
}
