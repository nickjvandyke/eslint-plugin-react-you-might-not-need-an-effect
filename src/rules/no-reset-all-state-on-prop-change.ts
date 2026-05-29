import type { Rule, Scope } from "eslint";
import {
  getCallExpr,
  getDownstreamRefs,
  getUpstreamRefs,
} from "../util/ast.ts";
import {
  getEffectFnRefs,
  getEffectDepsRefs,
  isStateCall,
  isProp,
  getUseStateDecl,
  isCustomHook,
  isState,
  isUseEffect,
  findEnclosingReactNode,
} from "../util/react.ts";

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
        'Avoid resetting all state when a prop changes. Instead, if "{{prop}}" is a key, pass it as `key` so React will reset the component\'s state.',
    },
  },
  create: (context: Rule.RuleContext) => ({
    CallExpression: (node: Rule.Node) => {
      if (!isUseEffect(node)) return;
      const effectFnRefs = getEffectFnRefs(context, node);
      const depsRefs = getEffectDepsRefs(context, node);
      if (!effectFnRefs || !depsRefs) return;
      // Skip custom hooks because they can't receive `key` like components can.
      const containingNode = findEnclosingReactNode(context, node);
      if (containingNode && isCustomHook(containingNode)) return;

      const propUsedToResetAllState = findPropUsedToResetAllState(
        context,
        effectFnRefs,
        depsRefs,
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

const findPropUsedToResetAllState = (
  context: Rule.RuleContext,
  effectFnRefs: Scope.Reference[],
  depsRefs: Scope.Reference[],
  useEffectNode: Rule.Node,
): Scope.Reference | undefined => {
  const stateSetterRefs = effectFnRefs.filter((ref: Scope.Reference) =>
    isStateCall(context, ref),
  );

  const isAllStateReset =
    stateSetterRefs.length > 0 &&
    stateSetterRefs.every((ref: Scope.Reference) =>
      isSetStateToInitialValue(context, ref),
    ) &&
    stateSetterRefs.length ===
      countUseStates(context, findEnclosingReactNode(context, useEffectNode));

  return isAllStateReset
    ? depsRefs
        .flatMap((ref: Scope.Reference) => getUpstreamRefs(context, ref))
        .find((ref: Scope.Reference) => isProp(context, ref))
    : undefined;
};

const isSetStateToInitialValue = (
  context: Rule.RuleContext,
  setterRef: Scope.Reference,
): boolean => {
  const callExpr = getCallExpr(setterRef);
  if (!callExpr || callExpr.type !== "CallExpression") return false;
  const setStateToValue: Rule.Node | undefined = callExpr.arguments[0] as
    | Rule.Node
    | undefined;
  const useStateDecl = getUseStateDecl(context, setterRef);
  if (
    !useStateDecl ||
    !useStateDecl.init ||
    useStateDecl.init.type !== "CallExpression"
  )
    return false;
  const stateInitialValue: Rule.Node | undefined = useStateDecl.init
    .arguments[0] as Rule.Node | undefined;

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

  // `sourceCode.getText()` returns the entire file when passed null/undefined - let's short circuit that
  if (setStateToValue === null && stateInitialValue === null) {
    return true;
  } else if (
    (setStateToValue && !stateInitialValue) ||
    (!setStateToValue && stateInitialValue)
  ) {
    return false;
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

const countUseStates = (
  context: Rule.RuleContext,
  componentNode: Rule.Node | undefined,
): number => {
  if (!componentNode) {
    return 0;
  }

  if (
    componentNode.type === "VariableDeclarator" &&
    componentNode.init?.type === "CallExpression"
  ) {
    // Because `descend` will ignore the arguments.
    // TODO: Maybe an indicator we should filter out arguments somewhere else?
    componentNode = componentNode.init.arguments[0] as Rule.Node;
  }

  return getDownstreamRefs(context, componentNode).filter(
    (ref: Scope.Reference) => isState(ref),
  ).length;
};

export default rule;
