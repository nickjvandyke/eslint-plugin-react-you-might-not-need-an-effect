import type { Rule } from "eslint";
import {
  getArgsUpstreamRefs,
  getCallExpr,
  getUpstreamRefs,
  isSynchronous,
} from "../util/ast.ts";
import {
  getComponentName,
  isPropCall,
  isConstant,
  isRefCurrent,
  isUseState,
  isUseRef,
  isProp,
  isRefCall,
  isCustomHook,
  findEnclosingReactNode,
  getEffect,
} from "../util/react.ts";

const rule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow passing data to parents in an effect.",
      url: "https://react.dev/learn/you-might-not-need-an-effect#passing-data-to-the-parent",
    },
    schema: [],
    messages: {
      avoidPassingDataToParentInComponent:
        'Avoid passing data to parents in an effect. Instead, fetch "{{data}}" in the parent and pass it down to {{name}} as a prop.',
      avoidPassingDataToParentInHook:
        'Avoid passing data to parents in an effect. Instead, return "{{data}}" from {{name}}.',
    },
  },
  create: (context) => ({
    CallExpression: (node) => {
      const effect = getEffect(context, node);
      if (!effect || effect.cleanup) return;

      effect.fnRefs
        .filter((ref) => isSynchronous(ref.identifier as Rule.Node, effect.fn))
        .filter((ref) => isPropCall(context, ref))
        .filter((ref) => !isRefCall(context, ref))
        .forEach((ref) => {
          const callExpr = getCallExpr(ref);
          if (!callExpr) return;

          const dataArgs = getArgsUpstreamRefs(context, ref)
            // Leaves only because our "is data" check is essentially "is not all this other stuff",
            // and the "other stuff" only works on leaf nodes.
            // Mid-stream nodes are effectively nothing, and so would pass those.
            // TODO: Is there a positive way to identify "data" nodes instead of process of elimination?
            .filter((ref) => getUpstreamRefs(context, ref).length === 1)
            .filter(
              (ref) =>
                // TODO: Ideally would use isState and isRef, not the hooks.
                // But because it goes to leaves. Must be some other way?
                !isUseState(ref.identifier as Rule.Node) &&
                !isProp(context, ref) &&
                !isUseRef(ref.identifier as Rule.Node) &&
                !isRefCurrent(ref) &&
                !isConstant(ref),
            );
          if (dataArgs.length === 0) return;

          const containingNode = findEnclosingReactNode(context, node);
          const isInCustomHook = containingNode && isCustomHook(containingNode);

          context.report({
            node: callExpr,
            messageId: isInCustomHook
              ? "avoidPassingDataToParentInHook"
              : "avoidPassingDataToParentInComponent",
            data: {
              // TODO: Due to leaves above, name is the function called.
              // We'd prefer the variable name that it's assigned to.
              data: dataArgs
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
