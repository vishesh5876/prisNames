/**
 * PrisNames — Domain Forwarding Capability
 *
 * Three separate forwarding operations per correction #7:
 * - Domain (URL) forwarding
 * - Stealth (masked) forwarding
 * - Email forwarding
 *
 * Their semantics differ substantially — they are not collapsed into one untyped object.
 */

export interface DomainForwardingParams {
  readonly url: string;
  readonly type: 'permanent' | 'temporary';
  readonly subdomainForwarding?: boolean;
}

export interface StealthForwardingParams {
  readonly url: string;
  readonly title?: string;
}

export interface EmailForwardingParams {
  readonly forwardTo: string;
}

export interface DomainForwardingCapability {
  /** Set domain URL forwarding (301/302 redirect). */
  setDomainForwarding(domain: string, params: DomainForwardingParams): Promise<void>;

  /** Set stealth/masked forwarding (iframe/proxy). */
  setStealthForwarding(domain: string, params: StealthForwardingParams): Promise<void>;

  /** Set email forwarding. */
  setEmailForwarding(domain: string, params: EmailForwardingParams): Promise<void>;

  /** Remove all forwarding. */
  removeForwarding(domain: string): Promise<void>;
}
