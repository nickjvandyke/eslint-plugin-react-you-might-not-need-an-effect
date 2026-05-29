import type { Rule, Scope } from "eslint";
import {
  getArgsUpstreamRefs,
  getCallExpr,
  getUpstreamRefs,
  isSynchronous,
} from "../util/ast.ts";
import {
  getEffectFnRefs,
  isPropCall,
  isConstant,
  isRefCurrent,
  isUseState,
  isUseRef,
  isProp,
  hasCleanup,
  isUseEffect,
  isRefCall,
  getEffectFn,
  isCustomHook,
  findEnclosingReactNode,
} from "../util/react.ts";

const rule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow passing data to parents in an effect.",
      url: "https://react.dev/learn/you-might-not-need-an-effect#passing-data-to-the-parent",
    },
    schema: [],
    messages: {
      avoidPassingDataToParentInComponent:
        "Avoid passing data to parents in an effect. Instead, fetch the data in the parent and pass it down to the child as a prop.",
      avoidPassingDataToParentInHook:
        "Avoid passing data to parents in an effect. Instead, return the data from the hook.",
    },
  },
  create: (context: Rule.RuleContext) => ({
    CallExpression: (node: Rule.Node) => {
      if (!isUseEffect(node) || hasCleanup(node)) return;
      const effectFnRefs = getEffectFnRefs(context, node);
      if (!effectFnRefs) return;

      const effectFn = getEffectFn(node);
      if (!effectFn) return;
      effectFnRefs
        .filter((ref: Scope.Reference) =>
          isSynchronous(ref.identifier as Rule.Node, effectFn),
        )
        .filter((ref: Scope.Reference) => isPropCall(context, ref))
        .filter((ref: Scope.Reference) => !isRefCall(context, ref))
        .forEach((ref: Scope.Reference) => {
          const callExpr = getCallExpr(ref);
          if (!callExpr) return;

          const argsUpstreamRefs = getArgsUpstreamRefs(context, ref)
            // Leaves only because our "is data" check is essentially "is not all this other stuff",
            // and the "other stuff" only works on leaf nodes.
            // Mid-stream nodes are effectively nothing, and so would pass those.
            // TODO: Is there a positive way to identify "data" nodes instead of process of elimination?
            .filter(
              (ref: Scope.Reference) =>
                getUpstreamRefs(context, ref).length === 1,
            );

          const isSomeArgsData = argsUpstreamRefs.some(
            (ref: Scope.Reference) =>
              // TODO: Ideally would use isState and isRef, not the hooks.
              // But because it goes to leaves. Must be some other way?
              !isUseState(ref.identifier as Rule.Node) &&
              !isProp(context, ref) &&
              !isUseRef(ref.identifier as Rule.Node) &&
              !isRefCurrent(ref) &&
              !isConstant(ref),
          );

          if (isSomeArgsData) {
            const containingNode = findEnclosingReactNode(context, node);
            const isInCustomHook =
              containingNode && isCustomHook(containingNode);

            context.report({
              node: callExpr,
              messageId: isInCustomHook
                ? "avoidPassingDataToParentInHook"
                : "avoidPassingDataToParentInComponent",
            });
          }
        });
    },
  }),
};

export default rule;
