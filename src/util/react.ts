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
        node.init?.type === "FunctionExpression" ||
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

// React-compatible packages that expose the same hook API.
// Kept intentionally small: renamed imports from other packages still fall
// back to name matching.
const REACT_MODULES = new Set([
  "react",
  "preact/hooks",
  "preact/compat",
  "@wordpress/element",
]);

// Third-party hooks with `useEffect` semantics, matched by module + export.
// Layout, update-only, async, debounced, conditional, and interval wrappers are
// excluded because their timing or cleanup differs.
const EFFECT_HOOKS: Record<string, Set<string>> = {
  "react-use": new Set([
    "useMount",
    "useEffectOnce",
    "useDeepCompareEffect",
    "useCustomCompareEffect",
  ]),
  ahooks: new Set(["useMount", "useDeepCompareEffect"]),
  "@react-hookz/web": new Set(["useMountEffect", "useDeepCompareEffect"]),
  "@mantine/hooks": new Set(["useShallowEffect"]),
  "primereact/hooks": new Set(["useMountEffect"]),
  "use-deep-compare-effect": new Set(["default"]),
};

// Resolves an identifier to the module it was imported from and the export name.
// Returns `default` or `namespace` for default and namespace imports.
const getImportBinding = (
  context: Rule.RuleContext,
  node: Rule.Node,
): { source: string; imported: string } | undefined => {
  if (node.type !== "Identifier") return undefined;

  const def = getRef(context, node)?.resolved?.defs.find(
    (def) => def.type === "ImportBinding",
  );
  if (!def) return undefined;

  const source = def.parent.source.value;
  if (typeof source !== "string") return undefined;

  if (def.node.type === "ImportSpecifier") {
    return {
      source,
      imported:
        def.node.imported.type === "Identifier"
          ? def.node.imported.name
          : String(def.node.imported.value),
    };
  }

  return {
    source,
    imported:
      def.node.type === "ImportDefaultSpecifier" ? "default" : "namespace",
  };
};

// Resolves an identifier to the name it was imported from a React-compatible
// package. Returns `default` or `namespace` for default and namespace imports.
// Returns `undefined` when the identifier is not such an import.
const getReactImport = (
  context: Rule.RuleContext,
  node: Rule.Node,
): string | undefined => {
  const binding = getImportBinding(context, node);
  if (!binding || !REACT_MODULES.has(binding.source)) {
    return undefined;
  }

  return binding.imported;
};

// Detects third-party effect wrappers by module + export:
// - `import { useMount } from "react-use"`
// - `import * as reactUse from "react-use"` + `reactUse.useMount`
// - `import useDeepCompareEffect from "use-deep-compare-effect"`
const isThirdPartyEffectHook = (
  context: Rule.RuleContext,
  node: Rule.Node,
): boolean => {
  if (node.type === "Identifier") {
    const binding = getImportBinding(context, node);
    if (!binding) return false;

    return EFFECT_HOOKS[binding.source]?.has(binding.imported) ?? false;
  }

  if (node.type === "MemberExpression" && !node.computed) {
    const property = node.property;
    if (property.type !== "Identifier") return false;

    if (node.object.type === "Identifier") {
      const binding = getImportBinding(context, node.object as Rule.Node);

      if (binding?.imported === "namespace") {
        return EFFECT_HOOKS[binding.source]?.has(property.name) ?? false;
      }
    }
  }

  return false;
};

const isReactNamespace = (
  context: Rule.RuleContext,
  node: Rule.Node,
): boolean => {
  if (node.type !== "Identifier") return false;

  // Fast path, also covers globals, UMD builds, and auto-imported `React`.
  if (node.name === "React") return true;

  const imported = getReactImport(context, node);
  return imported === "default" || imported === "namespace";
};

