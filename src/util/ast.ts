import type { Scope, Rule } from "eslint";

export const ascend = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
  visit: (ref: Scope.Reference) => boolean | undefined,
  visited: Set<Scope.Reference> = new Set(),
): void => {
  if (visited.has(ref)) {
    return;
  }
  const cont = visit(ref);
  visited.add(ref);
  if (cont === false) {
    return;
  }

  ref.resolved?.defs
    // We have no analytical use for import statements; terminate at the previous reference (actually using the imported thing).
    .filter((def) => def.type !== "ImportBinding")
    // Don't traverse parameter definitions.
    // Their definition node is the function, so downstream would include the whole function body.
    .filter((def) => def.type !== "Parameter")
    // `def.node.init` is for ArrowFunctionExpression, VariableDeclarator, (etc?).
    // `def.node.body` is for FunctionDeclaration.
    .map(
      (def) =>
        (def.node as Rule.Node & { init?: Rule.Node }).init ??
        (def.node as Rule.Node & { body?: Rule.Node }).body,
    )
    .filter((n): n is Rule.Node => Boolean(n))
    .flatMap((node) => getDownstreamRefs(context, node))
    .forEach((ref) => ascend(context, ref, visit, visited));
};

export const descend = (
  context: Rule.RuleContext,
  node: Rule.Node,
  visit: (node: Rule.Node) => void,
  visited: Set<Rule.Node> = new Set(),
): void => {
  if (visited.has(node)) {
    return;
  }
  visit(node);
  visited.add(node);

  (context.sourceCode.visitorKeys[node.type] || [])
    // Many times simpler to just ignore arguments (to CallExpressions and NewExpressions).
    // Too complicated to follow them, and often we can't at all (imported functions).
    // Assuming they are used in a particular way introduces false positives, and sometimes libraries _intend_ for such uses.
    // Ignoring introduces some false negatives for uncommon patterns, but that's much preferred.
    .filter((key) => key !== "arguments")
    .map((key) => (node as unknown as Record<string, unknown>)[key])
    // Some `visitorKeys` are optional, e.g. `IfStatement.alternate`.
    .filter(Boolean)
    // Can be an array, like `CallExpression.arguments`
    .flatMap((child) => (Array.isArray(child) ? child : [child]))
    // Can rarely be `null`, e.g. `ArrayPattern.elements[1]` when an element is skipped - `const [a, , b] = arr`
    .filter(Boolean)
    .forEach((child) => descend(context, child as Rule.Node, visit, visited));
};

export const getUpstreamRefs = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): Scope.Reference[] => {
  const refs: Scope.Reference[] = [];
  ascend(context, ref, (upRef) => {
    refs.push(upRef);
    return undefined;
  });
  return refs;
};

export const findDownstreamNodes = (
  context: Rule.RuleContext,
  topNode: Rule.Node,
  type: string,
): Rule.Node[] => {
  const nodes: Rule.Node[] = [];
  descend(context, topNode, (node) => {
    if (node.type === type) {
      nodes.push(node);
    }
  });
  return nodes;
};

export const getDownstreamRefs = (
  context: Rule.RuleContext,
  node: Rule.Node,
): Scope.Reference[] =>
  findDownstreamNodes(context, node, "Identifier")
    .map((identifier) => getRef(context, identifier))
    .filter(Boolean) as Scope.Reference[];

export const getCallExpr = (
  ref: Scope.Reference,
  current: Rule.Node = (ref.identifier as Rule.Node).parent,
): Rule.Node | undefined => {
  if (current.type === "CallExpression") {
    // We've reached the top - confirm that the ref is the (eventual) callee, as opposed to an argument.
    let node: Rule.Node = ref.identifier as Rule.Node;
    while (node.parent.type === "MemberExpression") {
      node = node.parent;
    }

    if (current.callee === node) {
      return current;
    }
  }

  if (current.type === "MemberExpression") {
    return getCallExpr(ref, current.parent);
  }

  return undefined;
};

export const getArgsUpstreamRefs = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): Scope.Reference[] =>
  getUpstreamRefs(context, ref)
    .map((ref) => getCallExpr(ref))
    .filter(Boolean)
    .flatMap((callExpr) => {
      if (!callExpr || callExpr.type !== "CallExpression") return [];
      return callExpr.arguments as Rule.Node[];
    })
    .flatMap((arg) => getDownstreamRefs(context, arg))
    .flatMap((ref) => getUpstreamRefs(context, ref));

export const getRef = (
  context: Rule.RuleContext,
  identifier: Rule.Node,
): Scope.Reference | undefined =>
  context.sourceCode
    .getScope(identifier)
    ?.references.find((ref) => ref.identifier == identifier);

export const isSynchronous = (node: Rule.Node, within: Rule.Node): boolean => {
  if (node === within) {
    // Reached the top without finding any blocking conditions
    return true;
  } else if (
    node.type === "AwaitExpression" ||
    (node.type === "UnaryExpression" && node.operator === "void") ||
    // Inside a named or anonymous function that may be called later, either as a callback or by the developer.
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  ) {
    return false;
  } else {
    return isSynchronous(node.parent, within);
  }
};

export const getSynchronousCallChain = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): Scope.Reference[] => {
  const findEnclosingFunction = (
    node: Rule.Node | undefined,
  ): Rule.Node | undefined => {
    if (!node) {
      return undefined;
    } else if (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"
    ) {
      return node;
    } else {
      return findEnclosingFunction(node.parent);
    }
  };

  const callExprRefs: Scope.Reference[] = [];
  ascend(context, ref, (upRef) => {
    const callExpr = getCallExpr(upRef);
    const enclosingFn = findEnclosingFunction(callExpr);
    if (callExpr && enclosingFn && isSynchronous(callExpr, enclosingFn)) {
      callExprRefs.push(upRef);
    } else {
      return false;
    }
  });
  return callExprRefs;
};
