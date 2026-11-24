import type { Rule } from "eslint";
import {
  findEnclosingComponentOrHook,
  isCustomHook,
} from "../util/components.ts";
import { getEffect } from "../util/effect.ts";
import { findPropUsedToResetAllState } from "../util/reset.ts";

const rule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow resetting all state in an effect when a prop changes.",
      url: "https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes",
    },
    schema: [],
    messages: {
      avoidResettingAllStateWhenAPropChanges:
        'Avoid resetting all state when a prop changes. Instead, if "{{prop}}" is a key, pass it as "key" so React will reset the component\'s state.',
    },
  },
  create: (context) => ({
    CallExpression: (node) => {
      const effect = getEffect(context, node);
      if (!effect) return;
      // Skip custom hooks because they can't receive `key` like components can.
      const containingNode = findEnclosingComponentOrHook(context, node);
      if (containingNode && isCustomHook(containingNode)) return;

      const propUsedToResetAllState = findPropUsedToResetAllState(
        context,
        effect,
        node,
      );

      if (propUsedToResetAllState) {
        context.report({
          node: node,
          messageId: "avoidResettingAllStateWhenAPropChanges",
          data: { prop: propUsedToResetAllState.identifier.name },
        });
      }
    },
  }),
};

export default rule;
