import type {
  BrowserDoctorResult,
  BrowserSession,
  CdpEndpoint,
  CloseResult,
  OpenOptions,
  OpenRecord,
  OpenResult,
  PageTarget,
  SiteId,
} from "./browser-port.js";
import { fetchCdpJson } from "./cdp-session.js";

export class EdgeBetaCdpBrowser implements BrowserSession {
  readonly kind = "edge-beta-cdp" as const;

  constructor(private readonly defaultPort = 9222) {}

  async doctor(): Promise<BrowserDoctorResult> {
    try {
      const endpoint = await this.ensureAvailable({ port: this.defaultPort, start: false });
      return { available: true, endpoint };
    } catch (error) {
      return { available: false, problem: error instanceof Error ? error.message : String(error) };
    }
  }

  async ensureAvailable(options: { port?: number; start?: boolean }): Promise<CdpEndpoint> {
    const port = options.port ?? this.defaultPort;
    const version = await fetchCdpJson<{ Browser: string; webSocketDebuggerUrl?: string }>(
      `http://127.0.0.1:${port}/json/version`,
    );
    return { port, browser: version.Browser, webSocketDebuggerUrl: version.webSocketDebuggerUrl };
  }

  async listJobBoardTargets(site: SiteId | "both"): Promise<PageTarget[]> {
    const targets = await fetchCdpJson<PageTarget[]>(`http://127.0.0.1:${this.defaultPort}/json/list`);
    return targets.filter((target) => {
      if (site === "both") return /zhipin\.com|liepin\.com|51job\.com/i.test(target.url);
      if (site === "boss") return /zhipin\.com/i.test(target.url);
      if (site === "liepin") return /liepin\.com/i.test(target.url);
      return /51job\.com/i.test(target.url);
    });
  }

  async openBackgroundTabs(_records: OpenRecord[], _options: OpenOptions): Promise<OpenResult> {
    throw new Error("openBackgroundTabs is not migrated to the typed browser adapter yet");
  }

  async evaluateTarget<T>(_target: PageTarget, _expression: string): Promise<T> {
    throw new Error("evaluateTarget is not migrated to the typed browser adapter yet");
  }

  async closeTargets(_targetIds: string[]): Promise<CloseResult> {
    throw new Error("closeTargets is not migrated to the typed browser adapter yet");
  }
}
