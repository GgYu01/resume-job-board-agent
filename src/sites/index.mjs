export const BOSS_DETAIL_QUERY_PARAMS = ["securityId", "lid", "ka"];

export const SITE_PATTERNS = {
  liepin: {
    host: "liepin.com",
    detail: /https?:\/\/(?:www\.)?liepin\.com\/((?:job|a)\/(\d+)\.shtml)/i,
  },
  boss: {
    host: "zhipin.com",
    detail: /https?:\/\/(?:www\.)?zhipin\.com\/job_detail\/([^/?#]+)\.html/i,
  },
  "51job": {
    host: "51job.com",
    detail: /https?:\/\/jobs\.51job\.com\/([^/?#]+)\/(\d+)\.html/i,
  },
};

export function filteredRawSearch(parsedUrl, allowedParams = []) {
  const rawSearch = String(parsedUrl.search || "").replace(/^\?/, "");
  if (!rawSearch) return "";
  const allowed = new Set(allowedParams);
  const pairs = rawSearch.split("&").filter((pair) => {
    const rawName = pair.split("=", 1)[0].replace(/\+/g, " ");
    let name = rawName;
    try {
      name = decodeURIComponent(rawName);
    } catch {
      // Keep the raw name if the source page emitted a malformed escape.
    }
    return allowed.has(name);
  });
  return pairs.length ? `?${pairs.join("&")}` : "";
}

export function canonicalJobUrl(input) {
  let url = String(input || "").trim();
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(url);
    url = parsed.href;
  } catch {
    return null;
  }
  for (const [site, cfg] of Object.entries(SITE_PATTERNS)) {
    const match = url.match(cfg.detail);
    if (!match) continue;
    if (site === "liepin") {
      return { site, id: match[2], url: `https://www.liepin.com/${match[1]}` };
    }
    if (site === "boss") {
      const detailUrl = `https://www.zhipin.com/job_detail/${match[1]}.html${filteredRawSearch(parsed, BOSS_DETAIL_QUERY_PARAMS)}`;
      return { site, id: match[1], url: detailUrl };
    }
    if (site === "51job") {
      return { site, id: match[2], url: `https://jobs.51job.com/${match[1]}/${match[2]}.html` };
    }
  }
  return null;
}

export function isGenericJobBoardUrl(input) {
  let parsed;
  try {
    parsed = new URL(String(input || ""));
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.replace(/\/+$/, "");
  if (host.endsWith("zhipin.com") && pathname === "/web/geek/jobs") return true;
  if (host.endsWith("liepin.com") && pathname === "/zhaopin") return true;
  if (host.endsWith("51job.com") && /\/list\//i.test(pathname)) return true;
  return false;
}

export function siteFromUrl(url) {
  const text = String(url || "");
  if (/liepin\.com/i.test(text)) return "liepin";
  if (/zhipin\.com/i.test(text)) return "boss";
  if (/51job\.com/i.test(text)) return "51job";
  return null;
}

export function siteMatches(url, site) {
  if (!url) return false;
  if (site === "both") return /liepin\.com|zhipin\.com|51job\.com/i.test(url);
  const cfg = SITE_PATTERNS[site];
  return cfg ? new RegExp(cfg.host, "i").test(url) : true;
}

export function recordKey(record) {
  const canonical = canonicalJobUrl(record.url || record.href || "");
  if (canonical) return `${canonical.site}:${canonical.id}`;
  return String(record.url || record.href || "").trim();
}
