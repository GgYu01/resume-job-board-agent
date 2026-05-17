export type SiteId = "boss" | "liepin" | "51job";

export interface CdpEndpoint {
  port: number;
  browser: string;
  webSocketDebuggerUrl?: string;
}

export interface PageTarget {
  id: string;
  url: string;
  title: string;
  type: string;
}

export interface BrowserDoctorResult {
  available: boolean;
  endpoint?: CdpEndpoint;
  problem?: string;
}

export interface OpenRecord {
  id?: string;
  site?: SiteId;
  title?: string;
  company?: string;
  location?: string;
  url: string;
}

export interface OpenOptions {
  maxPerBatch: number;
  delayMs: number;
  triggerContact: boolean;
}

export interface OpenResult {
  opened: OpenRecord[];
  skipped: OpenRecord[];
  accessLimited: boolean;
}

export interface CloseResult {
  closed: string[];
  failed: string[];
}

export interface BrowserSession {
  readonly kind: "edge-beta-cdp";
  doctor(): Promise<BrowserDoctorResult>;
  ensureAvailable(options: { port?: number; start?: boolean }): Promise<CdpEndpoint>;
  listJobBoardTargets(site: SiteId | "both"): Promise<PageTarget[]>;
  openBackgroundTabs(records: OpenRecord[], options: OpenOptions): Promise<OpenResult>;
  evaluateTarget<T>(target: PageTarget, expression: string): Promise<T>;
  closeTargets(targetIds: string[]): Promise<CloseResult>;
}
