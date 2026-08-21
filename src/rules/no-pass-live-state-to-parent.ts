import type { Rule } from "eslint";
import {
  getArgsUpstreamRefs,
  getCallExpr,
  isSynchronous,
} from "../util/ast.ts";
import {
  getComponentName,
  isPropCall,
  isState,
  isCustomHook,
  findEnclosingReactNode,
  getEffect,
} from "../util/react.ts";

const rule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow passing live state to parents in an effect.",
      url: "https://react.dev/learn/you-might-not-need-an-effect#notifying-parent-components-about-state-changes",
    },
    schema: [],
    messages: {
      avoidPassingLiveStateToParentInComponent:
        'Avoid passing live state to parents in an effect. Instead, lift "{{state}}" to the parent and pass it down to {{name}} as a prop.',
      avoidPassingLiveStateToParentInHook:
        'Avoid passing live state to parents in an effect. Instead, return "{{state}}" from {{name}}.',
    },
  },
  create: (context) => ({
    CallExpression: (node) => {
      const effect = getEffect(context, node);
      if (!effect) return;

      effect.fnRefs
        .filter((ref) => isSynchronous(ref.identifier as Rule.Node, effect.fn))
        .filter((ref) => isPropCall(context, ref))
        .forEach((ref) => {
          const callExpr = getCallExpr(ref);
          if (!callExpr) return;

          const stateRefs = getArgsUpstreamRefs(context, ref).filter((r) =>
            isState(r),
          );
          if (stateRefs.length === 0) return;

          const containingNode = findEnclosingReactNode(context, node);
          const isInCustomHook = containingNode && isCustomHook(containingNode);

          context.report({
            node: callExpr,
            messageId: isInCustomHook
              ? "avoidPassingLiveStateToParentInHook"
              : "avoidPassingLiveStateToParentInComponent",
            data: {
              state: stateRefs
                .map((r) => r.identifier.name)
                .map((n) => `"${n}"`)
                .join(" and "),
              name: (() => {
                const n = getComponentName(containingNode);
                return n
                  ? `"${n}"`
                  : isInCustomHook
                    ? "this custom hook"
                    : "this component";
              })(),
            },
          });
        });
    },
  }),
};

export default rule;
