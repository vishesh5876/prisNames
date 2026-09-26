/**
 * PrisNames — registrar-core
 *
 * Provider-neutral registrar abstraction layer.
 * All provider-specific packages depend on this; business code imports only this.
 */

// ── Interfaces ──
export type {
  RegistrarProvider,
  RegistrarCapabilityMap,
} from './interfaces/registrar-provider.interface.js';

export {
  RegistrarCapability,
  CapabilityStatus,
  VerificationLevel,
} from './interfaces/capability.js';

export type { CapabilityInfo } from './interfaces/capability.js';

export type {
  DomainSearchCapability,
  DomainRegistrationCapability,
  DomainRenewalCapability,
  DomainRestoreCapability,
  DomainTransferInCapability,
  DomainTransferAwayCapability,
  DomainInfoCapability,
  DomainNameserverConfigCapability,
  GlueRecordManagementCapability,
  DomainDnsCapability,
  DomainDnssecCapability,
  DomainContactCapability,
  DomainPrivacyCapability,
  DomainLockCapability,
  DomainPricingCapability,
  DomainRenewOptionCapability,
  DomainGraceDeleteCapability,
  DomainForwardingCapability,
  DomainForwardingParams,
  StealthForwardingParams,
  EmailForwardingParams,
  RegistrarAccountCapability,
  RegistrarOrdersCapability,
} from './interfaces/capabilities/index.js';

// ── Models ──
export {
  ProviderOperationStatus,
  PROVIDER_TO_REGISTRAR_STATUS_MAP,
} from './models/operation-result.js';

export type {
  ProviderOperationResult,
  OperationContext,
} from './models/operation-result.js';

export type { MoneyAmount } from './models/money.js';
export {
  parseMoneyFromDecimal,
  formatMoneyToDecimal,
  UnsupportedCurrencyError,
  MoneyParseError,
} from './models/money.js';

export { CURRENCY_METADATA, getCurrencyExponent } from './models/currencies.js';
export type { CurrencyMetadata } from './models/currencies.js';

export type { DomainInfo, DomainSummary, NameserverConfig, RegisteredNameserver } from './models/domain.js';
export type {
  DomainAvailability,
  DomainAvailabilityPrice,
  DomainSuggestion,
} from './models/search.js';
export type {
  RegisterDomainParams,
  RenewDomainParams,
  RestoreDomainParams,
  GraceDeleteParams,
  PostGraceDeleteParams,
} from './models/registration.js';
export type {
  TransferInParams,
  CancelTransferParams,
  SetAuthCodeParams,
  TransferStatusResult,
  TransferStatusEntry,
  AuthCodeResult,
  AuthorizeTransferAwayParams,
} from './models/transfer.js';
export type {
  Contact,
  CreateContactParams,
  UpdateContactParams,
  DomainContactIds,
} from './models/contact.js';
export type {
  DnsRecord,
  SetDnsParams,
  RemoveDnsParams,
  DnssecInfo,
  DnssecRecord,
  DnssecParams,
} from './models/dns.js';
export type { TldPrice, TldPriceParams } from './models/pricing.js';
export type { AccountInfo, ProviderHealthStatus } from './models/account.js';
export type { OrderStatusResult, OrderItemInfo, OrderInfo, OrderHistoryParams } from './models/order.js';
export type { PaginatedResult, ForwardingParams } from './models/common.js';
export type { PrivacyLevel, RenewOption } from './models/common.js';

export type {
  ProviderWebhookEvent,
  ProviderOrderCompletedEvent,
  ProviderDomainStatusChangedEvent,
  ProviderDomainExpiringEvent,
} from './models/webhook-event.js';

// ── Errors ──
export { ProviderErrorCode, ProviderError, CapabilityUnsupportedError } from './errors/provider-error.js';

// ── Services ──
export { RegistrarResolver } from './services/registrar-resolver.js';
export { CircuitBreaker, CircuitState } from './services/circuit-breaker.js';
export type { CircuitBreakerConfig } from './services/circuit-breaker.js';
export { ProviderHealthTracker } from './services/provider-health.js';
