import { AbstractProviderFactory } from "./abstract_provider_factory.ts";
import { IModelProvider, ResolvedProviderOptions } from "../types.ts";
import { LlamaProvider } from "../providers/llama_provider.ts";

export class LlamaProviderFactory extends AbstractProviderFactory {
  async create(options: ResolvedProviderOptions): Promise<IModelProvider> {
    return await new LlamaProvider({
      model: options.model,
      endpoint: options.baseUrl,
    });
  }
}
