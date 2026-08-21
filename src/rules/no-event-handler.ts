import type { Rule } from "eslint";
import {
  findDownstreamNodes,
  getDownstreamRefs,
  getUpstreamRefs,
} from "../util/ast.ts";
import { isProp, isState, getEffect } from "../util/react.ts";

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

      findDownstreamNodes(context, effect.fn, "IfStatement")
        .filter(
          (
            ifNode,
          ): ifNode is Rule.Node & {
            type: "IfStatement";
            test: Rule.Node;
            alternate: Rule.Node | null;
          } => ifNode.type === "IfStatement" && !ifNode.alternate,
        )
        .map((ifNode) => ifNode.test)
        .flatMap((ifTestNode) => getDownstreamRefs(context, ifTestNode))
        .forEach((ifTestRef) => {
          const upstreamRefs = getUpstreamRefs(context, ifTestRef);

          const name = ifTestRef.identifier.name;

          if (upstreamRefs.some((ref) => isState(ref))) {
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
