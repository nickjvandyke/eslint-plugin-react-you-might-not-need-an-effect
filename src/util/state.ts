import type { Rule, Scope } from "eslint";
import { getSynchronousCallChain, someVariableInit } from "./ast.ts";
import { isUseState } from "./hooks.ts";

// Reads the local name from a pattern element, including defaults
// like `const [count = 0, setCount] = useState()`.
const getPatternName = (
  element: Rule.Node | null | undefined,
): string | undefined => {
  if (!element) return undefined;
  if (element.type === "Identifier") return element.name;
  if (element.type === "AssignmentPattern") {
    return getPatternName(element.left);
  }
  return undefined;
};

// Whether the reference is an element of a `useState` tuple.
// Index 0 is the state value, index 1 is the setter.
const isUseStateTupleElement = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
  index: 0 | 1,
): boolean =>
  someVariableInit(ref, (init, declarator) => {
    if (
      init.type !== "CallExpression" ||
      !isUseState(context, init) ||
      declarator.id.type !== "ArrayPattern" ||
      declarator.id.elements.length > 2
    ) {
      return false;
    }
    return (
      getPatternName(declarator.id.elements[index]) === ref.identifier.name
    );
  });

export const isState = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean => isUseStateTupleElement(context, ref, 0);

export const isStateSetter = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean => isUseStateTupleElement(context, ref, 1);

export const isStateSetterCall = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean =>
  getSynchronousCallChain(context, ref).some((callChainRef) =>
    isStateSetter(context, callChainRef),
  );

export const getStateName = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): string | undefined => {
  const declarator = getUseStateDeclarator(context, ref);
  if (!declarator || declarator.id.type !== "ArrayPattern") return undefined;
  return (
    getPatternName(declarator.id.elements[0]) ??
    getPatternName(declarator.id.elements[1])
  );
};

// Callers pass a ref that is already a state setter call (filtered by
// `isStateSetterCall`), so the call chain contains the written setter.
export const getUseStateDeclarator = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): (Rule.Node & { type: "VariableDeclarator" }) | undefined => {
  // Use the setter's resolved definition, not its usage node.
  // A wrapper setter may read other state before it calls the real setter,
  // so the wrapper name is not the written one.
  const setterRef = getSynchronousCallChain(context, ref).find((chainRef) =>
    isStateSetter(context, chainRef),
  );
  const setterDecl = setterRef?.resolved?.defs.find(
    (def): def is Extract<Scope.Definition, { type: "Variable" }> =>
      def.type === "Variable",
  );
  return setterDecl?.node;
};
