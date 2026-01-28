import { EventLogger } from "../event_logger.ts";

/**
 * Decorator to log method execution
 * Supports both standard (Stage 3) and experimental decorators
 * @param logger EventLogger instance
 * @param action Action name (optional, defaults to class.method)
 */
export function LogMethod(logger: EventLogger, action?: string): any {
  return function (target: any, contextOrKey: any, descriptor?: PropertyDescriptor) {
    // Check for Standard Decorator (2 arguments: value, context)
    // context object has 'kind', 'name', etc.
    if (descriptor === undefined && contextOrKey && typeof contextOrKey === "object" && "kind" in contextOrKey) {
      const originalMethod = target;
      const context = contextOrKey as ClassMethodDecoratorContext;
      const methodName = String(context.name);

      // Return the replacement method
      return async function (this: any, ...args: any[]) {
        const actionName = action || `${this.constructor.name}.${methodName}`;
        const startTime = Date.now();
        try {
          await logger.debug(actionName, "started", { args });
          const result = await originalMethod.apply(this, args);
          const duration = Date.now() - startTime;
          await logger.info(actionName, "completed", { duration });
          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          const errorMsg = error instanceof Error ? error.message : String(error);
          await logger.error(actionName, "failed", { error: errorMsg, duration });
          throw error;
        }
      };
    }

    // Fallback to Experimental Decorator (3 arguments: target, propertyKey, descriptor)
    const originalMethod = descriptor!.value;
    const propertyKey = contextOrKey as string;

    descriptor!.value = async function (this: any, ...args: any[]) {
      const actionName = action || `${this.constructor.name}.${propertyKey}`;
      const startTime = Date.now();
      try {
        await logger.debug(actionName, "started", { args });
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;
        await logger.info(actionName, "completed", { duration });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMsg = error instanceof Error ? error.message : String(error);
        await logger.error(actionName, "failed", { error: errorMsg, duration });
        throw error;
      }
    };
    return descriptor;
  };
}
