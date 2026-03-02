/**
 * @module IFlowValidatorService
 * @path src/shared/interfaces/i_flow_validator_service.ts
 * @description Interface for flow validation services.
 * @architectural-layer Shared
 */

import type { IFlow } from "../schemas/flow.ts";

export interface IFlowValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface IFlowValidatorService {
  /**
   * Validate a flow object.
   */
  validate(flow: IFlow): Promise<IFlowValidationResult>;

  /**
   * Validate a flow from a file path.
   */
  validateFile(path: string): Promise<IFlowValidationResult>;
}
