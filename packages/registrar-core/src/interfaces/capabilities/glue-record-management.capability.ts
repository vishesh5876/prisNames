/**
 * PrisNames — Glue Record / Child Nameserver Management Capability
 *
 * Managing nameserver objects (creating/updating/deleting registered nameservers
 * with glue records). Separate from domain-level NS assignment.
 *
 * Operations:
 * - getRegisteredNameserver: Retrieve details for a specific registered NS
 * - listRegisteredNameservers: List all registered NS in the account
 * - registerNameserver: Create a new NS with glue records (IP addresses)
 * - addExternalNameserver: Add an external/third-party NS (no glue IPs)
 * - updateNameserverIp: Update IP addresses for a registered NS
 * - deleteNameserver: Remove a registered NS
 */

import type { RegisteredNameserver } from '../../models/domain.js';

export interface GlueRecordManagementCapability {
  /** Get details for a specific registered nameserver. */
  getRegisteredNameserver(nameserver: string): Promise<RegisteredNameserver>;

  /** List all registered nameservers in the account. */
  listRegisteredNameservers(): Promise<RegisteredNameserver[]>;

  /** Register a new nameserver (create glue record with IP addresses). */
  registerNameserver(nameserver: string, ips: string[]): Promise<void>;

  /** Add an external/third-party nameserver (no glue IPs required). */
  addExternalNameserver(nameserver: string): Promise<void>;

  /** Update the IP addresses of a registered nameserver. */
  updateNameserverIp(nameserver: string, ips: string[]): Promise<void>;

  /** Delete a registered nameserver. */
  deleteNameserver(nameserver: string): Promise<void>;
}
