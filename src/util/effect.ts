import type { Rule } from "eslint";
import { getDownstreamRefs, getRef, isFunctionExpression } from "./ast.ts";
import { isUseEffect } from "./hooks.ts";
import { unwrapExpression } from "./typescript.ts";

const getEffectFn = (
  context: Rule.RuleContext,
  node: Rule.Node,
): Rule.Node | undefined => {
  if (node.type !== "CallExpression") return undefined;
  const effectFnArg = node.arguments[0] as Rule.Node | undefined;
  if (!effectFnArg) return undefined;
  const effectFn = unwrapExpression(effectFnArg);
  if (isFunctionExpression(effectFn)) {
    return effectFn;
  } else if (effectFn.type === "Identifier") {
    const ref = getRef(context, effectFn);
    const def = ref?.resolved?.defs[0];
    if (!def) return undefined;
    const init = (def.node as Rule.Node & { init?: Rule.Node }).init;
    return (
      (init && unwrapExpression(init)) ??
      (def.node as Rule.Node & { body?: Rule.Node }).body
    );
  }

  return undefined;
};

const getEffectDeps = (node: Rule.Node): Rule.Node | undefined => {
  if (node.type !== "CallExpression") return undefined;
  const deps = node.arguments[1] as Rule.Node | undefined;
  return deps && unwrapExpression(deps);
};

const getEffectCleanup = (
  effectFn: Rule.Node,
): (Rule.Node & { type: "ReturnStatement" }) | undefined => {
  if (
    !isFunctionExpression(effectFn) ||
    effectFn.body.type !== "BlockStatement"
  )
    return undefined;

  return (
    effectFn.body.body
      .concat()
      .reverse()
      // Check `.argument` so we don't consider bare `return`s
      .find((stmt) => stmt.type === "ReturnStatement" && stmt.argument) as
      | (Rule.Node & { type: "ReturnStatement" })
      | undefined
  );
};

export const getEffect = (context: Rule.RuleContext, node: Rule.Node) => {
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
