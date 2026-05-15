import { bossAdapter } from "./boss.mjs";
import { job51Adapter } from "./job51.mjs";
import { liepinAdapter } from "./liepin.mjs";

const ADAPTERS = [bossAdapter, liepinAdapter, job51Adapter];

export function listSiteAdapters() {
  return ADAPTERS.slice();
}

export function getSiteAdapter(idOrUrl) {
  const text = String(idOrUrl || "");
  const byId = ADAPTERS.find((adapter) => adapter.id === text);
  if (byId) return byId;
  return ADAPTERS.find((adapter) => adapter.hostPatterns.some((pattern) => pattern.test(text))) || null;
}
