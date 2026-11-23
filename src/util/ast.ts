import type { Scope, Rule } from "eslint";
import {
  getOutermostWrapper,
  isTypeOnlyKey,
  isWrapper,
  unwrapExpression,
} from "./typescript.ts";

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

/** Type guard for `Array.prototype.filter` that also removes `null`. */
export const isDefined = <T>(value: T | null | undefined): value is T =>
  value != null;

/**
 * AST nodes are objects with a `type` property. Used to validate children that
 * come from `visitorKeys`, which are typed as `unknown`.
 */
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

/** Hooks start with `use` and then an uppercase letter or a digit. */
const HOOK_NAME = /^use[A-Z0-9]/;

/** True when `name` is a hook name. */
export const isHookName = (name: string): boolean => HOOK_NAME.test(name);

/**
 * Hooks whose return value is computed from their arguments.
 * Every other hook returns a new value, and its arguments only configure it.
 */
const ARGUMENT_DERIVED_HOOKS: ReadonlySet<string> = new Set([
  "useMemo",
  "useCallback",
]);

/** The name of a call's callee, e.g. `useState` in `React.useState(value)`. */
const getCalleeName = (callee: Rule.Node): string | undefined => {
  const node = unwrapExpression(callee);
  if (node.type === "Identifier") {
    return node.name;
  } else if (
    node.type === "MemberExpression" &&
    !node.computed &&
    node.property.type === "Identifier"
  ) {
    return node.property.name;
  }
  return undefined;
};

/**
 * Returns the call at the root of a member chain, e.g. `useQuery(id)` in
 * `useQuery(id).data`.
 */
const getRootCall = (node: Rule.Node): Rule.Node => {
  let current = unwrapExpression(node);
  while (current.type === "MemberExpression") {
    current = unwrapExpression(current.object);
  }
  return current;
};

/**
 * True when `node` is a value of a hook call that returns a value independent
 * of its arguments, e.g. `useState(initialValue)` or `useQuery({ queryKey })`.
 */
const isHookRoot = (node: Rule.Node): boolean => {
  const root = getRootCall(node);
  if (root.type !== "CallExpression") return false;
  const name = getCalleeName(root.callee);
  return (
    name !== undefined && isHookName(name) && !ARGUMENT_DERIVED_HOOKS.has(name)
  );
};

/**
 * Returns the node that holds a definition's runtime value: the initializer of
 * a variable, or the body of a function, class, or catch clause.
 * Returns `undefined` for definitions that have no analyzable value.
 */
export const getDefinitionValueNode = (
  def: Scope.Definition,
): Rule.Node | undefined => {
  switch (def.type) {
    case "Variable": {
      const init = def.node.init;
      // A hook value is a new root, not a value derived from its arguments.
      // `useState(prop)` and `useQuery({ queryKey: [state] })` must stop here.
      if (init && isHookRoot(unwrapExpression(init))) {
        return undefined;
      }
      return init ?? undefined;
    }
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

/**
 * Walks upstream from a reference. Visits the reference, then the references
 * inside each of its definitions. The walk stops at import bindings and
 * function parameters, and visits each reference once.
 *
 * `visit` returns `false` to stop the walk at that branch.
 */
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

/**
 * Walks every descendant of `node` using the visitor keys of the current
 * parser. Skips type-only keys, which hold no runtime references, and visits
 * each node once.
 */
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

  (context.sourceCode.visitorKeys[node.type] ?? [])
    // Ignore type-only keys: they hold no runtime references.
    .filter((key) => !isTypeOnlyKey(key))
    .flatMap((key): unknown[] => {
      const child: unknown = Reflect.get(node, key);
      return Array.isArray(child) ? child : [child];
    })
    // Children can be absent (optional `visitorKeys`, skipped array holes).
    .filter(isNode)
    .forEach((child) => descend(context, child, visit, visited));
};

/** Every reference reachable upstream from `ref`, including `ref` itself. */
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

/** Every descendant node of `topNode` whose `type` matches `type`. */
export const getDownstreamNodes = <T extends Rule.Node["type"]>(
  context: Rule.RuleContext,
  topNode: Rule.Node,
  type: T,
): Extract<Rule.Node, { type: T }>[] => {
  const nodes: Extract<Rule.Node, { type: T }>[] = [];
  descend(context, topNode, (node) => {
    if (node.type === type) {
      // `node.type` does not narrow through a generic type parameter.
      nodes.push(node as Extract<Rule.Node, { type: T }>);
    }
  });
  return nodes;
};

/** Every identifier descendant of `node`, resolved to a scope reference. */
export const getDownstreamRefs = (
  context: Rule.RuleContext,
  node: Rule.Node,
): Scope.Reference[] =>
  getDownstreamNodes(context, node, "Identifier")
    .map((identifier) => getRef(context, identifier))
    .filter(isDefined);

/**
 * Finds the call expression that invokes the reference, if any.
 * Walks up through member accesses (`fn`, `obj.fn`, `obj.a.fn`) and transparent
 * TypeScript wrappers. Returns `undefined` when the reference is not the
 * eventual callee, e.g. when it is an argument.
 */
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

/**
 * Collects the references inside the arguments of the calls on the synchronous
 * chain from `ref` that lead to a target matched by `isTarget`, plus their own
 * upstream references.
 *
 * `isTarget` keeps unrelated calls out. A wrapper setter may call
 * `console.log(otherState)` before `setState(next)`. `otherState` is not an
 * argument of the state update, so it must not count as one.
 */
export const getArgsUpstreamRefs = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
  isTarget: (context: Rule.RuleContext, ref: Scope.Reference) => boolean,
): Scope.Reference[] =>
  getSynchronousCallChain(context, ref)
    .filter((chainRef) =>
      getSynchronousCallChain(context, chainRef).some((ref) =>
        isTarget(context, ref),
      ),
    )
    .flatMap((chainRef) => getCallExpr(chainRef)?.arguments ?? [])
    .flatMap((arg) => getDownstreamRefs(context, arg))
    .flatMap((argRef) => getUpstreamRefs(context, argRef));

