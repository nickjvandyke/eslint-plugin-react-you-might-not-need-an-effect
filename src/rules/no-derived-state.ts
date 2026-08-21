import type { Rule } from "eslint";
import {
  getArgsUpstreamRefs,
  getCallExpr,
  isSynchronous,
} from "../util/ast.ts";
import {
  isStateCall,
  getStateName,
  isProp,
  isState,
  getEffect,
} from "../util/react.ts";

const rule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow storing derived state in an effect.",
      url: "https://react.dev/learn/you-might-not-need-an-effect#updating-state-based-on-props-or-state",
    },
    schema: [],
    messages: {
      avoidDerivedState:
        'Avoid storing derived state. Instead, compute "{{state}}" directly during render.',
    },
  },
  create: (context) => ({
    CallExpression: (node) => {
      const effect = getEffect(context, node);
      if (!effect || effect.cleanup) return;

      effect.fnRefs
        .filter((ref) => isSynchronous(ref.identifier as Rule.Node, effect.fn))
        .filter((ref) => isStateCall(context, ref))
        .forEach((ref) => {
          const callExpr = getCallExpr(ref);
          if (!callExpr) return;
          const stateName = getStateName(context, ref);
          if (!stateName) return;

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

export default rule;
