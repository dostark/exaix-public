/**
 * Base Key Bindings Class
 *
 * Provides a base class for defining KEY_BINDINGS collections with strict typing.
 * All TUI components should inherit from this class to ensure consistent key binding structure.
 */

import type { KeyBinding, KeyHandler } from "../../helpers/keyboard.ts";

/**
 * Base class for key binding collections.
 * Provides strict typing and structure for KEY_BINDINGS arrays.
 */
export abstract class KeyBindingsBase<
  TAction extends string | KeyHandler = string | KeyHandler,
  TCategory extends string = string,
> {
  /**
   * The key bindings collection for this component.
   * Must be implemented by subclasses with specific action types.
   */
  abstract readonly KEY_BINDINGS: readonly KeyBinding<TAction>[];

  /**
   * Get all key bindings for this component.
   */
  getKeyBindings(): KeyBinding<string | KeyHandler>[] {
    return [...this.KEY_BINDINGS];
  }

  /**
   * Find a key binding by action.
   */
  findBindingByAction(action: TAction): KeyBinding<TAction> | undefined {
    return this.KEY_BINDINGS.find((binding) => binding.action === action);
  }

  /**
   * Find a key binding by key.
   */
  findBindingByKey(key: string): KeyBinding<TAction> | undefined {
    return this.KEY_BINDINGS.find((binding) => binding.key === key);
  }

  /**
   * Get all actions available in this key binding collection.
   */
  getActions(): TAction[] {
    return this.KEY_BINDINGS.map((binding) => binding.action);
  }

  /**
   * Get all keys used in this key binding collection.
   */
  getKeys(): string[] {
    return this.KEY_BINDINGS.map((binding) => binding.key);
  }
}
