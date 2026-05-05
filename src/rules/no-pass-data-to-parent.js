import {
  getArgsUpstreamRefs,
  getCallExpr,
  getUpstreamRefs,
  isSynchronous,
} from "../util/ast.js";
import {
  getEffectFnRefs,
  getEffectDepsRefs,
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
  findContainingNode,
} from "../util/react.js";

/**
 * @type {import("eslint").Rule.RuleModule}
 */
export default {
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
  create: (context) => ({
    CallExpression: (node) => {
      if (!isUseEffect(node) || hasCleanup(node)) return;
      const effectFnRefs = getEffectFnRefs(context, node);
      const depsRefs = getEffectDepsRefs(context, node);
      if (!effectFnRefs || !depsRefs) return;

      effectFnRefs
        .filter((ref) => isPropCall(context, ref))
        .filter((ref) => !isRefCall(context, ref))
        .filter((ref) => isSynchronous(ref.identifier, getEffectFn(node)))
        .forEach((ref) => {
          const callExpr = getCallExpr(ref);

          const argsUpstreamRefs = getArgsUpstreamRefs(context, ref)
            // Leaves only because our "is data" check is essentially "is not all this other stuff",
            // and the "other stuff" only works on leaf nodes.
            // Mid-stream nodes are effectively nothing, and so would pass those.
            // TODO: Is there a positive way to identify "data" nodes instead of process of elimination?
            .filter((ref) => getUpstreamRefs(context, ref).length === 1);

          const isSomeArgsData = argsUpstreamRefs.some(
            (ref) =>
              // TODO: Ideally would use isState and isRef, not the hooks.
              // But because it goes to leaves. Must be some other way?
              !isUseState(ref.identifier) &&
              !isProp(context, ref) &&
              !isUseRef(ref.identifier) &&
              !isRefCurrent(ref) &&
              !isConstant(ref),
          );

          if (isSomeArgsData) {
            const containingNode = findContainingNode(context, node);
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
