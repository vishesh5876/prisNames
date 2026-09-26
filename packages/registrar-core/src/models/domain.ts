/**
 * PrisNames — Domain Models
 *
 * Provider-agnostic normalized domain representations.
 * Fields based only on verified documentation.
 */

export interface DomainInfo {
  readonly domainName: string;
  readonly status: string;
  readonly expirationDate?: Date;
  readonly registrationDate?: Date;
  readonly autoRenew?: boolean;
  readonly locked?: boolean;
  readonly privacy?: string;
  readonly nameservers?: string[];
  readonly contactIds?: {
    readonly registrant?: string;
    readonly admin?: string;
    readonly tech?: string;
    readonly billing?: string;
  };
  /** Provider-specific additional fields — sanitized, no PII */
  readonly providerMetadata?: Record<string, unknown>;
}

export interface DomainSummary {
  readonly domainName: string;
  readonly status: string;
  readonly expirationDate?: Date;
}

export interface NameserverConfig {
  readonly nameservers: string[];
}

export interface RegisteredNameserver {
  readonly hostname: string;
  readonly ips: string[];
}
