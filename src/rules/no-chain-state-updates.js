import {
  getArgsUpstreamRefs,
  getCallExpr,
  getUpstreamRefs,
  isSynchronous,
} from "../util/ast.js";
import {
  getEffectDepsRefs,
  getEffectFnRefs,
  hasCleanup,
  isState,
  isStateCall,
  isUseEffect,
  getEffectFn,
} from "../util/react.js";

/**
 * @type {import("eslint").Rule.RuleModule}
 */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow chaining state changes in an effect.",
      url: "https://react.dev/learn/you-might-not-need-an-effect#chains-of-computations",
    },
    schema: [],
    messages: {
      avoidChainingStateUpdates:
        "Avoid chaining state changes. When possible, update all relevant state simultaneously.",
    },
  },
  create: (context) => ({
    CallExpression: (node) => {
      if (!isUseEffect(node) || hasCleanup(node)) return;
      const effectFnRefs = getEffectFnRefs(context, node);
      const depsRefs = getEffectDepsRefs(context, node);
      if (!effectFnRefs || !depsRefs) return;

      const isSomeDepsState = depsRefs
        .flatMap((ref) => getUpstreamRefs(context, ref))
        .some((ref) => isState(ref));

      effectFnRefs
        .filter((ref) => isSynchronous(ref.identifier, getEffectFn(node)))
        .filter((ref) => isStateCall(context, ref))
        .forEach((ref) => {
          const callExpr = getCallExpr(ref);

          // Avoid overlap with no-derived-state
          const isSomeArgsState = getArgsUpstreamRefs(context, ref).some(
            (ref) => isState(ref),
          );

          if (isSomeDepsState && !isSomeArgsState) {
            context.report({
              node: callExpr,
              messageId: "avoidChainingStateUpdates",
            });
          }
        });
    },
  }),
};
