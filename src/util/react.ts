import type { Scope, Rule } from "eslint";
import { getDownstreamRefs, getSynchronousCallChain, getRef } from "./ast.ts";
import { outermostWrapper, unwrapExpression } from "./typescript.ts";

export const isFunctionalComponent = (node: Rule.Node): boolean => {
  const init =
    node.type === "VariableDeclarator" && node.init
      ? unwrapExpression(node.init)
      : undefined;
  return (
    (node.type === "FunctionDeclaration" ||
      (node.type === "VariableDeclarator" &&
        (init?.type === "ArrowFunctionExpression" ||
          init?.type === "FunctionExpression" ||
          init?.type === "CallExpression"))) &&
    node.id?.type === "Identifier" &&
    node.id.name[0].toUpperCase() === node.id.name[0]
  );
};

export const isFunctionalHOC = (
  context: Rule.RuleContext,
  node: Rule.Node,
): boolean => {
  const knownPureHocs = ["memo", "forwardRef"];

  // e.g. `const MyComponent = withRouter(() => ...)`
  const isWrappedInline = (n: Rule.Node): boolean => {
    if (n.type !== "VariableDeclarator" || !n.init) return false;
    const init = unwrapExpression(n.init);
    if (init.type !== "CallExpression") return false;
    const callee = unwrapExpression(init.callee as Rule.Node);
    return (
      callee.type === "Identifier" &&
      !knownPureHocs.includes(callee.name) &&
      init.arguments.length > 0 &&
      (init.arguments[0].type === "ArrowFunctionExpression" ||
        init.arguments[0].type === "FunctionExpression")
    );
  };

  // e.g. `export default withRouter(MyComponent);`
  const isWrappedSeparately = (n: Rule.Node): boolean =>
    getRef(context, (n as Rule.Node & { id: Rule.Node }).id)
      ?.resolved?.references.filter((ref) => {
        const wrapper = outermostWrapper(ref.identifier as Rule.Node);
        const parent = wrapper.parent;
        return (
          parent?.type === "CallExpression" &&
          parent.arguments.some((arg) => arg === wrapper)
        );
      })
      .map((ref) => outermostWrapper(ref.identifier as Rule.Node).parent)
      .some((wrapper) => {
        if (wrapper.type !== "CallExpression") return false;
        const callee = unwrapExpression(wrapper.callee as Rule.Node);
        return (
          callee.type === "Identifier" && !knownPureHocs.includes(callee.name)
        );
      }) ?? false;

  return (
    isFunctionalComponent(node) &&
    (isWrappedInline(node) || isWrappedSeparately(node))
  );
};

export const isCustomHook = (node: Rule.Node): boolean => {
  const init =
    node.type === "VariableDeclarator" && node.init
      ? unwrapExpression(node.init)
      : undefined;
  if (
    node.type !== "FunctionDeclaration" &&
    (node.type !== "VariableDeclarator" ||
      (init?.type !== "ArrowFunctionExpression" &&
        init?.type !== "FunctionExpression"))
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
  node = unwrapExpression(node);
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
  node = unwrapExpression(node);

  if (node.type === "Identifier") {
    // Fast path, also covers globals, UMD builds, and auto-imported hooks.
    if (node.name === hookName) return true;

    return getReactImport(context, node) === hookName;
  }

  if (node.type === "MemberExpression") {
    return (
      !node.computed &&
      node.property.type === "Identifier" &&
      node.property.name === hookName &&
      isReactNamespace(context, unwrapExpression(node.object as Rule.Node))
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
  const effectFnArg = node.arguments[0] as Rule.Node | undefined;
  if (!effectFnArg) return undefined;
  const effectFn = unwrapExpression(effectFnArg);
  if (
    effectFn.type === "ArrowFunctionExpression" ||
    effectFn.type === "FunctionExpression"
  ) {
    return effectFn;
  } else if (effectFn.type === "Identifier") {
    const ref = getRef(context, effectFn);
    const def = ref?.resolved?.defs[0];
    if (!def) return undefined;
    const init = (def.node as Rule.Node & { init?: Rule.Node }).init;
    return (
      (init && unwrapExpression(init)) ??
      (def.node as Rule.Node & { body?: Rule.Node }).body
    );
  }

  return undefined;
};

const getEffectDeps = (node: Rule.Node): Rule.Node | undefined => {
  if (node.type !== "CallExpression") return undefined;
  const deps = node.arguments[1] as Rule.Node | undefined;
  return deps && unwrapExpression(deps);
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

// Reads the local name from an array pattern element, including defaults
// like `const [count = 0, setCount] = useState()`.
const getPatternName = (element: unknown): string | undefined => {
  const node = element as
    | { type: string; name?: string; left?: unknown }
    | null
    | undefined;
  if (!node) return undefined;
  if (node.type === "Identifier") return node.name;
  if (node.type === "AssignmentPattern") return getPatternName(node.left);
  return undefined;
};

// Runs `check` on the unwrapped initializer of each variable that defines the
// reference. Returns true when any definition matches.
const someVariableInit = (
  ref: Scope.Reference,
  check: (
    init: Rule.Node,
    declarator: Rule.Node & { type: "VariableDeclarator" },
  ) => boolean,
): boolean =>
  (ref.resolved?.defs ?? []).some((def) => {
    const declarator = def.node;
    if (declarator.type !== "VariableDeclarator" || !declarator.init) {
      return false;
    }
    return check(unwrapExpression(declarator.init), declarator);
  });

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
      !isUseState(context, init.callee as Rule.Node) ||
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

// Returns false for props of HOCs (e.g. `withRouter`) because they usually have side effects.
// Also returns true for `useContext` values, because they are owned by an ancestor
// and change outside the component, just like props.
export const isProp = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean =>
  someVariableInit(
    ref,
    (init) =>
      init.type === "CallExpression" &&
      isUseContext(context, init.callee as Rule.Node),
  ) ||
  (ref.resolved?.defs ?? []).some((def) => {
    const isFunctionExpressionOrArrow =
      def.node.type === "ArrowFunctionExpression" ||
      def.node.type === "FunctionExpression";
    let declaringNode: Rule.Node = def.node;
    if (isFunctionExpressionOrArrow) {
      declaringNode = outermostWrapper(declaringNode).parent;
      if (declaringNode.type === "CallExpression") {
        declaringNode = outermostWrapper(declaringNode).parent;
      }
    }
    return (
      def.type === "Parameter" &&
      ((isFunctionalComponent(declaringNode) &&
        !isFunctionalHOC(context, declaringNode)) ||
        isCustomHook(declaringNode))
    );
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

export const isRef = (
  context: Rule.RuleContext,
  ref: Scope.Reference,
): boolean =>
  someVariableInit(
    ref,
    (init) =>
      init.type === "CallExpression" &&
      isUseRef(context, init.callee as Rule.Node),
  );

// Whether the reference's `current` property is being accessed.
// Heuristic for whether the reference is a React ref object.
// Because we don't always have access to the `useRef` call itself.
// For example when receiving a ref from props.
export const isRefCurrent = (ref: Scope.Reference): boolean => {
  const parent = outermostWrapper(ref.identifier as Rule.Node).parent;
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
  return (
    getPatternName(decl.id.elements[0]) ?? getPatternName(decl.id.elements[1])
  );
};

// Callers pass a ref that is already a state setter call (filtered by
// `isStateCall`), so the call chain contains the written setter.
export const getUseStateDecl = (
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
    (def) => def.node.type === "VariableDeclarator",
  );
  return setterDecl?.node as
    | (Rule.Node & { type: "VariableDeclarator" })
    | undefined;
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
