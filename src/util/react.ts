import type { Scope, Rule } from "eslint";
import {
  getDownstreamRefs,
  getSynchronousCallChain,
  getUpstreamRefs,
  getRef,
} from "./ast.ts";

export const isFunctionalComponent = (node: Rule.Node): boolean =>
  (node.type === "FunctionDeclaration" ||
    (node.type === "VariableDeclarator" &&
      (node.init?.type === "ArrowFunctionExpression" ||
        node.init?.type === "CallExpression"))) &&
  node.id?.type === "Identifier" &&
  node.id.name[0].toUpperCase() === node.id.name[0];

export const isFunctionalHOC = (
  context: Rule.RuleContext,
  node: Rule.Node,
): boolean => {
  const knownPureHocs = ["memo", "forwardRef"];

  // e.g. `const MyComponent = withRouter(() => ...)`
  const isWrappedInline = (n: Rule.Node): boolean =>
    n.type === "VariableDeclarator" &&
    n.init?.type === "CallExpression" &&
    n.init.callee.type === "Identifier" &&
    !knownPureHocs.includes(n.init.callee.name) &&
    n.init.arguments.length > 0 &&
    (n.init.arguments[0].type === "ArrowFunctionExpression" ||
      n.init.arguments[0].type === "FunctionExpression");

  // e.g. `export default withRouter(MyComponent);`
  const isWrappedSeparately = (n: Rule.Node): boolean =>
    getRef(context, (n as Rule.Node & { id: Rule.Node }).id)
      ?.resolved?.references.filter((ref) => {
        const parent = (ref.identifier as Rule.Node).parent;
        return (
          parent?.type === "CallExpression" &&
          parent.arguments.includes(ref.identifier)
        );
      })
      .map((ref) => (ref.identifier as Rule.Node).parent)
      .some(
        (wrapper) =>
          wrapper.type === "CallExpression" &&
          wrapper.callee.type === "Identifier" &&
          !knownPureHocs.includes(wrapper.callee.name),
      ) ?? false;

  return (
    isFunctionalComponent(node) &&
    (isWrappedInline(node) || isWrappedSeparately(node))
  );
};

export const isCustomHook = (node: Rule.Node): boolean => {
  if (
    node.type !== "FunctionDeclaration" &&
    (node.type !== "VariableDeclarator" ||
      !node.init ||
      (node.init.type !== "ArrowFunctionExpression" &&
        node.init.type !== "FunctionExpression"))
  ) {
    return false;
  }
  return (
    node.id?.type === "Identifier" &&
    node.id.name.startsWith("use") &&
    node.id.name.length > 3 &&
    node.id.name[3] !== undefined &&
    node.id.name[3] === node.id.name[3].toUpperCase()
  );
};

export const isUseState = (node: Rule.Node): boolean => {
  if (node.type === "Identifier" && node.name === "useState") return true;
  if (
    node.type === "MemberExpression" &&
    node.object.type === "Identifier" &&
    node.object.name === "React" &&
    node.property.type === "Identifier" &&
    node.property.name === "useState"
  )
    return true;
  // Support passing `ref.identifier` directly for convenience
  const parent = node.parent;
  return (
    parent.type === "MemberExpression" &&
    parent.object.type === "Identifier" &&
    parent.object.name === "React" &&
    parent.property.type === "Identifier" &&
    parent.property.name === "useState"
  );
};

export const isUseRef = (node: Rule.Node): boolean => {
  if (node.type === "Identifier" && node.name === "useRef") return true;
  const parent = node.parent;
  return (
    parent.type === "MemberExpression" &&
    parent.object.type === "Identifier" &&
    parent.object.name === "React" &&
    parent.property.type === "Identifier" &&
    parent.property.name === "useRef"
  );
};

// Does not include `useLayoutEffect`.
// When used correctly, it interacts with the DOM = external system = (probably) valid effect.
// When used incorrectly, it's probably too difficult to accurately analyze anyway.
const isUseEffect = (node: Rule.Node): boolean =>
  node.type === "CallExpression" &&
  ((node.callee.type === "Identifier" && node.callee.name === "useEffect") ||
    (node.callee.type === "MemberExpression" &&
      node.callee.object.type === "Identifier" &&
      node.callee.object.name === "React" &&
      node.callee.property.type === "Identifier" &&
      node.callee.property.name === "useEffect"));

