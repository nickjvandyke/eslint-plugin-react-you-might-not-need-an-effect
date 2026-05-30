import type { Rule, Scope } from "eslint";
import {
  getArgsUpstreamRefs,
  getCallExpr,
  getUpstreamRefs,
  isSynchronous,
} from "../util/ast.ts";
import {
  getEffectDepsRefs,
  getEffectFnRefs,
  getEffectCleanup,
  getStateName,
  isState,
  isStateCall,
  isUseEffect,
  getEffectFn,
} from "../util/react.ts";

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
  create: (context: Rule.RuleContext) => ({
    CallExpression: (node: Rule.Node) => {
      if (!isUseEffect(node) || getEffectCleanup(context, node)) return;
      const effectFnRefs = getEffectFnRefs(context, node);
      const depsRefs = getEffectDepsRefs(context, node);
      if (!effectFnRefs || !depsRefs) return;

      const isSomeDepsState = depsRefs
        .flatMap((ref: Scope.Reference) => getUpstreamRefs(context, ref))
        .some((ref: Scope.Reference) => isState(ref));

      const effectFn = getEffectFn(context, node);
      if (!effectFn) return;
      effectFnRefs
        .filter((ref: Scope.Reference) =>
          isSynchronous(ref.identifier as Rule.Node, effectFn),
        )
        .filter((ref: Scope.Reference) => isStateCall(context, ref))
        .forEach((ref: Scope.Reference) => {
          const callExpr = getCallExpr(ref);
          if (!callExpr) return;

          // Avoid overlap with no-derived-state
          const isSomeArgsState = getArgsUpstreamRefs(context, ref).some(
            (ref: Scope.Reference) => isState(ref),
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
