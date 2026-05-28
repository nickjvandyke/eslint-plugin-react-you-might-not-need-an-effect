import {
  getArgsUpstreamRefs,
  getCallExpr,
  isSynchronous,
} from "../util/ast.js";
import {
  getEffectFnRefs,
  getEffectDepsRefs,
  isStateCall,
  getUseStateDecl,
  isProp,
  hasCleanup,
  isState,
  isUseEffect,
  getEffectFn,
} from "../util/react.js";

/**
 * @type {import('eslint').Rule.RuleModule}
 */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow storing derived state in an effect.",
      url: "https://react.dev/learn/you-might-not-need-an-effect#updating-state-based-on-props-or-state",
    },
    schema: [],
    messages: {
      avoidDerivedState:
        'Avoid storing derived state. Compute "{{state}}" directly during render, optionally with `useMemo` if it\'s expensive.',
    },
  },
  create: (context) => ({
    CallExpression: (node) => {
      if (!isUseEffect(node) || hasCleanup(node)) return;
      const effectFnRefs = getEffectFnRefs(context, node);
      const depsRefs = getEffectDepsRefs(context, node);
      if (!effectFnRefs || !depsRefs) return;

      effectFnRefs
        .filter((ref) => isSynchronous(ref.identifier, getEffectFn(node)))
        .filter((ref) => isStateCall(context, ref))
        .forEach((ref) => {
          const callExpr = getCallExpr(ref);
          const useStateNode = getUseStateDecl(context, ref);
          const stateName = (
            useStateNode?.id.elements[0] ?? useStateNode?.id.elements[1]
          )?.name;

          const argsUpstreamRefs = getArgsUpstreamRefs(context, ref);
          const isSomeArgsInternal = argsUpstreamRefs.some(
            (ref) => isState(ref) || isProp(context, ref),
          );

          if (isSomeArgsInternal) {
            context.report({
              node: callExpr,
              messageId: "avoidDerivedState",
              data: { state: stateName },
            });
          }
        });
    },
  }),
};
