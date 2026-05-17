import fs from "node:fs";
import path from "node:path";

export type OpenLedgerEvent = {
  schema_version: "OpenLedgerEvent.v1";
  created_at: string;
  action: "opened" | "skipped" | "failed" | "contact_verified" | "access_limited";
  identity_keys: string[];
  record: Record<string, unknown>;
  source_artifact: string;
};

export function appendOpenLedgerEvent(file: string, event: OpenLedgerEvent): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(event)}\n`, "utf8");
}

export function loadOpenLedger(file: string): { events: OpenLedgerEvent[]; keys: Set<string> } {
  const events: OpenLedgerEvent[] = [];
  const keys = new Set<string>();
  if (!fs.existsSync(file)) return { events, keys };
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const event = JSON.parse(line) as OpenLedgerEvent;
    events.push(event);
    for (const key of event.identity_keys || []) keys.add(key);
  }
  return { events, keys };
}
