/**
 * Error thrown by ProviderFactory
 */
export class ProviderFactoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderFactoryError";
  }
}
