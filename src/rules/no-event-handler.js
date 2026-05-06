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

      const ifTestRefs = findDownstreamNodes(context, node, "IfStatement")
        .filter((ifNode) => !ifNode.alternate)
        .flatMap((ifNode) =>
          getDownstreamRefs(context, ifNode.test).flatMap((ref) =>
            getUpstreamRefs(context, ref),
          ),
        );

      ifTestRefs
        .filter((ref) => isState(ref))
        .forEach((ref) => {
          context.report({
            node: ref.identifier,
            messageId: "avoidEventHandler",
          });
        });

      ifTestRefs
        .filter((ref) => isProp(context, ref))
        .forEach((ref) => {
          context.report({
            node: ref.identifier,
            messageId: "avoidPropHandler",
          });
        });
    },
  }),
};
