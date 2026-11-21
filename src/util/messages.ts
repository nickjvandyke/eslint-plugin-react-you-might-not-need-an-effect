import type { Rule } from "eslint";
import { getComponentOrHookName } from "./components.ts";

/**
 * Joins names for a message, with one pair of quotes per name:
 * `"a"`, `"a" and "b"`, `"a" and "b" and "c"`.
 */
export const formatNames = (names: readonly string[]): string =>
  names.map((name) => `"${name}"`).join(" and ");

/**
 * Names the component or custom hook that owns an effect. Falls back to a
 * generic label when the function has no name, for example
 * `export default () => { ... }`.
 *
 * An unnamed custom hook cannot exist: `isCustomHook` requires a hook name.
 */
export const formatOwner = (containingNode: Rule.Node | undefined): string => {
  const name = getComponentOrHookName(containingNode);
  return name ? `"${name}"` : "this component";
};
