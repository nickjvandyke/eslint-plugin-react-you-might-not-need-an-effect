import type { Scope, Rule } from "eslint";
import { isTypeOnlyKey, isWrapper, unwrapExpression } from "./typescript.ts";

export type FunctionNode = Extract<
  Rule.Node,
  {
    type:
      | "FunctionDeclaration"
      | "FunctionExpression"
      | "ArrowFunctionExpression";
  }
>;

export type FunctionExpressionNode = Extract<
  FunctionNode,
  { type: "FunctionExpression" | "ArrowFunctionExpression" }
>;

export type CallExpressionNode = Extract<Rule.Node, { type: "CallExpression" }>;

export type VariableDeclaratorNode = Extract<
  Rule.Node,
  { type: "VariableDeclarator" }
>;

export type ReturnStatementNode = Extract<
  Rule.Node,
  { type: "ReturnStatement" }
>;

// Type guard for `Array.prototype.filter` that also removes `null`.
export const isDefined = <T>(value: T | null | undefined): value is T =>
  value != null;

// AST nodes are objects with a `type` property. Used to validate children that
// come from `visitorKeys`, which are typed as `unknown`.
const isNode = (value: unknown): value is Rule.Node =>
  typeof value === "object" && value !== null && "type" in value;

export const isFunction = (node: Rule.Node): node is FunctionNode =>
  node.type === "FunctionDeclaration" ||
  node.type === "FunctionExpression" ||
  node.type === "ArrowFunctionExpression";

export const isFunctionExpression = (
  node: Rule.Node,
): node is FunctionExpressionNode =>
  node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression";

// Returns the node that holds a definition's runtime value: the initializer of
// a variable, or the body of a function, class, or catch clause.
// Returns `undefined` for definitions that have no analyzable value.
export const getDefinitionValueNode = (
  def: Scope.Definition,
): Rule.Node | undefined => {
  switch (def.type) {
    case "Variable":
      return def.node.init ?? undefined;
    case "FunctionName":
    case "ClassName":
    case "CatchClause":
      return def.node.body;
    default:
      // Import bindings are opaque: analysis must terminate at the import usage,
      // not at the imported module. Parameters would pull in the whole function
      // body, so they are ignored too.
      return undefined;
  }
};

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

  (ref.resolved?.defs ?? [])
    .map(getDefinitionValueNode)
    .filter(isDefined)
    .flatMap((node) => getDownstreamRefs(context, node))
    .forEach((ref) => ascend(context, ref, visit, visited));
};

export const descend = (
  context: Rule.RuleContext,
  node: Rule.Node,
  visit: (node: Rule.Node) => void,
  // Call arguments are skipped by default. Set this to walk them too.
  options: { includeArguments?: boolean } = {},
  visited: Set<Rule.Node> = new Set(),
): void => {
  if (visited.has(node)) {
    return;
  }
  visit(node);
  visited.add(node);

  const { includeArguments = false } = options;

  (context.sourceCode.visitorKeys[node.type] ?? [])
    // Many times simpler to just ignore arguments (to CallExpressions and NewExpressions).
    // Too complicated to follow them, and often we can't at all (imported functions).
    // Assuming they are used in a particular way introduces false positives, and sometimes libraries _intend_ for such uses.
    // Ignoring introduces some false negatives for uncommon patterns, but that's much preferred.
    // Also ignore type-only keys: they hold no runtime references.
    .filter(
      (key) => (includeArguments || key !== "arguments") && !isTypeOnlyKey(key),
    )
    .flatMap((key): unknown[] => {
      const child: unknown = Reflect.get(node, key);
      return Array.isArray(child) ? child : [child];
    })
    // Children can be absent (optional `visitorKeys`, skipped array holes).
    .filter(isNode)
    .forEach((child) => descend(context, child, visit, options, visited));
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

export const getDownstreamNodes = <T extends Rule.Node["type"]>(
  context: Rule.RuleContext,
  topNode: Rule.Node,
  type: T,
  options: { includeArguments?: boolean } = {},
): Extract<Rule.Node, { type: T }>[] => {
  const nodes: Extract<Rule.Node, { type: T }>[] = [];
  descend(
    context,
    topNode,
    (node) => {
      if (node.type === type) {
        // `node.type` does not narrow through a generic type parameter.
        nodes.push(node as Extract<Rule.Node, { type: T }>);
      }
    },
    options,
  );
  return nodes;
};

export const getDownstreamRefs = (
  context: Rule.RuleContext,
  node: Rule.Node,
  options: { includeArguments?: boolean } = {},
): Scope.Reference[] =>
  getDownstreamNodes(context, node, "Identifier", options)
    .map((identifier) => getRef(context, identifier))
    .filter(isDefined);

// Finds the call expression that invokes the reference, if any.
// Walks up through member accesses (`fn`, `obj.fn`, `obj.a.fn`) and transparent
// TypeScript wrappers. Returns `undefined` when the reference is not the
// eventual callee, e.g. when it is an argument.
export const getCallExpr = (
  ref: Scope.Reference,
): CallExpressionNode | undefined => {
  let node: Rule.Node = ref.identifier;
  while (node.parent.type === "MemberExpression" || isWrapper(node.parent)) {
    node = node.parent;
  }

  return node.parent.type === "CallExpression" && node.parent.callee === node
    ? node.parent
    : undefined;
};

export const getArgsUpstreamRefs = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): Scope.Reference[] =>
  getUpstreamRefs(context, ref)
    .flatMap((upRef) => getCallExpr(upRef)?.arguments ?? [])
    .flatMap((arg) => getDownstreamRefs(context, arg))
    .flatMap((ref) => getUpstreamRefs(context, ref));

