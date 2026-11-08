import type { Rule } from "eslint";
import {
  getArgsUpstreamRefs,
  getCallExpr,
  getUpstreamRefs,
  isSynchronous,
} from "../util/ast.ts";
import { getEffect } from "../util/effect.ts";
import { getStateName, isState, isStateSetterCall } from "../util/state.ts";

const rule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow chaining state changes in an effect.",
      url: "https://react.dev/learn/you-might-not-need-an-effect#chains-of-computations",
    },
    schema: [],
    messages: {
      avoidChainingStateUpdates:
        'Avoid chaining state changes. When possible, update "{{state}}" along with other relevant state simultaneously.',
    },
  },
  create: (context) => ({
    CallExpression: (node) => {
      const effect = getEffect(context, node);
      if (!effect || effect.cleanup) return;

      const isSomeDepsState = effect.depsRefs
        .flatMap((ref) => getUpstreamRefs(context, ref))
        .some((ref) => isState(context, ref));

      effect.fnRefs
        .filter((ref) => isSynchronous(ref.identifier, effect.fn))
        .filter((ref) => isStateSetterCall(context, ref))
        .forEach((ref) => {
          const callExpr = getCallExpr(ref);
          if (!callExpr) return;

          // Avoid overlap with no-derived-state
          const isSomeArgsState = getArgsUpstreamRefs(context, ref).some(
            (ref) => isState(context, ref),
          );

          if (isSomeDepsState && !isSomeArgsState) {
            const stateName = getStateName(context, ref);
            if (!stateName) return;

            context.report({
              node: callExpr,
              messageId: "avoidChainingStateUpdates",
              data: { state: stateName },
            });
          }
        });
    },
  }),
};

export default rule;
