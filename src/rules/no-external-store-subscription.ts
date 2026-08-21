import type { Rule, Scope } from "eslint";
import {
  getUpstreamRefs,
  getCallExpr,
  getDownstreamRefs,
  findDownstreamNodes,
  isSynchronous,
} from "../util/ast.ts";
import { getStateName, isStateCall, getEffect } from "../util/react.ts";

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
      if (!effect || !effect.cleanup) return;

      const bodySetters = effect.fnRefs
        .filter((ref) => isSynchronous(ref.identifier as Rule.Node, effect.fn))
        .filter((ref) => isStateCall(context, ref));
      if (bodySetters.length === 0) return;

      const cleanupArg = effect.cleanup.argument as Rule.Node | undefined;
      if (!cleanupArg) return;
      const cleanupRefs = getDownstreamRefs(context, cleanupArg);

      // Manual descend because `descend` skips arguments.
      // TODO: Refactor it to be more flexible
      findDownstreamNodes(context, cleanupArg, "CallExpression").forEach(
        (callExpr) => {
          if (callExpr.type !== "CallExpression") return;
          for (const arg of callExpr.arguments) {
            if (!arg) continue;
            cleanupRefs.push(...getDownstreamRefs(context, arg as Rule.Node));
          }
        },
      );

      // Trace both the body setter and cleanup refs through alias chains.
      // If they share any upstream variable, the cleanup references the same setter.
      const cleanupVars = new Set<Scope.Variable>();
      for (const ref of cleanupRefs) {
        for (const upRef of getUpstreamRefs(context, ref)) {
          if (upRef.resolved) cleanupVars.add(upRef.resolved);
        }
      }

      for (const ref of bodySetters) {
        const sharesCleanupVar = getUpstreamRefs(context, ref).some(
          (upRef) => upRef.resolved && cleanupVars.has(upRef.resolved),
        );
        if (!sharesCleanupVar) continue;

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
