/**
 * PrisNames — Dynadot Contact Facet
 */

import type { DomainContactCapability } from '@prisnames/registrar-core';
import type { Contact, CreateContactParams, UpdateContactParams, DomainContactIds } from '@prisnames/registrar-core';
import type { PaginatedResult } from '@prisnames/registrar-core';
import type { DynadotHttpClient } from '../http-client.js';
import { ENDPOINTS } from '../endpoints.js';

export class DynadotContactFacet implements DomainContactCapability {
  constructor(private readonly client: DynadotHttpClient) {}

  async getContact(contactId: string): Promise<Contact> {
    const response = await this.client.request<{
      contact?: Record<string, unknown>;
    }>(ENDPOINTS.CONTACT_GET, {
      path: `contacts/${contactId}`,
    });
    return this.mapContact(response.data.contact ?? {}, contactId);
  }

  async listContacts(page = 1, pageSize = 25): Promise<PaginatedResult<Contact>> {
    const response = await this.client.request<{
      contact_list?: Array<Record<string, unknown>>;
      pagination_result?: { total_count?: number; current_page?: number; page_size?: number };
    }>(ENDPOINTS.CONTACT_LIST, {
      path: 'contacts',
      params: { page: String(page), page_size: String(pageSize) },
    });

    const list = response.data.contact_list ?? [];
    const pagination = response.data.pagination_result ?? {};

    return {
      items: list.map(c => this.mapContact(c, String(c.contact_id ?? ''))),
      total: Number(pagination.total_count ?? 0),
      page: Number(pagination.current_page ?? page),
      pageSize: Number(pagination.page_size ?? pageSize),
      hasMore: list.length >= pageSize,
    };
  }

  async createContact(params: CreateContactParams): Promise<{ contactId: string }> {
    const response = await this.client.request<{
      contact_id?: number;
    }>(ENDPOINTS.CONTACT_CREATE, {
      path: 'contacts',
      body: this.toProviderContact(params),
    });

    return { contactId: String(response.data.contact_id ?? '') };
  }

  async updateContact(contactId: string, params: UpdateContactParams): Promise<void> {
    await this.client.request(ENDPOINTS.CONTACT_UPDATE, {
      path: `contacts/${contactId}`,
      body: this.toProviderContact(params),
    });
  }

  async deleteContact(contactId: string): Promise<void> {
    await this.client.request(ENDPOINTS.CONTACT_DELETE, {
      path: `contacts/${contactId}`,
    });
  }

  async setDomainContacts(domain: string, contacts: DomainContactIds): Promise<void> {
    const body: Record<string, unknown> = {};
    if (contacts.registrant) body.registrant_contact_id = Number(contacts.registrant);
    if (contacts.admin) body.admin_contact_id = Number(contacts.admin);
    if (contacts.tech) body.technical_contact_id = Number(contacts.tech);
    if (contacts.billing) body.billing_contact_id = Number(contacts.billing);

    await this.client.request(ENDPOINTS.DOMAIN_SET_CONTACTS, {
      path: `domains/${encodeURIComponent(domain)}/contacts`,
      body,
    });
  }

  private mapContact(raw: Record<string, unknown>, contactId: string): Contact {
    return {
      contactId: String(raw.contact_id ?? contactId),
      organization: raw.organization as string | undefined,
      name: raw.name as string | undefined,
      email: raw.email as string | undefined,
      // Dynadot REST v2 uses phone_cc/fax_cc (not phone_country_code)
      phoneCountryCode: (raw.phone_cc ?? raw.phone_country_code) as string | undefined,
      phoneNumber: raw.phone_number as string | undefined,
      faxCountryCode: (raw.fax_cc ?? raw.fax_country_code) as string | undefined,
      faxNumber: raw.fax_number as string | undefined,
      address1: raw.address1 as string | undefined,
      address2: raw.address2 as string | undefined,
      city: raw.city as string | undefined,
      state: raw.state as string | undefined,
      // Dynadot REST v2 uses zip (not zip_code)
      zipCode: (raw.zip ?? raw.zip_code) as string | undefined,
      country: raw.country as string | undefined,
    };
  }

  private toProviderContact(params: Partial<CreateContactParams>): Record<string, unknown> {
    const contact: Record<string, unknown> = {};
    if (params.organization !== undefined) contact.organization = params.organization;
    if (params.name !== undefined) contact.name = params.name;
    if (params.email !== undefined) contact.email = params.email;
    // Dynadot REST v2 field names: phone_cc, fax_cc, zip
    if (params.phoneCountryCode !== undefined) contact.phone_cc = params.phoneCountryCode;
    if (params.phoneNumber !== undefined) contact.phone_number = params.phoneNumber;
    if (params.faxCountryCode !== undefined) contact.fax_cc = params.faxCountryCode;
    if (params.faxNumber !== undefined) contact.fax_number = params.faxNumber;
    if (params.address1 !== undefined) contact.address1 = params.address1;
    if (params.address2 !== undefined) contact.address2 = params.address2;
    if (params.city !== undefined) contact.city = params.city;
    if (params.state !== undefined) contact.state = params.state;
    if (params.zipCode !== undefined) contact.zip = params.zipCode;
    if (params.country !== undefined) contact.country = params.country;
    return { contact };
  }
}
