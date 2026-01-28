import { AbstractProviderFactory } from "./abstract_provider_factory.ts";
import { IModelProvider, ResolvedProviderOptions } from "../types.ts";
import { MockLLMProvider } from "../providers/mock_llm_provider.ts";
import * as DEFAULTS from "../../config/constants.ts";

export class MockProviderFactory extends AbstractProviderFactory {
  async create(options: ResolvedProviderOptions): Promise<IModelProvider> {
    const strategy = options.mockStrategy ?? DEFAULTS.DEFAULT_MOCK_STRATEGY;

    return await new MockLLMProvider(strategy, {
      id: options.id ?? `mock-${strategy}-${options.model}`,
      fixtureDir: options.mockFixturesDir,
      responses: options.responses,
    });
  }
}