const getEffectFn = (
  context: Rule.RuleContext,
  node: Rule.Node,
): Rule.Node | undefined => {
  if (node.type !== "CallExpression") return undefined;
  const effectFn = node.arguments[0];
  if (
    effectFn?.type === "ArrowFunctionExpression" ||
    effectFn?.type === "FunctionExpression"
  ) {
    return effectFn as Rule.Node;
  } else if (effectFn?.type === "Identifier") {
    const ref = getRef(context, effectFn as Rule.Node);
    const def = ref?.resolved?.defs[0];
    if (!def) return undefined;
    return (
      (def.node as Rule.Node & { init?: Rule.Node }).init ??
      (def.node as Rule.Node & { body?: Rule.Node }).body
    );
  }

  return undefined;
};

const getEffectDeps = (
  node: Rule.Node,
): (Rule.Node & { type: "ArrayExpression" }) | undefined => {
  if (node.type !== "CallExpression") return undefined;
  const depsArr = node.arguments[1];
  if (depsArr?.type !== "ArrayExpression") {
    return undefined;
  }

  return depsArr as Rule.Node & { type: "ArrayExpression" };
};

const getEffectCleanup = (
  context: Rule.RuleContext,
  node: Rule.Node,
): (Rule.Node & { type: "ReturnStatement" }) | undefined => {
  const effectFn = getEffectFn(context, node);
  if (!effectFn) return undefined;
  if (
    (effectFn.type !== "ArrowFunctionExpression" &&
      effectFn.type !== "FunctionExpression") ||
    effectFn.body.type !== "BlockStatement"
  ) {
    return undefined;
  }

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
  if (!isUseEffect(node)) return undefined;

  const fn = getEffectFn(context, node);
  if (!fn) return undefined;

  const deps = getEffectDeps(node);

  return {
    fn,
    fnRefs: getDownstreamRefs(context, fn),
    depsRefs: deps ? getDownstreamRefs(context, deps) : undefined,
    cleanup: getEffectCleanup(context, node),
  };
};

export const isState = (ref: Scope.Reference): boolean =>
  ref.resolved?.defs.some(
    (def) =>
      def.node.type === "VariableDeclarator" &&
      def.node.init?.type === "CallExpression" &&
      isUseState(def.node.init.callee) &&
      def.node.id.type === "ArrayPattern" &&
      (def.node.id.elements.length === 1 ||
        def.node.id.elements.length === 2) &&
      def.node.id.elements[0]?.type === "Identifier" &&
      def.node.id.elements[0].name === ref.identifier.name,
  ) ?? false;

export const isStateSetter = (ref: Scope.Reference): boolean =>
  ref.resolved?.defs.some(
    (def) =>
      def.node.type === "VariableDeclarator" &&
      def.node.init?.type === "CallExpression" &&
      isUseState(def.node.init.callee) &&
      def.node.id.type === "ArrayPattern" &&
      def.node.id.elements.length === 2 &&
      def.node.id.elements[1]?.type === "Identifier" &&
      def.node.id.elements[1].name === ref.identifier.name,
  ) ?? false;

// Returns false for props of HOCs (e.g. `withRouter`) because they usually have side effects.
export const isProp = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean =>
  ref.resolved?.defs.some((def) => {
    const declaringNode: Rule.Node =
      def.node.type === "ArrowFunctionExpression"
        ? def.node.parent.type === "CallExpression"
          ? def.node.parent.parent
          : def.node.parent
        : def.node;
    return (
      def.type === "Parameter" &&
      ((isFunctionalComponent(declaringNode) &&
        !isFunctionalHOC(context, declaringNode)) ||
        isCustomHook(declaringNode))
    );
  }) ?? false;

