import { canonicalJobUrl } from "./index.mjs";
import { detectAccessLimited } from "../extract/collect-links.mjs";

export const bossAdapter = {
  id: "boss",
  label: "BOSS Zhipin",
  hostPatterns: [/zhipin\.com/i],
  authCheckUrl: "https://www.zhipin.com/web/geek/jobs",
  reloginUrl: "https://www.zhipin.com/web/geek/jobs",

  isSearchUrl(url) {
    try {
      const parsed = new URL(String(url || ""));
      return parsed.hostname.endsWith("zhipin.com") && parsed.pathname.replace(/\/+$/, "") === "/web/geek/jobs";
    } catch {
      return false;
    }
  },

  isDetailUrl(url) {
    return canonicalJobUrl(url)?.site === "boss";
  },

  canonicalizeDetailUrl(url) {
    const canonical = canonicalJobUrl(url);
    return canonical?.site === "boss" ? canonical.url : null;
  },

  detectAccessLimited(text, url) {
    return detectAccessLimited(text, url);
  },
};
