/**
 * PrisNames — Domain Contact Management Capability
 */

import type {
  Contact,
  CreateContactParams,
  UpdateContactParams,
  DomainContactIds,
} from '../../models/contact.js';
import type { PaginatedResult } from '../../models/common.js';

export interface DomainContactCapability {
  /** Get a specific contact by ID. */
  getContact(contactId: string): Promise<Contact>;

  /** List contacts in the account. */
  listContacts(page?: number, pageSize?: number): Promise<PaginatedResult<Contact>>;

  /** Create a new contact. */
  createContact(params: CreateContactParams): Promise<{ contactId: string }>;

  /** Update an existing contact. */
  updateContact(contactId: string, params: UpdateContactParams): Promise<void>;

  /** Delete a contact. */
  deleteContact(contactId: string): Promise<void>;

  /** Set contacts (registrant, admin, tech, billing) for a domain. */
  setDomainContacts(domain: string, contacts: DomainContactIds): Promise<void>;
}
