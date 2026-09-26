/**
 * PrisNames — Domain Lock Capability
 *
 * Manages domain transfer lock (registrar lock / clientTransferProhibited).
 * Used by transfer-away orchestration to unlock before transfer.
 */

export interface DomainLockCapability {
  /** Set or clear the domain transfer lock. */
  setDomainLock(domain: string, locked: boolean): Promise<void>;
}