export const getRef = (
  context: Rule.RuleContext,
  identifier: Rule.Node,
): Scope.Reference | undefined =>
  context.sourceCode
    .getScope(identifier)
    ?.references.find((ref) => ref.identifier === identifier);

// Runs `check` on the unwrapped initializer of each variable that defines the
// reference. Returns true when any definition matches.
export const someVariableInit = (
  ref: Scope.Reference,
  check: (init: Rule.Node, declarator: VariableDeclaratorNode) => boolean,
): boolean =>
  (ref.resolved?.defs ?? []).some((def) => {
    if (def.type !== "Variable" || !def.node.init) {
      return false;
    }
    return check(unwrapExpression(def.node.init), def.node);
  });

export const isConstant = (ref: Scope.Reference): boolean =>
  someVariableInit(
    ref,
    (init) =>
      init.type === "Literal" ||
      init.type === "TemplateLiteral" ||
      init.type === "ArrayExpression" ||
      init.type === "ObjectExpression",
  );

export const isSynchronous = (node: Rule.Node, within: Rule.Node): boolean => {
  if (node === within) {
    // Reached the top without finding any blocking conditions
    return true;
  } else if (
    node.type === "AwaitExpression" ||
    (node.type === "UnaryExpression" && node.operator === "void") ||
    // Inside a named or anonymous function that may be called later, either as a callback or by the developer.
    isFunction(node)
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
    } else if (isFunction(node)) {
      return node;
    } else {
      return findEnclosingFunction(node.parent);
    }
  };

  const isAliasRef = (ref: Scope.Reference): boolean => {
    const containerParents = [
      "Property",
      "ObjectExpression",
      "ArrayExpression",
      "SequenceExpression",
      "ChainExpression",
    ];
    let node: Rule.Node = ref.identifier;
    while (true) {
      const parent: Rule.Node = node.parent;
      if (parent.type === "VariableDeclarator" && parent.init === node) {
        return (
          parent.parent?.type === "VariableDeclaration" &&
          // Only `const` aliases are stable. A reassigned alias may point somewhere else
          // by the time it is used, e.g. `let set = setState; set = otherSetter; set(0)`.
          // `let` is rare so we choose to ignore it for simplicity.
          parent.parent.kind === "const"
        );
      }
      // The ref is the object of a member access, e.g. `props.onChange`.
      // Follow only the object position so we ignore property positions.
      if (parent.type === "MemberExpression" && parent.object === node) {
        node = parent;
        continue;
      }
      // TypeScript wrappers are transparent, e.g. `const f = (props.onChange as Handler)`.
      if (isWrapper(parent)) {
        node = parent;
        continue;
      }
      if (containerParents.includes(parent.type)) {
        node = parent;
        continue;
      }
      return false;
    }
  };

  // Only a ref that is itself invoked can start a synchronous call chain.
  // An alias that is never called (e.g. `const set = setState`) is not a call.
  if (!getCallExpr(ref)) {
    return [];
  }

  const callExprRefs: Scope.Reference[] = [];
  ascend(context, ref, (upRef) => {
    const callExpr = getCallExpr(upRef);
    const enclosingFn = findEnclosingFunction(callExpr);
    if (callExpr && enclosingFn && isSynchronous(callExpr, enclosingFn)) {
      callExprRefs.push(upRef);
    } else if (isAliasRef(upRef)) {
      callExprRefs.push(upRef);
    } else {
      return false;
    }
  });
  return callExprRefs;
};
