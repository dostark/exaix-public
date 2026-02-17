/**
 * @module LoggingDecorator
 * @path src/services/decorators/logging.ts
 * @description Method decorator for automated execution logging.
 * @architectural-layer Services
 * @dependencies [EventLogger]
 * @related-files [src/services/event_logger.ts]
 */
import { EventLogger } from "../event_logger.ts";
export function LogMethod(logger: EventLogger, action?: string): any {
  return function (target: any, contextOrKey: any, descriptor?: PropertyDescriptor) {
    const createWrapper = (originalMethod: (...args: any[]) => any, methodName: string) => {
      return async function (this: any, ...args: any[]) {
        const actionName = action || `${this.constructor.name}.${methodName}`;
        const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();
        try {
          await logger.debug(actionName, "started", { args });
          const result = await originalMethod.apply(this, args);
          const duration = (typeof performance !== "undefined" ? performance.now() : Date.now()) - startTime;
          await logger.info(actionName, "completed", { duration });
          return result;
        } catch (error) {
          const duration = (typeof performance !== "undefined" ? performance.now() : Date.now()) - startTime;
          const errorMsg = error instanceof Error ? error.message : String(error);
          await logger.error(actionName, "failed", { error: errorMsg, duration });
          throw error;
        }
      };
    };

    // Check for Standard Decorator (2 arguments: value, context)
    // context object has 'kind', 'name', etc.
    if (descriptor === undefined && contextOrKey && typeof contextOrKey === "object" && "kind" in contextOrKey) {
      const originalMethod = target;
      const context = contextOrKey as ClassMethodDecoratorContext;
      const methodName = String(context.name);
      return createWrapper(originalMethod, methodName);
    }

    // Fallback to Experimental Decorator (3 arguments: target, propertyKey, descriptor)
    const originalMethod = descriptor!.value;
    const propertyKey = contextOrKey as string;

    descriptor!.value = createWrapper(originalMethod, propertyKey);
    return descriptor;
  };
}
