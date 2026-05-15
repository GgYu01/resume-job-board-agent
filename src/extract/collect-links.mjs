import { canonicalJobUrl, siteMatches } from "../sites/index.mjs";
import { normalizeText } from "../shared/text.mjs";

export function stripHtml(html) {
  return normalizeText(String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'"));
}

export function detectAccessLimited(text, url = "") {
  const haystack = `${stripHtml(text)} ${url}`;
  return /安全验证|验证码|访问过于频繁|滑块|captcha|verify|verification|_security_check|safe\.liepin\.com|verify\.zhipin\.com/i.test(haystack);
}

function decodeHtmlAttr(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
}

function anchorMatches(html) {
  return Array.from(String(html || "").matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi));
}

function surroundingText(html, startIndex, endIndex) {
  const source = String(html || "");
  const before = source.slice(0, startIndex);
  const openMatch = Array.from(before.matchAll(/<(section|article|li|div)\b[^>]*>/gi)).pop();
  if (openMatch) {
    const tag = openMatch[1].toLowerCase();
    const openIndex = openMatch.index;
    const closeIndex = source.toLowerCase().indexOf(`</${tag}>`, endIndex);
    if (closeIndex > openIndex) return stripHtml(source.slice(openIndex, closeIndex + tag.length + 3));
  }
  const windowBefore = Math.max(0, startIndex - 250);
  const windowAfter = Math.min(source.length, endIndex + 250);
  return stripHtml(source.slice(windowBefore, windowAfter));
}

export function extractJobCardsFromHtml(html, {
  site = "both",
  sourceUrl = "",
  sourceTitle = "",
} = {}) {
  const text = stripHtml(html);
  const items = [];
  const seen = new Set();

  for (const match of anchorMatches(html)) {
    const href = decodeHtmlAttr(match[2]);
    const canonical = canonicalJobUrl(href);
    if (!canonical || !siteMatches(canonical.url, site)) continue;
    const key = `${canonical.site}:${canonical.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const titleText = stripHtml(match[3]);
    const cardText = surroundingText(html, match.index, match.index + match[0].length);
    items.push({
      site: canonical.site,
      id: canonical.id,
      url: canonical.url,
      titleText,
      cardText,
      sourceUrl,
      sourceTitle,
    });
  }

  return {
    sourceUrl,
    sourceTitle,
    accessLimited: detectAccessLimited(text, sourceUrl),
    bodySample: text.slice(0, 1500),
    items,
  };
}
