import type { Rule, Scope } from "eslint";
import {
  getArgsUpstreamRefs,
  getCallExpr,
  isSynchronous,
} from "../util/ast.ts";
import {
  getComponentName,
  getEffectFn,
  getEffectFnRefs,
  isPropCall,
  isState,
  isUseEffect,
  isCustomHook,
  findEnclosingReactNode,
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
  create: (context: Rule.RuleContext) => ({
    CallExpression: (node: Rule.Node) => {
      if (!isUseEffect(node)) return;
      const effectFnRefs = getEffectFnRefs(context, node);
      if (!effectFnRefs) return;

      const effectFn = getEffectFn(context, node);
      if (!effectFn) return;
      effectFnRefs
        .filter((ref: Scope.Reference) =>
          isSynchronous(ref.identifier as Rule.Node, effectFn),
        )
        .filter((ref: Scope.Reference) => isPropCall(context, ref))
        .forEach((ref: Scope.Reference) => {
          const callExpr = getCallExpr(ref);
          if (!callExpr) return;

          const stateRefs = getArgsUpstreamRefs(context, ref).filter(
            (r: Scope.Reference) => isState(r),
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
