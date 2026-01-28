import { IModelProvider, ModelOptions, ResolvedProviderOptions } from "../types.ts";
import { IProviderFactory } from "../factories/abstract_provider_factory.ts";

/**
 * LazyProvider - Defers provider initialization until first use.
 * significantly reduces application startup time by avoiding early
 * connection checks and API key validation.
 */
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
