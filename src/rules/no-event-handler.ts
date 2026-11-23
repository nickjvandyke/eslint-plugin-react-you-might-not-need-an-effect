import type { Rule, Scope } from "eslint";
import {
  getDefinitionValueNode,
  getDownstreamNodes,
  getDownstreamRefs,
  getSynchronousCallChain,
  getUpstreamRefs,
  isDefined,
  isFunction,
  isSynchronous,
  type FunctionNode,
} from "../util/ast.ts";
import { getEffect, type Effect } from "../util/effect.ts";
import { isProp } from "../util/props.ts";
import { isState } from "../util/state.ts";
import { unwrapExpression } from "../util/typescript.ts";

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

      getSynchronousFunctions(context, effect).forEach((fn) => {
        getDownstreamNodes(context, fn, "IfStatement")
          .filter((ifNode) => !ifNode.alternate)
          .map((ifNode) => ifNode.test)
          .flatMap((ifTestNode) => getDownstreamRefs(context, ifTestNode))
          // A callback that may run later is not an event handler driven by the
          // effect, so its conditions do not count.
          .filter((ifTestRef) => isSynchronous(ifTestRef.identifier, fn))
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
      });
    },
  }),
};

/** The function held by a definition, if the definition holds one. */
const getFunctionNode = (def: Scope.Definition): FunctionNode | undefined => {
  // A `FunctionDeclaration` is already the function node.
  if (def.type === "FunctionName") return def.node;
  const valueNode = getDefinitionValueNode(def);
  if (!valueNode) return undefined;
  const resolved = unwrapExpression(valueNode);
  return isFunction(resolved) ? resolved : undefined;
};

/**
 * Returns every function that runs to completion when the effect runs: the
 * effect function itself, plus each helper it calls synchronously, directly or
 * through other helpers.
 */
const getSynchronousFunctions = (
  context: Rule.RuleContext,
  effect: Effect,
): Set<FunctionNode> => {
  const functions = new Set<FunctionNode>([effect.fn]);

  effect.fnRefs
    .filter((ref) => isSynchronous(ref.identifier, effect.fn))
    .flatMap((ref) => getSynchronousCallChain(context, ref))
    .flatMap((ref) => ref.resolved?.defs ?? [])
    .map(getFunctionNode)
    .filter(isDefined)
    .forEach((fn) => functions.add(fn));

  return functions;
};

export default rule;
