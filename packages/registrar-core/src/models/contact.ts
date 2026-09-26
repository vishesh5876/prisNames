/**
 * PrisNames — Contact Models
 *
 * Contact object fields based on documented endpoints only.
 * Unexpanded {14 items} shape marked PARTIAL until sandbox discovery.
 */

export interface Contact {
  readonly contactId: string;
  readonly organization?: string;
  readonly name?: string;
  readonly email?: string;
  readonly phoneCountryCode?: string;
  readonly phoneNumber?: string;
  readonly faxCountryCode?: string;
  readonly faxNumber?: string;
  readonly address1?: string;
  readonly address2?: string;
  readonly city?: string;
  readonly state?: string;
  readonly zipCode?: string;
  readonly country?: string;
}

export interface CreateContactParams {
  readonly organization?: string;
  readonly name: string;
  readonly email: string;
  readonly phoneCountryCode: string;
  readonly phoneNumber: string;
  readonly faxCountryCode?: string;
  readonly faxNumber?: string;
  readonly address1: string;
  readonly address2?: string;
  readonly city: string;
  readonly state: string;
  readonly zipCode: string;
  readonly country: string;
}

export interface UpdateContactParams {
  readonly organization?: string;
  readonly name?: string;
  readonly email?: string;
  readonly phoneCountryCode?: string;
  readonly phoneNumber?: string;
  readonly faxCountryCode?: string;
  readonly faxNumber?: string;
  readonly address1?: string;
  readonly address2?: string;
  readonly city?: string;
  readonly state?: string;
  readonly zipCode?: string;
  readonly country?: string;
}

export interface DomainContactIds {
  readonly registrant?: string;
  readonly admin?: string;
  readonly tech?: string;
  readonly billing?: string;
}
