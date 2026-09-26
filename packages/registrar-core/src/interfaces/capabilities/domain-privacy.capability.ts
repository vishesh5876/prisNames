/**
 * PrisNames — Domain Privacy Capability
 */

import type { PrivacyLevel } from '../../models/common.js';

export interface DomainPrivacyCapability {
  /** Set WHOIS privacy protection level for a domain. */
  setPrivacy(domain: string, level: PrivacyLevel): Promise<void>;
}
