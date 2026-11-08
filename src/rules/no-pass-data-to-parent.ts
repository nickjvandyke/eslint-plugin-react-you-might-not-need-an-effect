import type { Rule, Scope } from "eslint";
import {
  getArgsUpstreamRefs,
  getCallExpr,
  getUpstreamRefs,
  isConstant,
  isSynchronous,
} from "../util/ast.ts";
import {
  findEnclosingComponentOrHook,
  getComponentOrHookName,
  isCustomHook,
} from "../util/components.ts";
import { getEffect } from "../util/effect.ts";
import { isUseContext, isUseRef, isUseState } from "../util/hooks.ts";
import { isProp, isPropCall } from "../util/props.ts";
import { isRefCall, isRefCurrent } from "../util/refs.ts";

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

          const dataArgs = getArgsUpstreamRefs(context, ref)
            // Leaves only because our "is data" check is essentially "is not all this other stuff",
            // and the "other stuff" only works on leaf nodes.
            // Mid-stream nodes are effectively nothing, and so would pass those.
            // TODO: Is there a positive way to identify "data" nodes instead of process of elimination?
            .filter((ref) => getUpstreamRefs(context, ref).length === 1)
            .filter((ref) => {
              // The ref may be the hook itself, e.g. `useState` from
              // `const [value] = useState()`. Resolve its call first.
              const hookCall = getCallExpr(ref);
              const isHook = (
                check: (context: Rule.RuleContext, node: Rule.Node) => boolean,
              ) => Boolean(hookCall && check(context, hookCall));
              return (
                !isHook(isUseState) &&
                !isHook(isUseContext) &&
                !isContextObject(context, ref) &&
                !isProp(context, ref) &&
                !isHook(isUseRef) &&
                !isRefCurrent(ref) &&
                !isConstant(ref)
              );
            });
          if (dataArgs.length === 0) return;

          const containingNode = findEnclosingComponentOrHook(context, node);
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

// The context object passed to `useContext` is never data.
// `getArgsUpstreamRefs` can reach it through the `useContext` call that
// declares the value we actually pass to the parent.
const isContextObject = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean => {
  const identifier = ref.identifier;
  const parent = identifier.parent;
  return (
    parent.type === "CallExpression" &&
    parent.arguments.includes(identifier) &&
    isUseContext(context, parent)
  );
};

export default rule;
