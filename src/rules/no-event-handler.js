import {
  findDownstreamNodes,
  getDownstreamRefs,
  getUpstreamRefs,
} from "../util/ast.js";
import {
  getEffectFnRefs,
  hasCleanup,
  isProp,
  isState,
  isUseEffect,
} from "../util/react.js";

/**
 * @type {import("eslint").Rule.RuleModule}
 */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow using state and an effect as an event handler.",
      url: "https://react.dev/learn/you-might-not-need-an-effect#sharing-logic-between-event-handlers",
    },
    schema: [],
    messages: {
      avoidEventHandler:
        "Avoid using state and effects as an event handler. Instead, call the event handling code directly when the event occurs.",
      avoidPropHandler:
        "Avoid using props and effects as an event handler. Instead, move the handler to the parent component.",
    },
  },
  create: (context) => ({
    CallExpression: (node) => {
      if (!isUseEffect(node) || hasCleanup(node)) return;
      const effectFnRefs = getEffectFnRefs(context, node);
      if (!effectFnRefs) return;

      // TODO: Can we also flag this when the deps are internal, and the body calls internal stuff?
      // That'd overlap with other rules though... maybe just useRefs?

      findDownstreamNodes(context, node, "IfStatement")
        .filter((ifNode) => !ifNode.alternate)
        .map((ifNode) => ifNode.test)
        .flatMap((ifTestNode) => getDownstreamRefs(context, ifTestNode))
        .forEach((ifTestRef) => {
          const upstreamRefs = getUpstreamRefs(context, ifTestRef);

          if (upstreamRefs.some((ref) => isState(ref))) {
            context.report({
              node: ifTestRef.identifier,
              messageId: "avoidEventHandler",
            });
          }
          if (upstreamRefs.some((ref) => isProp(context, ref))) {
            context.report({
              node: ifTestRef.identifier,
              messageId: "avoidPropHandler",
            });
          }
        });
    },
  }),
};
