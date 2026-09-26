/**
 * PrisNames — Common Models
 */

export interface PaginatedResult<T> {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
}

export type PrivacyLevel = 'full' | 'partial' | 'none';

export type RenewOption = 'auto' | 'manual' | 'no_renew';

export interface ForwardingParams {
  readonly url: string;
  readonly type: 'permanent' | 'temporary' | 'masking';
  readonly subdomainForwarding?: boolean;
}
