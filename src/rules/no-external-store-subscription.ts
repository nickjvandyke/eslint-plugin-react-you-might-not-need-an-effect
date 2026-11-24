import type { Rule } from "eslint";
import { getCallExpr } from "../util/ast.ts";
import { getEffect, getSubscribedStateSetters } from "../util/effect.ts";
import { getStateName } from "../util/state.ts";

const rule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow subscribing to an external store in an effect.",
      url: "https://react.dev/learn/you-might-not-need-an-effect#subscribing-to-an-external-store",
    },
    schema: [],
    messages: {
      avoidExternalStoreSubscription:
        'Avoid using an effect to subscribe to an external store. Instead, use "useSyncExternalStore" to manage "{{state}}".',
    },
  },
  create: (context) => ({
    CallExpression: (node) => {
      const effect = getEffect(context, node);
      if (!effect) return;

      for (const ref of getSubscribedStateSetters(context, effect)) {
        const callExpr = getCallExpr(ref);
        if (!callExpr) continue;

        const stateName = getStateName(context, ref);
        if (!stateName) continue;

        context.report({
          node: callExpr,
          messageId: "avoidExternalStoreSubscription",
          data: { state: stateName },
        });
      }
    },
  }),
};

export default rule;
