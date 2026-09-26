/**
 * PrisNames — Registrar Account Capability
 */

import type { AccountInfo } from '../../models/account.js';

export interface RegistrarAccountCapability {
  /** Get account information (balance, settings, etc.). */
  getAccountInfo(): Promise<AccountInfo>;
}
