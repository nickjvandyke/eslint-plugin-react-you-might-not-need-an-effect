import {
  getArgsUpstreamRefs,
  getCallExpr,
  isSynchronous,
} from "../util/ast.js";
import {
  getEffectFnRefs,
  getEffectDepsRefs,
  isPropCall,
  isState,
  isUseEffect,
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
      description: "Disallow passing live state to parents in an effect.",
      url: "https://react.dev/learn/you-might-not-need-an-effect#notifying-parent-components-about-state-changes",
    },
    schema: [],
    messages: {
      avoidPassingLiveStateToParentInComponent:
        "Avoid passing live state to parents in an effect. Instead, lift the state to the parent and pass it down to the child as a prop.",
      avoidPassingLiveStateToParentInHook:
        "Avoid passing live state to parents in an effect. Instead, return the state from the hook.",
    },
  },
  create: (context) => ({
    CallExpression: (node) => {
      if (!isUseEffect(node)) return;
      const effectFnRefs = getEffectFnRefs(context, node);
      const depsRefs = getEffectDepsRefs(context, node);
      if (!effectFnRefs || !depsRefs) return;

      effectFnRefs
        .filter((ref) => isPropCall(context, ref))
        .filter((ref) => isSynchronous(ref.identifier, getEffectFn(node)))
        .forEach((ref) => {
          const callExpr = getCallExpr(ref);
          const isStateInArgs = getArgsUpstreamRefs(context, ref).some((ref) =>
            isState(ref),
          );

          if (isStateInArgs) {
            const containingNode = findContainingNode(context, node);
            const isInCustomHook =
              containingNode && isCustomHook(containingNode);

            context.report({
              node: callExpr,
              messageId: isInCustomHook
                ? "avoidPassingLiveStateToParentInHook"
                : "avoidPassingLiveStateToParentInComponent",
            });
          }
        });
    },
  }),
};
