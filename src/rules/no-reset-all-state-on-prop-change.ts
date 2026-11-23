import type { Rule, Scope } from "eslint";
import { unwrapExpression } from "../util/typescript.ts";
import {
  getCallExpr,
  getDownstreamNodes,
  getRef,
  getSynchronousCallChain,
  getUpstreamRefs,
  isSynchronous,
} from "../util/ast.ts";
import {
  findEnclosingComponentOrHook,
  isCustomHook,
} from "../util/components.ts";
import { getEffect, type Effect } from "../util/effect.ts";
import { isUseState } from "../util/hooks.ts";
import { isProp } from "../util/props.ts";
import { getUseStateDeclarator, isStateSetterCall } from "../util/state.ts";

const rule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow resetting all state in an effect when a prop changes.",
      url: "https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes",
    },
    schema: [],
    messages: {
      avoidResettingAllStateWhenAPropChanges:
        'Avoid resetting all state when a prop changes. Instead, if "{{prop}}" is a key, pass it as "key" so React will reset the component\'s state.',
    },
  },
  create: (context) => ({
    CallExpression: (node) => {
      const effect = getEffect(context, node);
      if (!effect) return;
      // Skip custom hooks because they can't receive `key` like components can.
      const containingNode = findEnclosingComponentOrHook(context, node);
      if (containingNode && isCustomHook(containingNode)) return;

      const propUsedToResetAllState = findPropUsedToResetAllState(
        context,
        effect,
        node,
      );

      if (propUsedToResetAllState) {
        context.report({
          node: node,
          messageId: "avoidResettingAllStateWhenAPropChanges",
          data: { prop: propUsedToResetAllState.identifier.name },
        });
      }
    },
  }),
};

/**
 * Returns the prop that triggers a full state reset, if any.
 *
 * The effect must reset every `useState` value in the component to its initial
 * value. Any prop in the effect dependencies is then the trigger.
 */
const findPropUsedToResetAllState = (
  context: Rule.RuleContext,
  effect: Effect,
  useEffectNode: Rule.Node,
): Scope.Reference | undefined => {
  const synchronousSetterRefs = effect.fnRefs
    // A setter inside a callback that may run later does not reset state when
    // the effect runs, so it does not count.
    .filter((ref) => isSynchronous(ref.identifier, effect.fn))
    .filter((ref) => isStateSetterCall(context, ref));

  // Check every call before deduplicating. An effect that resets state and then
  // overwrites it in a second call is not a reset, even though the state itself
  // only appears once after deduplication.
  const everySynchronousCallSetsInitialValue = synchronousSetterRefs.every(
    (ref) => isSetStateToInitialValue(context, ref),
  );

  const seenDeclarators = new Set<Rule.Node>();
  const stateSetterRefs = synchronousSetterRefs
    // The same setter can be reached more than once in one effect, e.g. by a
    // helper call and a direct call. Count each state once.
    .filter((ref) => {
      const declarator = getUseStateDeclarator(context, ref);
      if (!declarator || seenDeclarators.has(declarator)) return false;
      seenDeclarators.add(declarator);
      return true;
    });

  const isAllStateReset =
    stateSetterRefs.length > 0 &&
    everySynchronousCallSetsInitialValue &&
    stateSetterRefs.length ===
      countUseStates(
        context,
        findEnclosingComponentOrHook(context, useEffectNode),
      );

  return isAllStateReset
    ? effect.depsRefs
        .flatMap((ref) => getUpstreamRefs(context, ref))
        .find((ref) => isProp(context, ref))
    : undefined;
};

/**
 * True when `node` is an identifier that resolves to a function parameter.
 * This means a wrapper function forwards the value it receives.
 */
const isParameterIdentifier = (
  context: Rule.RuleContext,
  node: Rule.Node | undefined,
): boolean => {
  if (!node) return false;
  const identifier = unwrapExpression(node);
  if (identifier.type !== "Identifier") return false;
  const ref = getRef(context, identifier);
  return ref?.resolved?.defs.some((def) => def.type === "Parameter") ?? false;
};

/**
 * True when the setter writes the same value that `useState` uses as its
 * initial value. Follows wrapper setters and treats a missing argument as
 * `undefined`. Compares the source text of the written value and the
 * initializer.
 */
const isSetStateToInitialValue = (
  context: Rule.RuleContext,
  setterRef: Scope.Reference,
): boolean => {
  // A helper or alias may call the state setter itself. The chain runs from the
  // outermost call to the call that reaches the setter. Start at the innermost
  // call, which carries the written value, and step outward only while that
  // value is a parameter of the wrapping helper. For example:
  //   const run = (fallback) => setUser(userId ?? fallback);
  //   run(null);
  // `setUser(userId ?? fallback)` carries the value. It is not the parameter,
  // so the written value is not `null`.
  const setterCalls = getSynchronousCallChain(context, setterRef)
    .filter(
      (chainRef) =>
        getCallExpr(chainRef) !== undefined &&
        isStateSetterCall(context, chainRef),
    )
    .reverse();
  let index = 0;
  let callExpr = getCallExpr(setterCalls[index] ?? setterRef);
  while (
    callExpr !== undefined &&
    index < setterCalls.length - 1 &&
    isParameterIdentifier(context, callExpr.arguments[0])
  ) {
    index++;
    callExpr = getCallExpr(setterCalls[index]);
  }
  if (!callExpr) return false;
  const rawSetStateToValue = callExpr.arguments[0];
  const setStateToValue = rawSetStateToValue
    ? unwrapExpression(rawSetStateToValue)
    : undefined;
  const useStateDecl = getUseStateDeclarator(context, setterRef);
  if (!useStateDecl || !useStateDecl.init) return false;
  const useStateInit = unwrapExpression(useStateDecl.init);
  if (useStateInit.type !== "CallExpression") return false;
  const rawStateInitialValue = useStateInit.arguments[0];
  const stateInitialValue = rawStateInitialValue
    ? unwrapExpression(rawStateInitialValue)
    : undefined;

  // `useState()` (with no args) defaults to `undefined`,
  // so ommitting the arg is equivalent to passing `undefined`.
  // Technically this would false positive if they shadowed
  // `undefined` in only one of the scopes (only possible via `var`),
  // but I hope no one would do that.
  const isUndefined = (node: Rule.Node | undefined): boolean =>
    node === undefined || ("name" in node && node.name === "undefined");
  if (isUndefined(setStateToValue) && isUndefined(stateInitialValue)) {
    return true;
  }

  // TODO: This is one of the few times we compare just the immediate nodes,
  // not upstream variables - that seems pretty complicated here?
  // At the least, upstream functions would have to return literals for us to consider too, not just variables...
  if (!setStateToValue || !stateInitialValue) return false;
  return (
    context.sourceCode.getText(setStateToValue) ===
    context.sourceCode.getText(stateInitialValue)
  );
};

/**
 * Counts `useState` calls inside the component.
 */
const countUseStates = (
  context: Rule.RuleContext,
  componentNode: Rule.Node | undefined,
): number => {
  if (!componentNode) {
    return 0;
  }

  // Includes call arguments, so wrappers like `memo` and `forwardRef` expose
  // the function body that holds the hooks.
  return getDownstreamNodes(context, componentNode, "CallExpression").filter(
    (node) => isUseState(context, node),
  ).length;
};

export default rule;
