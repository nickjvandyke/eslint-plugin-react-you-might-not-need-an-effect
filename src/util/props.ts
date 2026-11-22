import type { Scope, Rule } from "eslint";
import {
  getCallExpr,
  getRef,
  getSynchronousCallChain,
  isFunctionExpression,
  isHookName,
  someVariableInit,
} from "./ast.ts";
import { isComponent, isCustomHook, isHOC } from "./components.ts";
import {
  isUseCallback,
  isUseContext,
  isUseMemo,
  isUseRef,
  isUseState,
} from "./hooks.ts";
import { getOutermostWrapper, unwrapExpression } from "./typescript.ts";

/**
 * True when `ref` is a prop or a `useContext` value.
 *
 * Returns false for props of HOCs (e.g. `withRouter`) because they usually have side effects.
 * `useContext` values count because they are owned by an ancestor and change
 * outside the component, just like props.
 */
export const isProp = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean =>
  someVariableInit(
    ref,
    (init) => init.type === "CallExpression" && isUseContext(context, init),
  ) ||
  (ref.resolved?.defs ?? []).some((def) => {
    let declaringNode: Rule.Node = def.node;
    if (isFunctionExpression(declaringNode)) {
      declaringNode = getOutermostWrapper(declaringNode).parent;
      if (declaringNode.type === "CallExpression") {
        declaringNode = getOutermostWrapper(declaringNode).parent;
      }
    }
    return (
      def.type === "Parameter" &&
      ((isComponent(declaringNode) && !isHOC(context, declaringNode)) ||
        isCustomHook(declaringNode))
    );
  });

/** React names every hook `use` followed by an uppercase letter or a digit. */
const isHookCall = (init: Rule.Node): boolean => {
  if (init.type !== "CallExpression") return false;
  const callee = unwrapExpression(init.callee);
  const name =
    callee.type === "Identifier"
      ? callee.name
      : callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier"
        ? callee.property.name
        : undefined;
  return name !== undefined && isHookName(name);
};

/**
 * Hook return values are owned outside the component, like props, except for
 * values that React keeps stable across renders or that hold component state.
 * `useContext` values are excluded because `isProp` already covers them.
 */
export const isExternalHookValue = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean =>
  someVariableInit(
    ref,
    (init) =>
      isHookCall(init) &&
      !isUseState(context, init) &&
      !isUseContext(context, init) &&
      !isUseRef(context, init) &&
      !isUseMemo(context, init) &&
      !isUseCallback(context, init),
  );

/**
 * Whether the ref holds a value that lives outside the component: a prop, a
 * `useContext` value, or an external hook return value. Internal state belongs
 * to `no-chain-state-updates` instead.
 */
export const isExternalValue = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean => isProp(context, ref) || isExternalHookValue(context, ref);

/**
 * True when `ref` names a global: an unresolved reference, or a variable with
 * no definitions. `undefined` and `arguments` are identifiers, but they are not
 * data that a parent could read.
 */
const isGlobalRef = (ref: Scope.Reference): boolean =>
  ref.identifier.name !== "undefined" &&
  ref.identifier.name !== "arguments" &&
  (!ref.resolved || ref.resolved.defs.length === 0);

/**
 * True when `ref` reads a value from outside the component: a global such as
 * `window`, or a call on a global or imported function such as `fetchData()`.
 * Imported values that are not called are excluded, e.g. a shared constant.
 */
export const isExternalSource = (ref: Scope.Reference): boolean => {
  if (isGlobalRef(ref)) return true;

  const isImport = (ref.resolved?.defs ?? []).some(
    (def) => def.type === "ImportBinding",
  );
  return isImport && getCallExpr(ref) !== undefined;
};

/**
 * True when `ref` is a local alias of a global, directly or through a chain
 * such as `const w = window; const x = w;`. The value is as unsafe to read
 * during render as the global itself.
 */
export const isGlobalAlias = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
  seen: Set<Scope.Variable> = new Set(),
): boolean => {
  const variable = ref.resolved;
  if (!variable || variable.defs.length === 0) return false;
  if (seen.has(variable)) return false;
  seen.add(variable);

  return variable.defs.some((def) => {
    if (def.type !== "Variable" || !def.node.init) return false;
    const init = unwrapExpression(def.node.init);
    if (init.type !== "Identifier") return false;
    const initRef = getRef(context, init);
    return initRef !== undefined && isGlobalValue(context, initRef, seen);
  });
};

const isGlobalValue = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
  seen: Set<Scope.Variable>,
): boolean => isGlobalRef(ref) || isGlobalAlias(context, ref, seen);

/** True when the synchronous call chain from `ref` reaches a prop. */
export const isPropCall = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean =>
  getSynchronousCallChain(context, ref).some((callChainRef) =>
    isProp(context, callChainRef),
  );
