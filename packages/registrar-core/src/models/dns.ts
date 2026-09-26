/**
 * PrisNames — DNS Models
 */

export interface DnsRecord {
  readonly type: string;
  readonly hostname: string;
  readonly value: string;
  readonly ttl?: number;
  readonly priority?: number;
  readonly distance?: number;
}

export interface SetDnsParams {
  readonly domain: string;
  readonly records: DnsRecord[];
  /** TTL for all records (provider-specific) */
  readonly ttl?: number;
  /** If true, add to current DNS settings instead of replacing */
  readonly addToCurrent?: boolean;
}

export interface RemoveDnsParams {
  readonly domain: string;
  readonly recordIds?: string[];
  /** Records to remove by match (alternative to recordIds) */
  readonly records?: ReadonlyArray<Pick<DnsRecord, 'type' | 'hostname' | 'value'>>;
}

export interface DnssecInfo {
  readonly enabled: boolean;
  readonly records: DnssecRecord[];
}

export interface DnssecRecord {
  readonly keyTag: number;
  readonly algorithm: number;
  readonly digestType: number;
  readonly digest: string;
}

export interface DnssecParams {
  readonly domain: string;
  readonly records: DnssecRecord[];
}
