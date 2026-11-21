import type { Scope, Rule } from "eslint";
import {
  getSynchronousCallChain,
  isFunctionExpression,
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

// Returns false for props of HOCs (e.g. `withRouter`) because they usually have side effects.
// Also returns true for `useContext` values, because they are owned by an ancestor
// and change outside the component, just like props.
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

// React names every hook `use` followed by a capital letter.
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
  return name !== undefined && /^use[A-Z0-9]/.test(name);
};

// Hook return values are owned outside the component, like props, except for
// values that React keeps stable across renders or that hold component state.
const isExternalHookValue = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean =>
  someVariableInit(
    ref,
    (init) =>
      isHookCall(init) &&
      !isUseState(context, init) &&
      !isUseRef(context, init) &&
      !isUseMemo(context, init) &&
      !isUseCallback(context, init),
  );

// Whether the ref holds a value that lives outside the component: a prop, a
// `useContext` value, or an external hook return value. Internal state belongs
// to `no-chain-state-updates` instead.
export const isExternalValue = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean => isProp(context, ref) || isExternalHookValue(context, ref);

export const isPropCall = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean =>
  getSynchronousCallChain(context, ref).some((callChainRef) =>
    isProp(context, callChainRef),
  );
