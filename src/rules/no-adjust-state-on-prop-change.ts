import type { Rule } from "eslint";
import { getCallExpr, getUpstreamRefs, isSynchronous } from "../util/ast.ts";
import {
  getDependencyVariables,
  getEffect,
  getSetterArgumentVariables,
} from "../util/effect.ts";
import { isExternalValue } from "../util/props.ts";
import { getStateName, isStateSetterCall } from "../util/state.ts";

const rule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow adjusting state in an effect when an external value changes.",
      url: "https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes",
    },
    schema: [],
    messages: {
      avoidAdjustingStateWhenAValueChanges:
        'Avoid adjusting state when {{values}} changes. Instead, adjust "{{state}}" directly during render, or refactor your state to avoid this need entirely.',
    },
  },
  create: (context) => ({
    CallExpression: (node) => {
      const effect = getEffect(context, node);
      if (!effect) return;

      // Props, context, and external hook values change outside the component.
      // Internal state belongs to `no-chain-state-updates` instead.
      const triggerRefs = [
        ...new Map(
          effect.depsRefs
            .flatMap((ref) => getUpstreamRefs(context, ref))
            .filter((ref) => isExternalValue(context, ref))
            .map((ref) => [ref.resolved ?? ref, ref]),
        ).values(),
      ];
      if (triggerRefs.length === 0) return;

      const depVariables = getDependencyVariables(context, effect);

      effect.fnRefs
        .filter((ref) => isSynchronous(ref.identifier, effect.fn))
        .filter((ref) => isStateSetterCall(context, ref))
        .forEach((ref) => {
          const callExpr = getCallExpr(ref);
          if (!callExpr) return;

          // Avoid overlap with no-derived-state: a value written from a
          // dependency is derived, not adjusted.
          const isSomeArgsFromDeps = getSetterArgumentVariables(
            context,
            ref,
          ).some((variable) => depVariables.has(variable));
          if (isSomeArgsFromDeps) return;

          const stateName = getStateName(context, ref);
          if (!stateName) return;

          context.report({
            node: callExpr,
            messageId: "avoidAdjustingStateWhenAValueChanges",
            data: {
              state: stateName,
              values: triggerRefs
                .map((r) => r.identifier.name)
                .map((n) => `"${n}"`)
                .join(" and "),
            },
          });
        });
    },
  }),
};

export default rule;