// Detects React hook calls, including renamed imports:
// - `useState`
// - `import { useState as stateUser } from "react"`
// - `React.useState`
// - `import * as R from "react"` + `R.useState`
// - `import R from "react"` + `R.useState`
const isReactHook = (
  context: Rule.RuleContext,
  node: Rule.Node,
  hookName: string,
): boolean => {
  if (node.type === "Identifier") {
    const parent = node.parent;

    // A non-computed property name is not a reference on its own.
    // e.g. `useState` in `React.useState`
    if (
      parent.type === "MemberExpression" &&
      parent.property === node &&
      !parent.computed
    ) {
      return false;
    }

    // Support passing `ref.identifier` directly for convenience.
    // e.g. `React` from `React.useState`
    if (
      parent.type === "MemberExpression" &&
      parent.object === node &&
      !parent.computed &&
      parent.property.type === "Identifier" &&
      parent.property.name === hookName
    ) {
      return isReactNamespace(context, node);
    }

    // Fast path, also covers globals, UMD builds, and auto-imported hooks.
    if (node.name === hookName) return true;

    return getReactImport(context, node) === hookName;
  }

  if (node.type === "MemberExpression") {
    return (
      !node.computed &&
      node.property.type === "Identifier" &&
      node.property.name === hookName &&
      isReactNamespace(context, node.object as Rule.Node)
    );
  }

  return false;
};

export const isUseState = (
  context: Rule.RuleContext,
  node: Rule.Node,
): boolean => isReactHook(context, node, "useState");

export const isUseRef = (context: Rule.RuleContext, node: Rule.Node): boolean =>
  isReactHook(context, node, "useRef");

// `useContext` returns a value that is owned by a parent, just like a prop.
// It changes outside the component and re-renders the component on change.
export const isUseContext = (
  context: Rule.RuleContext,
  node: Rule.Node,
): boolean => isReactHook(context, node, "useContext");

// Does not include `useLayoutEffect`.
// When used correctly, it interacts with the DOM = external system = (probably) valid effect.
// When used incorrectly, it's probably too difficult to accurately analyze anyway.
//
// Also matches third-party wrappers with `useEffect` semantics.
const isUseEffect = (context: Rule.RuleContext, node: Rule.Node): boolean =>
  node.type === "CallExpression" &&
  (isReactHook(context, node.callee as Rule.Node, "useEffect") ||
    isThirdPartyEffectHook(context, node.callee as Rule.Node));

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

const getEffectDeps = (node: Rule.Node): Rule.Node | undefined => {
  if (node.type !== "CallExpression") return undefined;
  return node.arguments[1] as Rule.Node | undefined;
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
    cleanup: getEffectCleanup(context, node),
  };
};

export const isState = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean =>
  ref.resolved?.defs.some(
    (def) =>
      def.node.type === "VariableDeclarator" &&
      def.node.init?.type === "CallExpression" &&
      isUseState(context, def.node.init.callee as Rule.Node) &&
      def.node.id.type === "ArrayPattern" &&
      (def.node.id.elements.length === 1 ||
        def.node.id.elements.length === 2) &&
      def.node.id.elements[0]?.type === "Identifier" &&
      def.node.id.elements[0].name === ref.identifier.name,
  ) ?? false;

export const isStateSetter = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean =>
  ref.resolved?.defs.some(
    (def) =>
      def.node.type === "VariableDeclarator" &&
      def.node.init?.type === "CallExpression" &&
      isUseState(context, def.node.init.callee as Rule.Node) &&
      def.node.id.type === "ArrayPattern" &&
      def.node.id.elements.length === 2 &&
      def.node.id.elements[1]?.type === "Identifier" &&
      def.node.id.elements[1].name === ref.identifier.name,
  ) ?? false;

// Returns false for props of HOCs (e.g. `withRouter`) because they usually have side effects.
// Also returns true for `useContext` values, because they are owned by an ancestor
// and change outside the component, just like props.
export const isProp = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean =>
  ref.resolved?.defs.some((def) => {
    if (
      def.node.type === "VariableDeclarator" &&
      def.node.init?.type === "CallExpression" &&
      isUseContext(context, def.node.init.callee as Rule.Node)
    ) {
      return true;
    }

    const isFunctionExpressionOrArrow =
      def.node.type === "ArrowFunctionExpression" ||
      def.node.type === "FunctionExpression";
    const declaringNode: Rule.Node = isFunctionExpressionOrArrow
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

export const isRef = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean =>
  ref.resolved?.defs.some(
    (def) =>
      def.node.type === "VariableDeclarator" &&
      def.node.init?.type === "CallExpression" &&
      isUseRef(context, def.node.init.callee as Rule.Node),
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
    isStateSetter(context, callChainRef),
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
    (callChainRef) =>
      isRefCurrent(callChainRef) || isRef(context, callChainRef),
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
    isUseState(context, upRef.identifier as Rule.Node),
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
