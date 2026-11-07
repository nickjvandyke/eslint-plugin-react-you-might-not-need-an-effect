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

export const isWrapper = (node: Rule.Node): boolean =>
  WRAPPER_TYPES.has(node.type as string);

export const isTypeOnlyKey = (key: string): boolean => TYPE_ONLY_KEYS.has(key);

// Reaches the runtime expression inside TypeScript-only wrappers.
export const unwrapExpression = (node: { type: string }): Rule.Node => {
  let current = node as unknown as Rule.Node;
  while (isWrapper(current)) {
    current = (current as Rule.Node & { expression: Rule.Node }).expression;
  }
  return current;
};

// Returns the outermost wrapper around `node`.
// The wrapper's `.parent` is the node that actually contains the expression.
export const outermostWrapper = (node: Rule.Node): Rule.Node => {
  let current = node;
  while (current.parent && isWrapper(current.parent)) {
    current = current.parent;
  }
  return current;
};
