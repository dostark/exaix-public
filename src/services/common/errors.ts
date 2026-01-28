/**
 * Base class for all service-related errors
 */
export class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceError";
  }
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends ServiceError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Error thrown when authorization fails
 */
export class AuthorizationError extends ServiceError {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Error thrown when a requested resource is not found
 */
export class NotFoundError extends ServiceError {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
