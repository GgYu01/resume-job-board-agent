import { canonicalJobUrl } from "./index.mjs";
import { detectAccessLimited } from "../extract/collect-links.mjs";
import {
  contactActionLabels,
  contactTriggerExpression,
  contactVerificationExpression,
} from "./contact-actions.mjs";

const accessLimitExpression = `(() => JSON.stringify({
  accessLimited: /安全验证|验证码|verify|captcha/i.test(document.body?.innerText || location.href),
  url: location.href,
  title: document.title || ""
}))()`;

const detailExpression = `(() => JSON.stringify({
  url: location.href,
  title: document.querySelector(".job-title")?.textContent?.trim() || document.title || "",
  company: document.querySelector(".company-info")?.textContent?.trim() || "",
  text: (document.body?.innerText || "").slice(0, 8000)
}))()`;

const collectExpression = `(() => JSON.stringify({
  accessLimited: /安全验证|验证码|verify|captcha/i.test(document.body?.innerText || location.href),
  items: Array.from(document.querySelectorAll("a[href*='/job_detail/']")).slice(0, 80).map((a, index) => ({
    site: "boss",
    id: a.href.match(/job_detail\\/([^/?#]+)\\.html/)?.[1] || String(index),
    url: a.href,
    titleText: a.textContent?.trim() || "",
    cardText: a.closest("li,.job-card-wrapper,.job-card-body")?.textContent?.trim() || a.textContent?.trim() || "",
    sourceUrl: location.href,
    sourceTitle: document.title || ""
  }))
}))()`;

export const bossAdapter = {
  id: "boss",
  label: "BOSS Zhipin",
  hostPatterns: [/zhipin\.com/i],
  hosts: [/zhipin\.com/i],
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

  canonicalize(url) {
    const canonical = canonicalJobUrl(url);
    return canonical?.site === "boss"
      ? { site: "boss", id: canonical.id, url: canonical.url, semanticKey: `boss:${canonical.id}` }
      : null;
  },

  searchUrl(input) {
    const query = encodeURIComponent(input?.query || "");
    return `https://www.zhipin.com/web/geek/jobs?query=${query}`;
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
      triggerExpression: contactTriggerExpression("boss"),
      verificationExpression: contactVerificationExpression("boss"),
      labels: contactActionLabels("boss"),
    };
  },

  detectAccessLimited(text, url) {
    return detectAccessLimited(text, url);
  },
};
