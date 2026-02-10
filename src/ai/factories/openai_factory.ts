import { AbstractKeyBasedProviderFactory } from "./abstract_provider_factory.ts";
import { IModelProvider, ResolvedProviderOptions } from "../types.ts";
import { OpenAIProvider } from "../providers/openai_provider.ts";

export class OpenAIProviderFactory extends AbstractKeyBasedProviderFactory {
  constructor() {
    super("OPENAI_API_KEY");
  }

  async create(options: ResolvedProviderOptions): Promise<IModelProvider> {
    const apiKey = await this.getApiKey(options);

    return new OpenAIProvider({
      apiKey,
      model: options.model,
      baseUrl: options.baseUrl,
      id: this.generateId("openai", options.model, options.id),
      logger: options.logger,
    });
  }
}
