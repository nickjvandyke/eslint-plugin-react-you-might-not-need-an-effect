import type { Rule, Scope } from "eslint";
import {
  getArgsUpstreamRefs,
  getDefinitionValueNode,
  getDownstreamRefs,
  getRef,
  getUpstreamRefs,
  isDefined,
  isFunction,
  isSynchronous,
  type FunctionNode,
  type ReturnStatementNode,
} from "./ast.ts";
import { isUseEffect } from "./hooks.ts";
import { isGlobalAlias } from "./props.ts";
import { isRef, isRefCurrent } from "./refs.ts";
import { isStateSetter, isStateSetterCall } from "./state.ts";
import { unwrapExpression } from "./typescript.ts";

/** A cleanup return always has an argument, because bare `return`s are skipped. */
export type CleanupReturn = ReturnStatementNode & { argument: Rule.Node };

export interface Effect {
  fn: FunctionNode;
  fnRefs: Scope.Reference[];
  depsRefs: Scope.Reference[];
  cleanup: CleanupReturn | undefined;
}

const getEffectFn = (
  context: Rule.RuleContext,
  node: Rule.Node,
): FunctionNode | undefined => {
  if (node.type !== "CallExpression") return undefined;
  const [effectFnArg] = node.arguments;
  if (!effectFnArg) return undefined;
  const effectFn = unwrapExpression(effectFnArg);
  if (isFunction(effectFn)) {
    return effectFn;
  } else if (effectFn.type === "Identifier") {
    const def = getRef(context, effectFn)?.resolved?.defs[0];
    // A `FunctionDeclaration` is already the function node.
    if (def?.type === "FunctionName") return def.node;
    const valueNode = def && getDefinitionValueNode(def);
    const resolved = valueNode && unwrapExpression(valueNode);
    // Ignore values that are not functions, e.g. the render-time call result
    // of `const fn = makeEffect(state)`.
    return resolved && isFunction(resolved) ? resolved : undefined;
  }

  return undefined;
};

const getEffectDeps = (node: Rule.Node): Rule.Node | undefined => {
  if (node.type !== "CallExpression") return undefined;
  const deps = node.arguments[1];
  return deps ? unwrapExpression(deps) : undefined;
};

const getEffectCleanup = (
  effectFn: FunctionNode,
): CleanupReturn | undefined => {
  if (effectFn.body.type !== "BlockStatement") return undefined;

  return [...effectFn.body.body].reverse().find(
    // Check `.argument` so we don't consider bare `return`s
    (stmt): stmt is CleanupReturn =>
      stmt.type === "ReturnStatement" && stmt.argument !== null,
  );
};

/**
 * Returns the effect function and its dependencies for a `useEffect`-style
 * call. Returns `undefined` when the node is not an effect or the first
 * argument is not a function. A missing dependency array yields no
 * dependencies.
 */
export const getEffect = (
  context: Rule.RuleContext,
  node: Rule.Node,
): Effect | undefined => {
  if (!isUseEffect(context, node)) return undefined;

  const fn = getEffectFn(context, node);
  if (!fn) return undefined;

  const deps = getEffectDeps(node);

  return {
    fn,
    fnRefs: getDownstreamRefs(context, fn),
    // No dependency array means the effect runs after every render.
    // Treat that as empty so mount-only rules still apply.
    // A dependency variable stays non-empty, so it is not treated as mount.
    depsRefs: deps ? getDownstreamRefs(context, deps) : [],
    cleanup: getEffectCleanup(fn),
  };
};

/**
 * Returns the variable behind a reference when React evaluates it during render.
 * Globals, imported bindings, refs, and local aliases of globals are excluded:
 * - Globals and imports are not re-created per render.
 * - `ref.current` is only updated after render, so it is not render-safe.
 * - `const w = window` is as unsafe as `window`.
 */
const getRenderVariable = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): Scope.Variable | undefined => {
  const variable = ref.resolved;
  if (!variable || variable.defs.length === 0) return undefined;
  const isImport = variable.defs.some((def) => def.type === "ImportBinding");
  if (isImport || isRef(context, ref) || isRefCurrent(ref)) return undefined;
  if (isGlobalAlias(context, ref)) return undefined;
  return variable;
};

/**
 * One variable per distinct render value in the dependency array.
 * Every dependency is available during render, by definition.
 * Includes their upstream references so a derived dependency (e.g.
 * `const name = firstName + lastName`) still matches `firstName`.
 * An omitted dependency array yields no dependencies, so mount-only effects
 * fall out here (`no-initialize-state` covers those).
 */
export const getDependencyVariables = (
  context: Rule.RuleContext,
  effect: Effect,
): Set<Scope.Variable> =>
  new Set(
    effect.depsRefs
      .flatMap((ref) => getUpstreamRefs(context, ref))
      .map((ref) => getRenderVariable(context, ref))
      .filter(isDefined),
  );

/** The render values written by the setter. */
export const getSetterArgumentVariables = (
  context: Rule.RuleContext,
  setterRef: Scope.Reference,
): Scope.Variable[] =>
  getArgsUpstreamRefs(context, setterRef, isStateSetter)
    .map((ref) => getRenderVariable(context, ref))
    .filter(isDefined);

/**
 * Synchronous state setters in the effect body that the cleanup also
 * references. A shared setter means the effect subscribes to an external
 * store, and the cleanup removes the subscription.
 *
 * A shared global (e.g. `window`) is not a subscription signal, so definitions
 * are required. Globals have no definitions.
 */
export const getSubscribedStateSetters = (
  context: Rule.RuleContext,
  effect: Effect,
): Scope.Reference[] => {
  if (!effect.cleanup) return [];

  const bodySetters = effect.fnRefs
    .filter((ref) => isSynchronous(ref.identifier, effect.fn))
    .filter((ref) => isStateSetterCall(context, ref));
  if (bodySetters.length === 0) return [];

  const cleanupRefs = getDownstreamRefs(context, effect.cleanup.argument);
  const cleanupVars = new Set<Scope.Variable>();
  for (const ref of cleanupRefs) {
    for (const upRef of getUpstreamRefs(context, ref)) {
      if (upRef.resolved && upRef.resolved.defs.length > 0) {
        cleanupVars.add(upRef.resolved);
      }
    }
  }

  return bodySetters.filter((ref) =>
    getUpstreamRefs(context, ref).some(
      (upRef) => upRef.resolved && cleanupVars.has(upRef.resolved),
    ),
  );
};
