export type SiteId = "boss" | "liepin" | "51job";

export interface CanonicalJobUrl {
  site: SiteId;
  id: string;
  url: string;
  semanticKey: string;
}

export interface SearchInput {
  query: string;
  city?: string;
}

export interface AuthProbeSpec {
  url: string;
  expression: string;
}

export interface ContactActionSpec {
  triggerExpression: string;
  verificationExpression: string;
  labels: string[];
}

export interface SiteAdapter {
  id: SiteId;
  hosts: RegExp[];
  canonicalize(url: string): CanonicalJobUrl | null;
  searchUrl(input: SearchInput): string;
  authProbe(): AuthProbeSpec;
  collectExpression(): string;
  detailExpression(): string;
  accessLimitExpression(): string;
  contactActionSpec(): ContactActionSpec | null;
}