export const isConstant = (ref: Scope.Reference): boolean =>
  (ref.resolved?.defs ?? []).some(
    (def) =>
      (def.node.type === "VariableDeclarator" &&
        def.node.init?.type === "Literal") ||
      def.node.init?.type === "TemplateLiteral" ||
      def.node.init?.type === "ArrayExpression" ||
      def.node.init?.type === "ObjectExpression",
  );

export const isRef = (ref: Scope.Reference): boolean =>
  ref.resolved?.defs.some(
    (def) =>
      def.node.type === "VariableDeclarator" &&
      def.node.init?.type === "CallExpression" &&
      ((def.node.init.callee.type === "Identifier" &&
        def.node.init.callee.name === "useRef") ||
        (def.node.init.callee.type === "MemberExpression" &&
          def.node.init.callee.object.type === "Identifier" &&
          def.node.init.callee.object.name === "React" &&
          def.node.init.callee.property.type === "Identifier" &&
          def.node.init.callee.property.name === "useRef")),
  ) ?? false;

// Whether the reference's `current` property is being accessed.
// Heuristic for whether the reference is a React ref object.
// Because we don't always have access to the `useRef` call itself.
// For example when receiving a ref from props.
export const isRefCurrent = (ref: Scope.Reference): boolean => {
  const parent = (ref.identifier as Rule.Node).parent;
  return (
    parent.type === "MemberExpression" &&
    parent.property.type === "Identifier" &&
    parent.property.name === "current"
  );
};

export const isStateCall = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean =>
  getSynchronousCallChain(context, ref).some((callChainRef) =>
    isStateSetter(callChainRef),
  );

export const isPropCall = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean =>
  getSynchronousCallChain(context, ref).some((callChainRef) =>
    isProp(context, callChainRef),
  );

export const isRefCall = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean =>
  getSynchronousCallChain(context, ref).some(
    (callChainRef) => isRefCurrent(callChainRef) || isRef(callChainRef),
  );

export const getStateName = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): string | undefined => {
  const decl = getUseStateDecl(context, ref);
  if (!decl || decl.id.type !== "ArrayPattern") return undefined;
  const elements = decl.id.elements;
  const first = elements[0];
  const second = elements[1];
  return (
    (first?.type === "Identifier" ? first : undefined) ??
    (second?.type === "Identifier" ? second : undefined)
  )?.name;
};

export const getUseStateDecl = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): (Rule.Node & { type: "VariableDeclarator" }) | undefined => {
  const node = getUpstreamRefs(context, ref).find((upRef) =>
    isUseState(upRef.identifier as Rule.Node),
  )?.identifier as Rule.Node | undefined;
  let result = node;
  while (result && result.type !== "VariableDeclarator") {
    result = result.parent;
  }
  return result as (Rule.Node & { type: "VariableDeclarator" }) | undefined;
};

// Returns the component or custom hook that contains the `useEffect` node.
//
// Per the `isFunctionalComponent` etc. internals, this will return undefined for some non-idiomatic component definitions.
// e.g. `function buildComponent(arg1, arg2) { return <div />; }`
// Not sure we can account for that without introducing false positives, and those are rare and arguably bad practice.
export const findEnclosingReactNode = (
  context: Rule.RuleContext,
  node: Rule.Node | undefined,
): Rule.Node | undefined => {
  if (!node) {
    return undefined;
  } else if (
    isFunctionalComponent(node) ||
    isFunctionalHOC(context, node) ||
    isCustomHook(node)
  ) {
    return node;
  } else {
    return findEnclosingReactNode(context, node.parent);
  }
};

// Extracts the component/hook name from a node found by `findEnclosingReactNode`.
// Returns `undefined` for anonymous functions or when the node cannot be identified.
export const getComponentName = (
  containingNode: Rule.Node | undefined,
): string | undefined => {
  if (!containingNode) return undefined;
  if (
    containingNode.type !== "FunctionDeclaration" &&
    containingNode.type !== "VariableDeclarator"
  )
    return undefined;
  return (containingNode as Rule.Node & { id: { name?: string } | null }).id
    ?.name;
};
