import type { Scope, Rule } from "eslint";
import { getSynchronousCallChain, someVariableInit } from "./ast.ts";
import { isUseRef } from "./hooks.ts";
import { getOutermostWrapper } from "./typescript.ts";

/** True when `ref` is created by a `useRef` call. */
export const isRef = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean =>
  someVariableInit(
    ref,
    (init) => init.type === "CallExpression" && isUseRef(context, init),
  );

/**
 * Whether the reference's `current` property is being accessed.
 * Heuristic for whether the reference is a React ref object.
 * Because we don't always have access to the `useRef` call itself.
 * For example when receiving a ref from props.
 */
export const isRefCurrent = (ref: Scope.Reference): boolean => {
  const parent = getOutermostWrapper(ref.identifier).parent;
  return (
    parent.type === "MemberExpression" &&
    parent.property.type === "Identifier" &&
    parent.property.name === "current"
  );
};

/** True when the synchronous call chain from `ref` reaches a ref object. */
export const isRefCall = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean =>
  getSynchronousCallChain(context, ref).some(
    (callChainRef) =>
      isRefCurrent(callChainRef) || isRef(context, callChainRef),
  );
