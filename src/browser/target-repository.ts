import type { PageTarget, SiteId } from "./browser-port.js";

export function filterJobBoardTargets(targets: PageTarget[], site: SiteId | "both"): PageTarget[] {
  return targets.filter((target) => {
    if (site === "both") return /zhipin\.com|liepin\.com|51job\.com/i.test(target.url);
    if (site === "boss") return /zhipin\.com/i.test(target.url);
    if (site === "liepin") return /liepin\.com/i.test(target.url);
    return /51job\.com/i.test(target.url);
  });
}
