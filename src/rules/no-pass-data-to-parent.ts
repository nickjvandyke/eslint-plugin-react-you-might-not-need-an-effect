import type { Rule } from "eslint";
import {
  getArgsUpstreamRefs,
  getCallExpr,
  getDownstreamRefs,
  isSynchronous,
} from "../util/ast.ts";
import {
  findEnclosingComponentOrHook,
  getComponentOrHookName,
  isCustomHook,
} from "../util/components.ts";
import { getEffect } from "../util/effect.ts";
import {
  isExternalHookValue,
  isExternalSource,
  isProp,
  isPropCall,
} from "../util/props.ts";
import { isRefCall } from "../util/refs.ts";

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
        "Avoid passing data to parents in an effect. Instead, fetch {{data}} in the parent and pass it down to {{name}} as a prop.",
      avoidPassingDataToParentInHook:
        "Avoid passing data to parents in an effect. Instead, return {{data}} from {{name}}.",
    },
  },
  create: (context) => ({
    CallExpression: (node) => {
      const effect = getEffect(context, node);
      if (!effect || effect.cleanup) return;

      effect.fnRefs
        .filter((ref) => isSynchronous(ref.identifier, effect.fn))
        .filter((ref) => isPropCall(context, ref))
        .filter((ref) => !isRefCall(context, ref))
        .forEach((ref) => {
          const callExpr = getCallExpr(ref);
          if (!callExpr) return;

          // A parent callback that receives data can be replaced: the parent
          // can read that data itself. Three sources count as data:
          // - an external hook value, including aliases and derived values
          // - a global, or a call on a global or imported function
          // - a call on a prop, which the parent can call directly
          const names = [
            ...getArgsUpstreamRefs(context, ref)
              .filter((argRef) => isExternalHookValue(context, argRef))
              .map((argRef) => argRef.identifier.name),
            ...callExpr.arguments
              .flatMap((arg) => getDownstreamRefs(context, arg))
              .filter(
                (argRef) =>
                  isExternalSource(argRef) ||
                  (isProp(context, argRef) &&
                    getCallExpr(argRef) !== undefined),
              )
              .map((argRef) => argRef.identifier.name),
          ];
          const dataNames = [...new Set(names)];
          if (dataNames.length === 0) return;

          const containingNode = findEnclosingComponentOrHook(context, node);
          const isInCustomHook = containingNode && isCustomHook(containingNode);

          context.report({
            node: callExpr,
            messageId: isInCustomHook
              ? "avoidPassingDataToParentInHook"
              : "avoidPassingDataToParentInComponent",
            data: {
              data: dataNames.map((n) => `"${n}"`).join(" and "),
              name: (() => {
                const n = getComponentOrHookName(containingNode);
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
