import type { Rule, Scope } from "eslint";
import {
  getArgsUpstreamRefs,
  getCallExpr,
  getUpstreamRefs,
  isDefined,
  isSynchronous,
} from "../util/ast.ts";
import { getEffect } from "../util/effect.ts";
import { isRef, isRefCurrent } from "../util/refs.ts";
import { getStateName, isStateSetterCall } from "../util/state.ts";

const rule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow storing derived state in an effect.",
      url: "https://react.dev/learn/you-might-not-need-an-effect#updating-state-based-on-props-or-state",
    },
    schema: [],
    messages: {
      avoidDerivedState:
        'Avoid storing derived state. Instead, compute "{{state}}" directly during render.',
    },
  },
  create: (context) => ({
    CallExpression: (node) => {
      const effect = getEffect(context, node);
      if (!effect || effect.cleanup) return;

      // Every dependency is available during render, by definition.
      // Include their upstream references so a derived dependency (e.g.
      // `const name = firstName + lastName`) still matches `firstName`.
      // An omitted dependency array yields no dependencies, so mount-only
      // effects fall out here (`no-initialize-state` covers those).
      const depVariables = new Set(
        effect.depsRefs
          .flatMap((ref) => [ref, ...getUpstreamRefs(context, ref)])
          .map((ref) => getRenderVariable(context, ref))
          .filter(isDefined),
      );
      if (depVariables.size === 0) return;

      effect.fnRefs
        .filter((ref) => isSynchronous(ref.identifier, effect.fn))
        .filter((ref) => isStateSetterCall(context, ref))
        .forEach((ref) => {
          const callExpr = getCallExpr(ref);
          if (!callExpr) return;

          // If any value written to state comes from an effect dependency, the
          // state can be computed during render instead.
          const isSomeArgsFromDeps = getArgsUpstreamRefs(context, ref).some(
            (argRef) => {
              const variable = getRenderVariable(context, argRef);
              return variable !== undefined && depVariables.has(variable);
            },
          );
          if (!isSomeArgsFromDeps) return;

          const stateName = getStateName(context, ref);
          if (!stateName) return;

          context.report({
            node: callExpr,
            messageId: "avoidDerivedState",
            data: { state: stateName },
          });
        });
    },
  }),
};

// Returns the variable behind a reference when React evaluates it during render.
// Globals, imported bindings, and refs are excluded:
// - Globals and imports are not re-created per render.
// - `ref.current` is only updated after render, so it is not render-safe.
const getRenderVariable = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): Scope.Variable | undefined => {
  const variable = ref.resolved;
  if (!variable || variable.defs.length === 0) return undefined;
  const isImport = variable.defs.some((def) => def.type === "ImportBinding");
  if (isImport || isRef(context, ref) || isRefCurrent(ref)) return undefined;
  return variable;
};

export default rule;
