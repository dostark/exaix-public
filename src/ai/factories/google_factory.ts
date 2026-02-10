import { AbstractKeyBasedProviderFactory } from "./abstract_provider_factory.ts";
import { IModelProvider, ResolvedProviderOptions } from "../types.ts";
import { GoogleProvider } from "../providers/google_provider.ts";

export class GoogleProviderFactory extends AbstractKeyBasedProviderFactory {
  constructor() {
    super("GOOGLE_API_KEY");
  }

  async create(options: ResolvedProviderOptions): Promise<IModelProvider> {
    const apiKey = await this.getApiKey(options);

    return new GoogleProvider({
      apiKey,
      model: options.model,
      id: this.generateId("google", options.model, options.id),
      logger: options.logger,
    });
  }
}
