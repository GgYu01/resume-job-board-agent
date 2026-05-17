import type { OpenOptions, OpenRecord, OpenResult } from "./browser-port.js";

export interface TabOpener {
  openBackgroundTabs(records: OpenRecord[], options: OpenOptions): Promise<OpenResult>;
}

export async function openTabsWithAdapter(
  opener: TabOpener,
  records: OpenRecord[],
  options: OpenOptions,
): Promise<OpenResult> {
  return opener.openBackgroundTabs(records, options);
}
