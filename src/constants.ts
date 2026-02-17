/**
 * @module GlobalConstants
 * @path src/constants.ts
 * @description Global internal constants for the ExoFrame system, including HTTP codes and hash parameters.
 * @architectural-layer Core
 * @dependencies []
 * @related-files []
 */

// HTTP Status Codes
export const HTTP_UNAUTHORIZED = 401;
export const HTTP_FORBIDDEN = 403;
export const HTTP_TOO_MANY_REQUESTS = 429;
export const HTTP_SERVER_ERROR = 500;

// Hash constants
export const HASH_BUFFER_SIZE = 32;
export const FNV_OFFSET_BASIS = 2166136261; // Not used in code, but common
export const DJB2_INIT = 5381;

// Token estimation
export const TOKENS_PER_1K = 1000;
export const CHARS_PER_TOKEN_ESTIMATE = 4;