/** Finds the scope reference that resolves the given identifier. */
export const getRef = (
  context: Rule.RuleContext,
  identifier: Rule.Node,
): Scope.Reference | undefined =>
  context.sourceCode
    .getScope(identifier)
    ?.references.find((ref) => ref.identifier === identifier);

/**
 * Runs `check` on the unwrapped initializer of each variable that defines the
 * reference. Returns true when any definition matches.
 */
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

/**
 * True when `node` is invoked right away, e.g. an immediately invoked function
 * expression. Its body runs while the caller continues.
 */
const isImmediatelyInvoked = (node: FunctionNode): boolean => {
  const callee = getOutermostWrapper(node);
  return (
    callee.parent.type === "CallExpression" && callee.parent.callee === callee
  );
};

/**
 * True when `node` runs to completion before `within` continues. Returns false
 * inside async functions, `await` expressions, `void` expressions, and nested
 * functions that may run later.
 */
export const isSynchronous = (node: Rule.Node, within: Rule.Node): boolean => {
  if (isFunction(node) && node.async) {
    // An async function returns a promise, so its body does not run to
    // completion while the caller continues. This also ignores setters that
    // run before the first `await` (for example a loading flag). We accept that
    // false negative to avoid flagging the common fetch-then-set pattern.
    return false;
  } else if (node === within) {
    // Reached the top without finding any blocking conditions
    return true;
  } else if (
    // Inside an awaited expression, e.g. `await fetchUser(id)`.
    node.type === "AwaitExpression" ||
    // Inside an async function that is not awaited.
    // `typescript-eslint/no-floating-promises` rule enforces the leading `void`.
    (node.type === "UnaryExpression" && node.operator === "void")
  ) {
    return false;
  } else if (isFunction(node)) {
    // A function may run later, unless it is invoked right away. An IIFE runs
    // now, so its own position decides whether the chain is synchronous.
    return isImmediatelyInvoked(node)
      ? isSynchronous(getOutermostWrapper(node).parent, within)
      : false;
  } else {
    return isSynchronous(node.parent, within);
  }
};

/**
 * True when a definition of `ref` holds a call. The value of a call is the
 * result, so calling `ref` does not run the arguments of that call.
 * E.g. `new ResizeObserver(handler)` stores the handler; it does not call it.
 * `useMemo` and `useCallback` are excluded because they return the value
 * computed from their arguments, so calling that value does run them.
 */
const isCallResult = (ref: Scope.Reference): boolean =>
  (ref.resolved?.defs ?? []).some((def) => {
    if (def.type !== "Variable" || def.node.init == null) {
      return false;
    }
    const init = unwrapExpression(def.node.init);
    if (init.type === "NewExpression") {
      return true;
    } else if (init.type !== "CallExpression") {
      return false;
    }
    const name = getCalleeName(init.callee);
    return name === undefined || !ARGUMENT_DERIVED_HOOKS.has(name);
  });

/**
 * Returns the references on the synchronous call chain that starts at `ref`.
 * Includes called references and stable `const` aliases. Returns an empty array
 * when `ref` is never called or the chain is asynchronous.
 */
export const getSynchronousCallChain = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): Scope.Reference[] => {
  // Only a ref that is itself invoked can start a synchronous call chain.
  // An alias that is never called (e.g. `const set = setState`) is not a call.
  if (!getCallExpr(ref)) {
    return [];
  }

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

  // An alias declared in an async function inherits its asynchrony, so the
  // chain must stop there too.
  const isSynchronousAlias = (ref: Scope.Reference): boolean => {
    const enclosingFn = findEnclosingFunction(ref.identifier);
    return !enclosingFn || isSynchronous(ref.identifier, enclosingFn);
  };

  const callExprRefs: Scope.Reference[] = [];
  ascend(context, ref, (upRef) => {
    const callExpr = getCallExpr(upRef);
    const enclosingFn = findEnclosingFunction(callExpr);
    if (callExpr && enclosingFn && isSynchronous(callExpr, enclosingFn)) {
      callExprRefs.push(upRef);
    } else if (isAliasRef(upRef) && isSynchronousAlias(upRef)) {
      callExprRefs.push(upRef);
    } else {
      return false;
    }
    // Do not walk into the arguments of the call that produced the value.
    return isCallResult(upRef) ? false : undefined;
  });
  return callExprRefs;
};
