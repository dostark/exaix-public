import { ServiceContext } from "../common/types.ts";

/**
 * Middleware function type
 */
export type Middleware<T extends ServiceContext> = (
  context: T,
  next: () => Promise<void>,
) => Promise<void>;

/**
 * Middleware pipeline for executing a chain of middleware functions
 */
export class MiddlewarePipeline<T extends ServiceContext> {
  private middlewares: Middleware<T>[] = [];

  /**
   * Add middleware to the pipeline
   */
  use(middleware: Middleware<T>): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Execute the middleware pipeline
   */
  async execute(context: T, handler: () => Promise<void>): Promise<void> {
    const dispatch = async (index: number): Promise<void> => {
      if (index === this.middlewares.length) {
        return await handler();
      }

      const middleware = this.middlewares[index];
      await middleware(context, () => dispatch(index + 1));
    };

    await dispatch(0);
  }
}
