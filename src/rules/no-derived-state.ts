import type { Rule, Scope } from "eslint";
import {
  getArgsUpstreamRefs,
  getCallExpr,
  isSynchronous,
} from "../util/ast.ts";
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
        'Avoid storing derived state. Compute "{{state}}" directly during render, optionally with `useMemo` if it\'s expensive.',
    },
  },
  create: (context: Rule.RuleContext) => ({
    CallExpression: (node: Rule.Node) => {
      if (!isUseEffect(node) || hasCleanup(node)) return;
      const effectFnRefs = getEffectFnRefs(context, node);
      const depsRefs = getEffectDepsRefs(context, node);
      if (!effectFnRefs || !depsRefs) return;

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
          const useStateNode = getUseStateDecl(context, ref);
          const stateName = (
            (
              useStateNode as
                | (Rule.Node & {
                    id: { elements: ({ name: string } | null)[] };
                  })
                | undefined
            )?.id?.elements[0] ??
            (
              useStateNode as
                | (Rule.Node & {
                    id: { elements: ({ name: string } | null)[] };
                  })
                | undefined
            )?.id?.elements[1]
          )?.name;
          if (!stateName) return;

          const argsUpstreamRefs = getArgsUpstreamRefs(context, ref);
          const isSomeArgsInternal = argsUpstreamRefs.some(
            (ref: Scope.Reference) => isState(ref) || isProp(context, ref),
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
