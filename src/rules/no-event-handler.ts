import type { Rule, Scope } from "eslint";
import {
  findDownstreamNodes,
  getDownstreamRefs,
  getUpstreamRefs,
} from "../util/ast.ts";
import {
  getEffectFn,
  getEffectFnRefs,
  hasCleanup,
  isProp,
  isState,
  isUseEffect,
} from "../util/react.ts";

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
        "Avoid using state and effects as an event handler. Instead, call the event handling code directly when the event occurs.",
      avoidPropHandler:
        "Avoid using props and effects as an event handler. Instead, move the handler to the parent component.",
    },
  },
  create: (context: Rule.RuleContext) => ({
    CallExpression: (node: Rule.Node) => {
      if (!isUseEffect(node) || hasCleanup(node)) return;
      const effectFnRefs = getEffectFnRefs(context, node);
      if (!effectFnRefs) return;

      // TODO: Can we also flag this when the deps are internal, and the body calls internal stuff?
      // That'd overlap with other rules though... maybe just useRefs?

      const effectFn = getEffectFn(node);
      if (!effectFn) return;

      findDownstreamNodes(context, effectFn, "IfStatement")
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
        .flatMap((ifTestNode: Rule.Node) =>
          getDownstreamRefs(context, ifTestNode),
        )
        .forEach((ifTestRef: Scope.Reference) => {
          const upstreamRefs = getUpstreamRefs(context, ifTestRef);

          if (upstreamRefs.some((ref: Scope.Reference) => isState(ref))) {
            context.report({
              node: ifTestRef.identifier,
              messageId: "avoidEventHandler",
            });
          }
          if (
            upstreamRefs.some((ref: Scope.Reference) => isProp(context, ref))
          ) {
            context.report({
              node: ifTestRef.identifier,
              messageId: "avoidPropHandler",
            });
          }
        });
    },
  }),
};

export default rule;
