import { canonicalJobUrl, siteMatches } from "../sites/index.mjs";

function safeUrl(input) {
  try {
    return new URL(String(input || ""));
  } catch {
    return null;
  }
}

function sameUrl(a, b) {
  const left = safeUrl(a);
  const right = safeUrl(b);
  if (!left || !right) return false;
  left.hash = "";
  right.hash = "";
  return left.href === right.href;
}

function normalizedUrlKey(input) {
  const parsed = safeUrl(input);
  if (!parsed) return "";
  parsed.hash = "";
  return parsed.href;
}

export function isCollectableSearchUrl(input) {
  const parsed = safeUrl(input);
  if (!parsed || canonicalJobUrl(parsed.href)) return false;
  if (isCollectableRecommendationUrl(parsed.href)) return false;
  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.replace(/\/+$/, "") || "/";

  if (host.endsWith("zhipin.com")) {
    if (pathname === "/web/geek/jobs") return true;
    return /^\/c\d+(?:-p\d+)?$/.test(pathname);
  }

  if (host.endsWith("liepin.com")) {
    if (pathname === "/zhaopin") return true;
    return /^\/city-[^/]+\/career\/[^/]+$/.test(pathname);
  }

  if (host.endsWith("51job.com")) {
    return pathname.startsWith("/list/");
  }

  return false;
}

export function isCollectableRecommendationUrl(input) {
  const parsed = safeUrl(input);
  if (!parsed || canonicalJobUrl(parsed.href)) return false;
  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.replace(/\/+$/, "") || "/";

  if (host.endsWith("zhipin.com") && pathname === "/web/geek/jobs") {
    return !parsed.searchParams.get("query");
  }

  if (host.endsWith("liepin.com") && pathname === "/zhaopin") {
    return !parsed.searchParams.get("key");
  }

  return false;
}

export function recommendationPageUrls(site = "both") {
  const normalized = String(site || "both").toLowerCase();
  const urls = [];
  if (normalized === "both" || normalized === "boss") {
    urls.push("https://www.zhipin.com/web/geek/jobs");
  }
  if (normalized === "both" || normalized === "liepin") {
    urls.push("https://www.liepin.com/zhaopin/");
  }
  return urls;
}

function skippedTarget(target, reason) {
  return {
    id: target?.id || "",
    title: target?.title || "",
    url: target?.url || "",
    reason,
  };
}

function selectedTarget(target, collectionReason) {
  return { ...target, collectionReason };
}

export function classifyCollectTargets(targets, {
  site = "both",
  seedUrls = [],
  seeded = [],
  recommendationUrls = [],
  seededRecommendations = [],
  allTabs = false,
  includeRecommendations = false,
} = {}) {
  const seedIds = new Set((seeded || []).map((item) => item?.targetId || item?.id).filter(Boolean));
  const recommendationIds = new Set((seededRecommendations || []).map((item) => item?.targetId || item?.id).filter(Boolean));
  const normalizedSeedUrls = (seedUrls || []).map(String).filter(Boolean);
  const normalizedRecommendationUrls = (recommendationUrls || []).map(String).filter(Boolean);
  const selected = [];
  const skipped = [];
  const selectedUrlKeys = new Set();
  const select = (target, collectionReason) => {
    const urlKey = normalizedUrlKey(target?.url || "");
    if (urlKey && selectedUrlKeys.has(urlKey)) {
      skipped.push(skippedTarget(target, "duplicate-target-url"));
      return;
    }
    if (urlKey) selectedUrlKeys.add(urlKey);
    selected.push(selectedTarget(target, collectionReason));
  };

  for (const target of targets || []) {
    if (target?.type !== "page" || !target?.webSocketDebuggerUrl) {
      skipped.push(skippedTarget(target, "not-page-target"));
      continue;
    }
    if (!siteMatches(target.url || "", site)) {
      skipped.push(skippedTarget(target, "site-mismatch"));
      continue;
    }

    if (allTabs) {
      select(target, "all-tabs");
      continue;
    }

    if (normalizedSeedUrls.length || normalizedRecommendationUrls.length) {
      if (
        recommendationIds.has(target.id)
        || normalizedRecommendationUrls.some((url) => sameUrl(target.url, url))
        || (isCollectableRecommendationUrl(target.url) && normalizedSeedUrls.some((url) => sameUrl(target.url, url)))
      ) {
        select(target, "recommendation-list-tab");
        continue;
      }
      if (seedIds.has(target.id) || normalizedSeedUrls.some((url) => sameUrl(target.url, url))) {
        select(target, "seeded-url");
      } else {
        skipped.push(skippedTarget(target, "not-seeded-target"));
      }
      continue;
    }

    if (isCollectableRecommendationUrl(target.url)) {
      select(target, "recommendation-list-tab");
      continue;
    }

    if (isCollectableSearchUrl(target.url)) {
      select(target, "search-list-tab");
      continue;
    }

    if (canonicalJobUrl(target.url || "")) {
      if (includeRecommendations) {
        select(target, "detail-recommendations");
      } else {
        skipped.push(skippedTarget(target, "detail-recommendations-disabled"));
      }
      continue;
    }

    skipped.push(skippedTarget(target, "non-search-tab"));
  }

  return { selected, skipped };
}
