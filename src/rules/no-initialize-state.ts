import type { Rule } from "eslint";
import { getCallExpr, isSynchronous } from "../util/ast.ts";
import {
  getStateName,
  isStateSetter,
  isStateCall,
  getEffect,
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
        'Avoid initializing state in an effect. Instead, initialize "{{state}}"\'s "useState()" with "{{arguments}}". For SSR hydration, prefer "useSyncExternalStore".',
    },
  },
  create: (context) => ({
    CallExpression: (node) => {
      const effect = getEffect(context, node);
      if (!effect || !effect.depsRefs) return;

      const isEffectRunOnlyOnMount =
        effect.depsRefs.filter((ref) => !isStateSetter(ref)).length === 0;
      if (!isEffectRunOnlyOnMount) return;

      effect.fnRefs
        .filter((ref) => isSynchronous(ref.identifier as Rule.Node, effect.fn))
        .filter((ref) => isStateCall(context, ref))
        .forEach((ref) => {
          const callExpr = getCallExpr(ref);
          if (!callExpr) return;
          const stateName = getStateName(context, ref);
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
