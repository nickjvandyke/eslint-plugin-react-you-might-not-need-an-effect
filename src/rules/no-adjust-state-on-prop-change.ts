import type { Rule } from "eslint";
import {
  getArgsUpstreamRefs,
  getCallExpr,
  getUpstreamRefs,
  isSynchronous,
} from "../util/ast.ts";
import { getStateName, isProp, isStateCall, getEffect } from "../util/react.ts";

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
        'Avoid adjusting state when a prop changes. Instead, adjust "{{state}}" directly during render when {{props}} changes, or refactor your state to avoid this need entirely.',
    },
  },
  create: (context) => ({
    CallExpression: (node) => {
      const effect = getEffect(context, node);
      if (!effect || !effect.depsRefs) return;

      const depsPropRefs = effect.depsRefs
        .flatMap((ref) => getUpstreamRefs(context, ref))
        .filter((ref) => isProp(context, ref));
      if (depsPropRefs.length === 0) return;

      effect.fnRefs
        .filter((ref) => isSynchronous(ref.identifier as Rule.Node, effect.fn))
        .filter((ref) => isStateCall(context, ref))
        .forEach((ref) => {
          const callExpr = getCallExpr(ref);
          if (!callExpr) return;

          // Avoid overlap with no-derived-state
          const isSomeArgsProps = getArgsUpstreamRefs(context, ref).some(
            (ref) => isProp(context, ref),
          );
          if (isSomeArgsProps) return;

          const stateName = getStateName(context, ref);
          if (!stateName) return;

          context.report({
            node: callExpr,
            messageId: "avoidAdjustingStateWhenAPropChanges",
            data: {
              state: stateName,
              props: depsPropRefs
                .map((ref) => ref.identifier.name)
                .map((n) => `"${n}"`)
                .join(" and "),
            },
          });
        });
    },
  }),
};

export default rule;
