import { AbstractKeyBasedProviderFactory } from "./abstract_provider_factory.ts";
import { IModelProvider, ResolvedProviderOptions } from "../types.ts";
import { AnthropicProvider } from "../providers/anthropic_provider.ts";

export class AnthropicProviderFactory extends AbstractKeyBasedProviderFactory {
  constructor() {
    super("ANTHROPIC_API_KEY");
  }

  async create(options: ResolvedProviderOptions): Promise<IModelProvider> {
    const apiKey = await this.getApiKey(options);

    return new AnthropicProvider({
      apiKey,
      model: options.model,
      id: this.generateId("anthropic", options.model, options.id),
      logger: options.logger,
    });
  }
}
