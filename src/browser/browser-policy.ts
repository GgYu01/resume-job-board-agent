export interface BrowserPolicy {
  requiredFamily: "edge-beta";
  allowFallbackFamily: boolean;
  requiredControlPlane: "cdp";
  allowManagedBrowser: boolean;
}

export function createStrictBrowserPolicy(): BrowserPolicy {
  return {
    requiredFamily: "edge-beta",
    allowFallbackFamily: false,
    requiredControlPlane: "cdp",
    allowManagedBrowser: false,
  };
}
