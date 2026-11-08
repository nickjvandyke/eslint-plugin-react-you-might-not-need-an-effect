import type { Rule } from "eslint";

// TypeScript assertions and non-null checks are erased at compile time, so they
// do not change the runtime expression. `ChainExpression` is ESTree, not TS,
// but it is also a transparent wrapper around its `expression`.
const WRAPPER_TYPES: ReadonlySet<string> = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "TSInstantiationExpression",
  "ChainExpression",
]);

// Keys that hold type syntax, not runtime code.
// Analysis must skip them so `typeof state` in a type is not a reference.
const TYPE_ONLY_KEYS: ReadonlySet<string> = new Set([
  "typeAnnotation",
  "typeArguments",
  "typeParameters",
  "returnType",
  "implements",
  "superTypeArguments",
  "superTypeParameters",
]);

// A wrapper node always holds the wrapped expression in `expression`.
export type WrapperNode = Rule.Node & { expression: Rule.Node };

export const isWrapper = (node: Rule.Node): node is WrapperNode =>
  WRAPPER_TYPES.has(node.type);

export const isTypeOnlyKey = (key: string): boolean => TYPE_ONLY_KEYS.has(key);

// Reaches the runtime expression inside TypeScript-only wrappers.
export const unwrapExpression = (node: Rule.Node): Rule.Node => {
  let current = node;
  while (isWrapper(current)) {
    current = current.expression;
  }
  return current;
};

// Returns the outermost wrapper around `node`.
// The wrapper's `.parent` is the node that actually contains the expression.
export const getOutermostWrapper = (node: Rule.Node): Rule.Node => {
  let current = node;
  // `Program` has no parent, so the guard is required at runtime.
  while (current.parent && isWrapper(current.parent)) {
    current = current.parent;
  }
  return current;
};
