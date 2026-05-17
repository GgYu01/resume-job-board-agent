import { canonicalJobUrl } from "./index.mjs";
import { detectAccessLimited } from "../extract/collect-links.mjs";
import {
  contactActionLabels,
  contactTriggerExpression,
  contactVerificationExpression,
} from "./contact-actions.mjs";

const accessLimitExpression = `(() => JSON.stringify({
  accessLimited: /验证|captcha|verify|安全/i.test(document.body?.innerText || location.href),
  url: location.href,
  title: document.title || ""
}))()`;

const detailExpression = `(() => JSON.stringify({
  url: location.href,
  title: document.querySelector("[class*='title']")?.textContent?.trim() || document.title || "",
  company: document.querySelector("[class*='company']")?.textContent?.trim() || "",
  text: (document.body?.innerText || "").slice(0, 8000)
}))()`;

const collectExpression = `(() => JSON.stringify({
  accessLimited: /验证|captcha|verify|安全/i.test(document.body?.innerText || location.href),
  items: Array.from(document.querySelectorAll("a[href*='/job/']")).slice(0, 80).map((a, index) => ({
    site: "liepin",
    id: a.href.match(/\\/job\\/(\\d+)\\.shtml/)?.[1] || String(index),
    url: a.href,
    titleText: a.textContent?.trim() || "",
    cardText: a.closest("li,.job-card,.job-list-box")?.textContent?.trim() || a.textContent?.trim() || "",
    sourceUrl: location.href,
    sourceTitle: document.title || ""
  }))
}))()`;

export const liepinAdapter = {
  id: "liepin",
  label: "Liepin",
  hostPatterns: [/liepin\.com/i],
  hosts: [/liepin\.com/i],
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

  canonicalize(url) {
    const canonical = canonicalJobUrl(url);
    return canonical?.site === "liepin"
      ? { site: "liepin", id: canonical.id, url: canonical.url, semanticKey: `liepin:${canonical.id}` }
      : null;
  },

  searchUrl(input) {
    const query = encodeURIComponent(input?.query || "");
    return `https://www.liepin.com/zhaopin/?key=${query}`;
  },

  authProbe() {
    return { url: this.authCheckUrl, expression: `(() => JSON.stringify({ loggedInSignals: !/登录|注册/.test(document.body?.innerText || ""), url: location.href, title: document.title || "" }))()` };
  },

  collectExpression() {
    return collectExpression;
  },

  detailExpression() {
    return detailExpression;
  },

  accessLimitExpression() {
    return accessLimitExpression;
  },

  contactActionSpec() {
    return {
      triggerExpression: contactTriggerExpression("liepin"),
      verificationExpression: contactVerificationExpression("liepin"),
      labels: contactActionLabels("liepin"),
    };
  },

  detectAccessLimited(text, url) {
    return detectAccessLimited(text, url);
  },
};
