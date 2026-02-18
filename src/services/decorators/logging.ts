/**
 * @module LoggingDecorator
 * @path src/services/decorators/logging.ts
 * @description Method decorator for automated execution logging.
 * @architectural-layer Services
 * @dependencies [EventLogger]
 * @related-files [src/services/event_logger.ts]
 */
import { EventLogger } from "../event_logger.ts";
import { toSafeJson } from "../../flows/transforms.ts";
export function LogMethod(logger: EventLogger, action?: string) {
  return function <This, Args extends unknown[], Return>(
    target: (this: This, ...args: Args) => Return,
    contextOrKey: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return> | string,
    descriptor?: TypedPropertyDescriptor<(this: This, ...args: Args) => Return>,
  ): TypedPropertyDescriptor<(this: This, ...args: Args) => Return> | ((this: This, ...args: Args) => Return) | void {
    const createWrapper = (
      originalMethod: (this: This, ...args: Args) => Return,
      methodName: string,
    ) => {
      return async function (this: This, ...args: Args): Promise<Awaited<Return>> {
        const constructor = (this as { constructor?: { name?: string } }).constructor;
        const className = constructor?.name || "Unknown";
        const actionName = action || `${className}.${methodName}`;
        const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();
        try {
          // Log cached arguments
          await logger.debug(actionName, "started", { args: toSafeJson(args) });
          // Note: we must await originalMethod regardless of whether it's sync or async
          // deno-lint-ignore no-explicit-any
          const result = await (originalMethod.apply(this, args) as any);
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

    // Standard Decorator
    if (descriptor === undefined && typeof contextOrKey === "object" && "kind" in contextOrKey) {
      const originalMethod = target;
      const methodName = String(contextOrKey.name);
      return createWrapper(originalMethod, methodName);
    }

    // Experimental Decorator
    const originalMethod = descriptor!.value!;
    const propertyKey = contextOrKey as string;

    // deno-lint-ignore no-explicit-any
    descriptor!.value = createWrapper(originalMethod, propertyKey) as any;
    return descriptor;
  };
}
