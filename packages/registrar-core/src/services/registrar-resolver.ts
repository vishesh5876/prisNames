/**
 * PrisNames — RegistrarResolver
 *
 * Resolves provider instances by ID. V1 supports only Dynadot.
 * No silent fallback — unknown/disabled provider IDs fail explicitly.
 *
 * Future TLD/provider routing policy introduced separately.
 */

import type { RegistrarProvider } from '../interfaces/registrar-provider.interface.js';

export class RegistrarResolver {
  private readonly providers = new Map<string, RegistrarProvider>();
  private defaultProviderId: string | null = null;

  /**
   * Register a provider with the resolver.
   * The first registered provider becomes the default unless explicitly set.
   */
  registerProvider(provider: RegistrarProvider, isDefault = false): void {
    this.providers.set(provider.providerId, provider);
    if (isDefault || this.defaultProviderId === null) {
      this.defaultProviderId = provider.providerId;
    }
  }

  /**
   * Get a provider by its ID.
   * @throws Error if provider is unknown or not registered.
   */
  getProvider(providerId: string): RegistrarProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(
        `Registrar provider '${providerId}' is not registered. ` +
        `Available providers: [${[...this.providers.keys()].join(', ')}]`,
      );
    }
    return provider;
  }

  /**
   * Get the default provider (V1: always Dynadot).
   * @throws Error if no provider is registered.
   */
  getDefaultProvider(): RegistrarProvider {
    if (!this.defaultProviderId) {
      throw new Error('No registrar provider is registered');
    }
    return this.getProvider(this.defaultProviderId);
  }

  /** List all registered provider IDs. */
  listActiveProviders(): string[] {
    return [...this.providers.keys()];
  }
}
