import {
  getArgsUpstreamRefs,
  getCallExpr,
  getUpstreamRefs,
  isSynchronous,
} from "../util/ast.js";
import {
  getEffectDepsRefs,
  getEffectFn,
  getEffectFnRefs,
  isProp,
  isStateCall,
  isUseEffect,
} from "../util/react.js";

/**
 * @type {import("eslint").Rule.RuleModule}
 */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow adjusting state in an effect when a prop changes.",
      url: "https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes",
    },
    schema: [],
    messages: {
      avoidAdjustingStateWhenAPropChanges:
        "Avoid adjusting state when a prop changes. Instead, adjust the state directly during render, or refactor your state to avoid this need entirely.",
    },
  },
  create: (context) => ({
    CallExpression: (node) => {
      if (!isUseEffect(node)) return;
      const effectFnRefs = getEffectFnRefs(context, node);
      const depsRefs = getEffectDepsRefs(context, node);
      if (!effectFnRefs || !depsRefs) return;

      const isSomeDepsProps = depsRefs
        .flatMap((ref) => getUpstreamRefs(context, ref))
        .some((ref) => isProp(context, ref));

      effectFnRefs
        .filter((ref) => isSynchronous(ref.identifier, getEffectFn(node)))
        .filter((ref) => isStateCall(context, ref))
        .forEach((ref) => {
          const callExpr = getCallExpr(ref);

          // Avoid overlap with no-derived-state
          const isSomeArgsProps = getArgsUpstreamRefs(context, ref).some(
            (ref) => isProp(context, ref),
          );

          if (isSomeDepsProps && !isSomeArgsProps) {
            context.report({
              node: callExpr,
              messageId: "avoidAdjustingStateWhenAPropChanges",
            });
          }
        });
    },
  }),
};
