/**
 * @module IContextCardGeneratorService
 * @path src/shared/interfaces/i_context_card_generator_service.ts
 * @description Interface for context card generation services.
 * @architectural-layer Shared
 */

export interface IContextCardOptions {
  includeEnvironment?: boolean;
  includeArchitecture?: boolean;
  includeRecentActivity?: boolean;
  maxEntries?: number;
}

export interface IPortalInfo {
  alias: string;
  path: string;
  techStack: string[];
}

export interface IContextCardGeneratorService {
  /**
   * Generate a context card for a portal.
   */
  generate(portal: IPortalInfo): Promise<void>;
}
