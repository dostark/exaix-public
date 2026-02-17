/**
 * @module LazyProvider
 * @path src/ai/providers/lazy_provider.ts
 * @description Defers provider initialization until first use to optimize startup time and avoid unnecessary early API/auth checks.
 * @architectural-layer AI
 * @dependencies [types, abstract_provider_factory]
 * @related-files [src/ai/provider_registry.ts]
 */
import { IModelProvider, ModelOptions, ResolvedProviderOptions } from "../types.ts";
import { IProviderFactory } from "../factories/abstract_provider_factory.ts";

export class LazyProvider implements IModelProvider {
  private instance: IModelProvider | null = null;
  public readonly id: string;

  constructor(
    private factory: IProviderFactory,
    private options: ResolvedProviderOptions,
    id?: string,
  ) {
    this.id = id ?? options.id ?? `${options.provider}-${options.model}`;
  }

  /**
   * Initialize on first use
   */
  private async getInstance(): Promise<IModelProvider> {
    if (!this.instance) {
      this.instance = await this.factory.create(this.options);
    }
    return this.instance;
  }

  /**
   * Delegate generate call to the lazily created instance
   */
  async generate(prompt: string, options?: ModelOptions): Promise<string> {
    const provider = await this.getInstance();
    return provider.generate(prompt, options);
  }
}
