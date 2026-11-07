import type { Scope, Rule } from "eslint";
import {
  getSynchronousCallChain,
  isFunctionExpression,
  someVariableInit,
} from "./ast.ts";
import { isComponent, isCustomHook, isHOC } from "./components.ts";
import { isUseContext } from "./hooks.ts";
import { getOutermostWrapper } from "./typescript.ts";

// Returns false for props of HOCs (e.g. `withRouter`) because they usually have side effects.
// Also returns true for `useContext` values, because they are owned by an ancestor
// and change outside the component, just like props.
export const isProp = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean =>
  someVariableInit(
    ref,
    (init) => init.type === "CallExpression" && isUseContext(context, init),
  ) ||
  (ref.resolved?.defs ?? []).some((def) => {
    let declaringNode: Rule.Node = def.node;
    if (isFunctionExpression(declaringNode)) {
      declaringNode = getOutermostWrapper(declaringNode).parent;
      if (declaringNode.type === "CallExpression") {
        declaringNode = getOutermostWrapper(declaringNode).parent;
      }
    }
    return (
      def.type === "Parameter" &&
      ((isComponent(declaringNode) && !isHOC(context, declaringNode)) ||
        isCustomHook(declaringNode))
    );
  });

export const isPropCall = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean =>
  getSynchronousCallChain(context, ref).some((callChainRef) =>
    isProp(context, callChainRef),
  );
