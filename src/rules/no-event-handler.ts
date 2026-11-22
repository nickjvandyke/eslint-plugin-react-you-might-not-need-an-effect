import type { Rule } from "eslint";
import {
  getDownstreamNodes,
  getDownstreamRefs,
  getUpstreamRefs,
  isSynchronous,
} from "../util/ast.ts";
import { getEffect } from "../util/effect.ts";
import { isProp } from "../util/props.ts";
import { isState } from "../util/state.ts";

const rule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow using state and an effect as an event handler.",
      url: "https://react.dev/learn/you-might-not-need-an-effect#sharing-logic-between-event-handlers",
    },
    schema: [],
    messages: {
      avoidEventHandler:
        'Avoid using state and effects as an event handler. Instead, call the code that uses "{{name}}" directly when the event occurs.',
      avoidPropHandler:
        'Avoid using props and effects as an event handler. Instead, move the code that uses "{{name}}" to the parent component.',
    },
  },
  create: (context) => ({
    CallExpression: (node) => {
      const effect = getEffect(context, node);
      if (!effect || effect.cleanup) return;

      // TODO: Can we also flag this when the deps are internal, and the body calls internal stuff?
      // That'd overlap with other rules though... maybe just useRefs?

      getDownstreamNodes(context, effect.fn, "IfStatement")
        .filter((ifNode) => !ifNode.alternate)
        .map((ifNode) => ifNode.test)
        .flatMap((ifTestNode) => getDownstreamRefs(context, ifTestNode))
        // A callback that may run later is not an event handler driven by the
        // effect, so its conditions do not count.
        .filter((ifTestRef) => isSynchronous(ifTestRef.identifier, effect.fn))
        .forEach((ifTestRef) => {
          const upstreamRefs = getUpstreamRefs(context, ifTestRef);

          const name = ifTestRef.identifier.name;

          if (upstreamRefs.some((ref) => isState(context, ref))) {
            context.report({
              node: ifTestRef.identifier,
              messageId: "avoidEventHandler",
              data: { name },
            });
          }
          if (upstreamRefs.some((ref) => isProp(context, ref))) {
            context.report({
              node: ifTestRef.identifier,
              messageId: "avoidPropHandler",
              data: { name },
            });
          }
        });
    },
  }),
};

export default rule;
