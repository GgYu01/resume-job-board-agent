import { detectAccessLimited } from "../extract/collect-links.mjs";

const DETAIL_RE = /^https?:\/\/jobs\.51job\.com\/([^/?#]+)\/(\d+)\.html/i;

export const job51Adapter = {
  id: "51job",
  label: "51job",
  hostPatterns: [/51job\.com/i],
  hosts: [/51job\.com/i],
  authCheckUrl: "https://www.51job.com/",
  reloginUrl: "https://www.51job.com/",

  isSearchUrl(url) {
    try {
      const parsed = new URL(String(url || ""));
      return parsed.hostname.endsWith("51job.com") && /\/list\//i.test(parsed.pathname);
    } catch {
      return false;
    }
  },

  isDetailUrl(url) {
    return DETAIL_RE.test(String(url || ""));
  },

  canonicalizeDetailUrl(url) {
    const match = String(url || "").match(DETAIL_RE);
    return match ? `https://jobs.51job.com/${match[1]}/${match[2]}.html` : null;
  },

  canonicalize(url) {
    const match = String(url || "").match(DETAIL_RE);
    return match
      ? {
          site: "51job",
          id: match[2],
          url: `https://jobs.51job.com/${match[1]}/${match[2]}.html`,
          semanticKey: `51job:${match[2]}`,
        }
      : null;
  },

  searchUrl(input) {
    const query = encodeURIComponent(input?.query || "");
    return `https://search.51job.com/list/000000,000000,0000,00,9,99,${query},2,1.html`;
  },

  authProbe() {
    return { url: this.authCheckUrl, expression: `(() => JSON.stringify({ loggedInSignals: true, url: location.href, title: document.title || "" }))()` };
  },

  collectExpression() {
    return `(() => JSON.stringify({
      accessLimited: /验证|captcha|verify|安全/i.test(document.body?.innerText || location.href),
      items: Array.from(document.querySelectorAll("a[href*='jobs.51job.com']")).slice(0, 80).map((a, index) => ({
        site: "51job",
        id: a.href.match(/\\/(\\d+)\\.html/)?.[1] || String(index),
        url: a.href,
        titleText: a.textContent?.trim() || "",
        cardText: a.closest("li,.j_joblist,.joblist")?.textContent?.trim() || a.textContent?.trim() || "",
        sourceUrl: location.href,
        sourceTitle: document.title || ""
      }))
    }))()`;
  },

  detailExpression() {
    return `(() => JSON.stringify({
      url: location.href,
      title: document.querySelector("h1")?.textContent?.trim() || document.title || "",
      company: document.querySelector("[class*='company']")?.textContent?.trim() || "",
      text: (document.body?.innerText || "").slice(0, 8000)
    }))()`;
  },

  accessLimitExpression() {
    return `(() => JSON.stringify({ accessLimited: /验证|captcha|verify|安全/i.test(document.body?.innerText || location.href), url: location.href, title: document.title || "" }))()`;
  },

  contactActionSpec() {
    return null;
  },

  detectAccessLimited(text, url) {
    return detectAccessLimited(text, url);
  },
};
