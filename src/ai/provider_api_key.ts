// Utility to get API key from env and optionally persist to SecureCredentialStore
/**
 * @module ProviderApiKey
 * @path src/ai/provider_api_key.ts
 * @description utility for retrieving AI provider API keys from environment variables with optional persistence to secure storage.
 * @architectural-layer AI
 * @dependencies [credential_security]
 * @related-files [src/ai/factories/abstract_provider_factory.ts]
 */
import { SecureCredentialStore } from "../helpers/credential_security.ts";

/**
 * Get API key from environment variable, optionally persist to SecureCredentialStore if opted in.
 * @param envKey The environment variable name (e.g., "OPENAI_API_KEY")
 * @returns The API key string, or null if not found
 */
export async function getApiKeyWithOptionalPersistence(envKey: string): Promise<string | null> {
  const envValue = Deno.env.get(envKey);
  if (envValue) {
    // Only persist if EXO_PERSIST_ENV_CREDENTIALS is true
    if ((globalThis as any).EXO_PERSIST_ENV_CREDENTIALS) {
      // Only persist if not already present in store
      const stored = await SecureCredentialStore.get(envKey);
      if (!stored) {
        await SecureCredentialStore.set(envKey, envValue);
      }
    }
    return envValue;
  }
  // Fallback to store
  return await SecureCredentialStore.get(envKey);
}
