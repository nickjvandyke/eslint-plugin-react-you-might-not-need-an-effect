import type { Rule, Scope } from "eslint";
import {
  getArgsUpstreamRefs,
  getCallExpr,
  getUpstreamRefs,
  isSynchronous,
} from "../util/ast.ts";
import {
  getEffectDepsRefs,
  getEffectFn,
  getEffectFnRefs,
  isProp,
  isStateCall,
  isUseEffect,
} from "../util/react.ts";

const rule: Rule.RuleModule = {
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
  create: (context: Rule.RuleContext) => ({
    CallExpression: (node: Rule.Node) => {
      if (!isUseEffect(node)) return;
      const effectFnRefs = getEffectFnRefs(context, node);
      const depsRefs = getEffectDepsRefs(context, node);
      if (!effectFnRefs || !depsRefs) return;

      const isSomeDepsProps = depsRefs
        .flatMap((ref: Scope.Reference) => getUpstreamRefs(context, ref))
        .some((ref: Scope.Reference) => isProp(context, ref));

      const effectFn = getEffectFn(node);
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
          const isSomeArgsProps = getArgsUpstreamRefs(context, ref).some(
            (ref: Scope.Reference) => isProp(context, ref),
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

export default rule;
