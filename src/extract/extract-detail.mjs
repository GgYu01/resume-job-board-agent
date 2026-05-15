import { detectAccessLimited, stripHtml } from "./collect-links.mjs";
import { canonicalJobUrl, siteFromUrl } from "../sites/index.mjs";

function firstMatch(html, patterns) {
  for (const pattern of patterns) {
    const match = String(html || "").match(pattern);
    if (match?.[1]) return stripHtml(match[1]);
  }
  return "";
}

function titleFromHtml(html) {
  return firstMatch(html, [
    /<h1\b[^>]*>([\s\S]*?)<\/h1>/i,
    /<title\b[^>]*>([\s\S]*?)(?:-|_|\|).*?<\/title>/i,
    /<title\b[^>]*>([\s\S]*?)<\/title>/i,
  ]);
}

export function extractDetailFromHtml(html, {
  site = "",
  url = "",
  sourceTitle = "",
} = {}) {
  const canonical = canonicalJobUrl(url);
  const text = stripHtml(html);
  const title = titleFromHtml(html);
  const company = firstMatch(html, [
    /<[^>]*class=["'][^"']*(?:company|company-name|companyName)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    /公司[:：]\s*([^薪资地点要求职责\n]+)/i,
  ]);
  const salary = firstMatch(html, [
    /<[^>]*class=["'][^"']*(?:salary|job-item-title|job-salary)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    /(\d+(?:-\d+)?K(?:·\d+薪)?)/i,
  ]);
  const location = firstMatch(html, [
    /<[^>]*class=["'][^"']*(?:location|basic-infor|job-area|area)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    /(北京|上海|深圳|广州|杭州|南京|苏州|成都|武汉|西安|厦门|天津|重庆)[^\n，,。]{0,12}/,
  ]);
  const requirements = firstMatch(html, [
    /<section\b[^>]*class=["'][^"']*(?:requirements|job-sec|job-detail|description)[^"']*["'][^>]*>([\s\S]*?)<\/section>/i,
    /<section\b[^>]*>([\s\S]*?)<\/section>/i,
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<body\b[^>]*>([\s\S]*?)<\/body>/i,
  ]);

  return {
    site: site || canonical?.site || siteFromUrl(url),
    id: canonical?.id || "",
    url: canonical?.url || url,
    sourceTitle,
    accessLimited: detectAccessLimited(text, url),
    title,
    company,
    salary,
    location,
    requirements,
    description: requirements,
    detailText: text,
  };
}
