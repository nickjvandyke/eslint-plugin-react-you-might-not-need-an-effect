import type { Rule, Scope } from "eslint";
import {
  getDefinitionValueNode,
  getDownstreamRefs,
  getRef,
  isFunctionExpression,
  type ReturnStatementNode,
} from "./ast.ts";
import { isUseEffect } from "./hooks.ts";
import { unwrapExpression } from "./typescript.ts";

// A cleanup return always has an argument, because bare `return`s are skipped.
export type CleanupReturn = ReturnStatementNode & { argument: Rule.Node };

export interface Effect {
  fn: Rule.Node;
  fnRefs: Scope.Reference[];
  depsRefs: Scope.Reference[];
  cleanup: CleanupReturn | undefined;
}

const getEffectFn = (
  context: Rule.RuleContext,
  node: Rule.Node,
): Rule.Node | undefined => {
  if (node.type !== "CallExpression") return undefined;
  const [effectFnArg] = node.arguments;
  if (!effectFnArg) return undefined;
  const effectFn = unwrapExpression(effectFnArg);
  if (isFunctionExpression(effectFn)) {
    return effectFn;
  } else if (effectFn.type === "Identifier") {
    const def = getRef(context, effectFn)?.resolved?.defs[0];
    const valueNode = def && getDefinitionValueNode(def);
    return valueNode && unwrapExpression(valueNode);
  }

  return undefined;
};

const getEffectDeps = (node: Rule.Node): Rule.Node | undefined => {
  if (node.type !== "CallExpression") return undefined;
  const deps = node.arguments[1];
  return deps ? unwrapExpression(deps) : undefined;
};

const getEffectCleanup = (effectFn: Rule.Node): CleanupReturn | undefined => {
  if (
    !isFunctionExpression(effectFn) ||
    effectFn.body.type !== "BlockStatement"
  )
    return undefined;

  return [...effectFn.body.body].reverse().find(
    // Check `.argument` so we don't consider bare `return`s
    (stmt): stmt is CleanupReturn =>
      stmt.type === "ReturnStatement" && stmt.argument !== null,
  );
};

export const getEffect = (
  context: Rule.RuleContext,
  node: Rule.Node,
): Effect | undefined => {
  if (!isUseEffect(context, node)) return undefined;

  const fn = getEffectFn(context, node);
  if (!fn) return undefined;

  const deps = getEffectDeps(node);

  return {
    fn,
    fnRefs: getDownstreamRefs(context, fn),
    // No dependency array means the effect runs after every render.
    // Treat that as empty so mount-only rules still apply.
    // A dependency variable stays non-empty, so it is not treated as mount.
    depsRefs: deps ? getDownstreamRefs(context, deps) : [],
    cleanup: getEffectCleanup(fn),
  };
};
