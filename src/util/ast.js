/**
 * @import {Scope,Rule} from 'eslint'
 */

/**
 * Ascend the AST from `ref`, calling `visit` on each reference.
 *
 * @param {Rule.RuleContext} context
 * @param {Scope.Reference} ref
 * @param {(ref: Scope.Reference) => boolean|undefined} visit Return `false` to stop ascending at this reference.
 * @param {Set<Scope.Reference>} visited
 */
const ascend = (context, ref, visit, visited = new Set()) => {
  if (visited.has(ref)) {
    return;
  }
  const contine = visit(ref);
  visited.add(ref);
  if (contine === false) {
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
    .map((def) => def.node.init ?? def.node.body)
    .filter(Boolean)
    .flatMap((node) => getDownstreamRefs(context, node))
    .forEach((ref) => ascend(context, ref, visit, visited));
};

/**
 * Descend the AST from `node`, calling `visit` on each node.
 *
 * @param {Rule.RuleContext} context
 * @param {Rule.Node} node
 * @param {(node: Rule.Node) => void} visit
 * @param {Set<Rule.Node>} visited
 */
const descend = (context, node, visit, visited = new Set()) => {
  if (visited.has(node)) {
    return;
  }
  visit(node);
  visited.add(node);

  (context.sourceCode.visitorKeys[node.type] || [])
    .map((key) => node[key])
    // Some `visitorKeys` are optional, e.g. `IfStatement.alternate`.
    .filter(Boolean)
    // Can be an array, like `CallExpression.arguments`
    .flatMap((child) => (Array.isArray(child) ? child : [child]))
    // Can rarely be `null`, e.g. `ArrayPattern.elements[1]` when an element is skipped - `const [a, , b] = arr`
    .filter(Boolean)
    // Check it's a valid AST node
    .filter((child) => typeof child.type === "string")
    .forEach((child) => descend(context, child, visit, visited));
};

/**
 * Get all upstream references that ultimately flow into `ref`.
 * Includes `ref` itself.
 *
 * @param {Rule.RuleContext} context
 * @param {Scope.Reference} ref
 *
 * @returns {Scope.Reference[]}
 */
export const getUpstreamRefs = (context, ref) => {
  const refs = [];
  ascend(context, ref, (upRef) => refs.push(upRef));
  return refs;

  // We don't care to analyze non-prop parameters.
  // They are local to the function and essentially duplicate the argument reference.
  // (But it's okay to return them while we use `some()` on the result.)
  // .filter(
  //   (ref) =>
  //     isProp(ref) ||
  //     !ref.resolved ||
  //     ref.resolved.defs.some((def) => def.type !== "Parameter"),
  // )
};

/**
 * @param {Rule.RuleContext} context
 * @param {Rule.Node} topNode
 * @param {string} type
 */
export const findDownstreamNodes = (context, topNode, type) => {
  const nodes = [];
  descend(context, topNode, (node) => {
    if (node.type === type) {
      nodes.push(node);
    }
  });
  return nodes;
};

/**
 * @param {Rule.RuleContext} context
 * @param {Rule.Node} node
 */
export const getDownstreamRefs = (context, node) =>
  findDownstreamNodes(context, node, "Identifier")
    .map((identifier) => getRef(context, identifier))
    .filter(Boolean);

/**
 * @param {Scope.Reference} ref
 * @param {Rule.Node} current
 * @returns {Rule.Node | undefined}
 */
export const getCallExpr = (ref, current = ref.identifier.parent) => {
  if (current.type === "CallExpression") {
    // We've reached the top - confirm that the ref is the (eventual) callee, as opposed to an argument.
    let node = ref.identifier;
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

/**
 * @param {Rule.RuleContext} context
 * @param {Scope.Reference} ref
 * @returns {Rule.Node[]}
 */
export const getArgsUpstreamRefs = (context, ref) =>
  getUpstreamRefs(context, ref)
    .map((ref) => getCallExpr(ref))
    .filter(Boolean)
    .flatMap((callExpr) => callExpr.arguments)
    .flatMap((arg) => getDownstreamRefs(context, arg))
    .flatMap((ref) => getUpstreamRefs(context, ref));

/**
 * Walks up the AST until `within` (returns `true`) or finding any of (returns `false`):
 * - An `async` function
 * - A function declaration, which may be called at an arbitrary later time.
 *   - While we return false for *this* call, we may still return true for a call to a function containing this call. Combined with `getUpstreamRefs()`, it will still flag calls to the containing function.
 * - A function passed as a callback to another function or `new` - event handler, `setTimeout`, `Promise.then()` `new ResizeObserver()`, etc.
 *
 * Inspired by https://eslint-react.xyz/docs/rules/hooks-extra-no-direct-set-state-in-use-effect
 *
 * @param {Rule.Node} node
 * @param {Rule.Node} within
 * @returns {boolean}
 */
export const isSynchronous = (node, within) => {
  if (node == within) {
    // Reached the top without finding any blocking conditions
    return true;
  } else if (
    // Obviously not immediate if async. I think this never occurs in isolation from the below conditions? But just in case for now.
    node.async ||
    // Present when calling externally-defined async functions (`node.async` is only true on the function definition).
    // We'll play it safe and assume that any state, props, etc. used in this function or its upstreams may be used asynchronously.
    node.type === "AwaitExpression" ||
    (node.type === "UnaryExpression" && node.operator === "void") ||
    // Inside a named or anonymous function that may be called later, either as a callback or by the developer.
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  ) {
    return false;
  } else {
    // Keep going up
    return isSynchronous(node.parent, within);
  }
};

/**
 * @param {Rule.RuleContext} context
 * @param {Rule.Node} identifier
 *
 * @returns {Scope.Reference | undefined}
 */
export const getRef = (context, identifier) =>
  context.sourceCode
    .getScope(identifier)
    ?.references.find((ref) => ref.identifier == identifier);

/**
 * Checks whether `ref` is a call expression that eventually calls another expression matching the given predicate.
 *
 * Beware this can false negative when function refs are passed to external functions that call them internally (which we can't see).
 * But we prefer that to assuming that refs passed to external functions are always called -
 * we don't have type information, so would false positive on non-function refs passed to external functions.
 *
 * @param {Rule.RuleContext} context
 * @param {Scope.Reference} ref
 * @param {(ref: Scope.Reference) => boolean} predicate
 * @returns {boolean} Whether this reference eventually calls a function matching the given predicate.
 */
export const isEventualCallTo = (context, ref, predicate) => {
  const callExprRefs = [];
  ascend(context, ref, (upRef) => {
    const callExpr = getCallExpr(upRef);
    if (callExpr) {
      callExprRefs.push(upRef);
    } else {
      // TODO: Should still continue when this ref is 1:1 to the upstream ref.
      // e.g. `const ref2 = ref1;` or `const { destructured } = props;`.
      // Currently always returns false when checking `ref2()` or `destructured()` even though `ref1` or `props` might pass `predicate`.
      // I believe this also applies to when functions are passed as arguments to other functions, even internal ones that we can analyze.
      // Similar reason to `getArgsUpstreamRefs()` - we don't "follow" arguments to parameters.
      return false;
    }
  });
  return callExprRefs.some(predicate);
};
