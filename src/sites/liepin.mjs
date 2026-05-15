import { canonicalJobUrl } from "./index.mjs";
import { detectAccessLimited } from "../extract/collect-links.mjs";

export const liepinAdapter = {
  id: "liepin",
  label: "Liepin",
  hostPatterns: [/liepin\.com/i],
  authCheckUrl: "https://www.liepin.com/zhaopin/?key=AI%20Agent",
  reloginUrl: "https://www.liepin.com/",

  isSearchUrl(url) {
    try {
      const parsed = new URL(String(url || ""));
      return parsed.hostname.endsWith("liepin.com") && parsed.pathname.replace(/\/+$/, "") === "/zhaopin";
    } catch {
      return false;
    }
  },

  isDetailUrl(url) {
    return canonicalJobUrl(url)?.site === "liepin";
  },

  canonicalizeDetailUrl(url) {
    const canonical = canonicalJobUrl(url);
    return canonical?.site === "liepin" ? canonical.url : null;
  },

  detectAccessLimited(text, url) {
    return detectAccessLimited(text, url);
  },
};
