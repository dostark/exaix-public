import type { IModelProvider } from "../../src/ai/providers.ts";

/**
 * Creates a mock LLM provider that returns predefined responses.
 * Used across multiple test files to avoid duplication.
 */
export function createMockProvider(responses: string[]): IModelProvider {
  let callCount = 0;
  return {
    id: "mock-provider",
    generate: (_prompt: string): Promise<string> => {
      const response = responses[Math.min(callCount, responses.length - 1)];
      callCount++;
      return Promise.resolve(response);
    },
  };
}
