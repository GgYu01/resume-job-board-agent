import { detectAccessLimited } from "../extract/collect-links.mjs";

const DETAIL_RE = /^https?:\/\/jobs\.51job\.com\/([^/?#]+)\/(\d+)\.html/i;

export const job51Adapter = {
  id: "51job",
  label: "51job",
  hostPatterns: [/51job\.com/i],
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

  detectAccessLimited(text, url) {
    return detectAccessLimited(text, url);
  },
};
