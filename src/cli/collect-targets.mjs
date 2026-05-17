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

export function isCollectableSearchUrl(input) {
  const parsed = safeUrl(input);
  if (!parsed || canonicalJobUrl(parsed.href)) return false;
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
  allTabs = false,
  includeRecommendations = false,
} = {}) {
  const seedIds = new Set((seeded || []).map((item) => item?.targetId || item?.id).filter(Boolean));
  const normalizedSeedUrls = (seedUrls || []).map(String).filter(Boolean);
  const selected = [];
  const skipped = [];

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
      selected.push(selectedTarget(target, "all-tabs"));
      continue;
    }

    if (normalizedSeedUrls.length) {
      if (seedIds.has(target.id) || normalizedSeedUrls.some((url) => sameUrl(target.url, url))) {
        selected.push(selectedTarget(target, "seeded-url"));
      } else {
        skipped.push(skippedTarget(target, "not-seeded-target"));
      }
      continue;
    }

    if (isCollectableSearchUrl(target.url)) {
      selected.push(selectedTarget(target, "search-list-tab"));
      continue;
    }

    if (canonicalJobUrl(target.url || "")) {
      if (includeRecommendations) {
        selected.push(selectedTarget(target, "detail-recommendations"));
      } else {
        skipped.push(skippedTarget(target, "detail-recommendations-disabled"));
      }
      continue;
    }

    skipped.push(skippedTarget(target, "non-search-tab"));
  }

  return { selected, skipped };
}
