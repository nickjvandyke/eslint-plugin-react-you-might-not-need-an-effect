import type { Rule, Scope } from "eslint";
import { getCallExpr, isSynchronous } from "../util/ast.ts";
import {
  getEffectDepsRefs,
  getEffectFn,
  getEffectFnRefs,
  getUseStateDecl,
  isStateSetter,
  isStateCall,
  isUseEffect,
} from "../util/react.ts";

const rule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow initializing state in an effect.",
      url: "https://tkdodo.eu/blog/avoiding-hydration-mismatches-with-use-sync-external-store",
    },
    schema: [],
    messages: {
      avoidInitializingState:
        'Avoid initializing state in an effect. Instead, initialize "{{state}}"\'s `useState()` with "{{arguments}}". For SSR hydration, prefer `useSyncExternalStore()`.',
    },
  },
  create: (context: Rule.RuleContext) => ({
    CallExpression: (node: Rule.Node) => {
      if (!isUseEffect(node)) return;
      const effectFnRefs = getEffectFnRefs(context, node);
      const depsRefs = getEffectDepsRefs(context, node);
      if (!effectFnRefs || !depsRefs) return;

      const isEffectRunOnlyOnMount =
        depsRefs.filter((ref: Scope.Reference) => !isStateSetter(ref))
          .length === 0;
      if (!isEffectRunOnlyOnMount) return;

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
          let argumentText = "undefined";
          if (
            callExpr &&
            callExpr.type === "CallExpression" &&
            callExpr.arguments[0]
          ) {
            argumentText = context.sourceCode.getText(
              callExpr.arguments[0] as Rule.Node,
            );
          }

          context.report({
            node: callExpr,
            messageId: "avoidInitializingState",
            data: { state: stateName, arguments: argumentText },
          });
        });
    },
  }),
};

export default rule;
