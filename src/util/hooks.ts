import type { Rule } from "eslint";
import { getRef } from "./ast.ts";
import { unwrapExpression } from "./typescript.ts";

/**
 * React-compatible packages that expose the same hook API.
 * Local bindings and imports from other packages do not establish this API.
 */
const REACT_MODULES = new Set([
  "react",
  "preact/hooks",
  "preact/compat",
  "@wordpress/element",
]);
const REACT_NAMESPACE = Symbol("React namespace");

/**
 * Third-party hooks with `useEffect` semantics, matched by module + export.
 * Layout, update-only, async, debounced, conditional, and interval wrappers are
 * excluded because their timing or cleanup differs.
 */
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

/**
 * Resolves an identifier to the module it was imported from and the export name.
 * Returns `default` or `namespace` for default and namespace imports.
 */
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

/**
 * Resolves React imports, stable aliases, CommonJS imports and globals.
 * Only identifiers without local definitions retain the global-name fallback.
 */
const getReactBinding = (
  context: Rule.RuleContext,
  node: Rule.Node,
  visited: Set<Rule.Node> = new Set(),
): string | typeof REACT_NAMESPACE | undefined => {
  node = unwrapExpression(node);
  if (visited.has(node)) return undefined;
  visited.add(node);

  if (node.type === "Identifier") {
    const variable = getRef(context, node)?.resolved;
    const definitions = variable?.defs ?? [];
    if (definitions.length === 0) {
      return node.name === "React" ? REACT_NAMESPACE : node.name;
    }

    const binding = getImportBinding(context, node);
    if (binding) {
      if (!REACT_MODULES.has(binding.source)) return undefined;
      return binding.imported === "default" || binding.imported === "namespace"
        ? REACT_NAMESPACE
        : binding.imported;
    }

    if (definitions.length !== 1) return undefined;
    const [definition] = definitions;
    if (definition.type !== "Variable" || !definition.node.init) {
      return undefined;
    }
    if (
      variable?.references.some(
        (ref) => ref.isWrite() && ref.writeExpr !== definition.node.init,
      )
    ) {
      return undefined;
    }

    const imported = getReactBinding(context, definition.node.init, visited);
    if (definition.node.id.type === "Identifier") return imported;
    if (
      definition.node.id.type === "ObjectPattern" &&
      imported === REACT_NAMESPACE
    ) {
      const property = definition.node.id.properties.find(
        (property) =>
          property.type === "Property" &&
          property.value.type === "Identifier" &&
          property.value.name === node.name,
      );
      if (property?.type === "Property") {
        const name = getPropertyName(property.key, property.computed);
        return name === "default" ? REACT_NAMESPACE : name;
      }
    }
    return undefined;
  }

  if (node.type === "MemberExpression") {
    const name = getPropertyName(node.property, node.computed);
    if (
      name === "React" &&
      node.object.type === "Identifier" &&
      ["globalThis", "window", "self", "global"].includes(node.object.name) &&
      !getRef(context, node.object)?.resolved?.defs.length
    ) {
      return REACT_NAMESPACE;
    }
    const imported = getReactBinding(context, node.object, visited);
    if (imported !== REACT_NAMESPACE) return undefined;
    return name === "default" ? REACT_NAMESPACE : name;
  }

  if (
    node.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "require" &&
    !getRef(context, node.callee)?.resolved?.defs.length &&
    node.arguments.length === 1
  ) {
    const [source] = node.arguments;
    if (
      source.type === "Literal" &&
      typeof source.value === "string" &&
      REACT_MODULES.has(source.value)
    ) {
      return REACT_NAMESPACE;
    }
  }
  return undefined;
};

const getPropertyName = (
  node: Rule.Node,
  computed: boolean,
): string | undefined => {
  if (!computed && node.type === "Identifier") return node.name;
  if (node.type === "Literal" && typeof node.value === "string")
    return node.value;
  return undefined;
};

/**
 * Detects third-party effect wrappers by module + export:
 * - `import { useMount } from "react-use"`
 * - `import * as reactUse from "react-use"` + `reactUse.useMount`
 * - `import useDeepCompareEffect from "use-deep-compare-effect"`
 */
const isThirdPartyEffectHook = (
  context: Rule.RuleContext,
  node: Rule.Node,
): boolean => {
  if (node.type !== "CallExpression") return false;

  const callee = unwrapExpression(node.callee);
  if (callee.type === "Identifier") {
    const binding = getImportBinding(context, callee);
    if (!binding) return false;

    return EFFECT_HOOKS[binding.source]?.has(binding.imported) ?? false;
  }

  if (callee.type === "MemberExpression" && !callee.computed) {
    const property = callee.property;
    if (property.type !== "Identifier") return false;

    if (callee.object.type === "Identifier") {
      const binding = getImportBinding(context, callee.object);

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
  const imported = getReactBinding(context, node);
  return imported === REACT_NAMESPACE;
};

/**
 * Detects React hook calls, including renamed imports:
 * - `useState`
 * - `import { useState as stateUser } from "react"`
 * - `React.useState`
 * - `import * as R from "react"` + `R.useState`
 * - `import R from "react"` + `R.useState`
 *
 * Takes the `CallExpression` node.
 */
const isReactHook = (
  context: Rule.RuleContext,
  node: Rule.Node,
  hookName: string,
): boolean => {
  if (node.type !== "CallExpression") return false;

  const callee = unwrapExpression(node.callee);

  if (callee.type === "Identifier") {
    return getReactBinding(context, callee) === hookName;
  }

  if (callee.type === "MemberExpression") {
    return (
      !callee.computed &&
      callee.property.type === "Identifier" &&
      callee.property.name === hookName &&
      isReactNamespace(context, unwrapExpression(callee.object))
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

export const isUseMemo = (
  context: Rule.RuleContext,
  node: Rule.Node,
): boolean => isReactHook(context, node, "useMemo");

export const isUseCallback = (
  context: Rule.RuleContext,
  node: Rule.Node,
): boolean => isReactHook(context, node, "useCallback");

/**
 * True when `node` calls `useContext`.
 *
 * `useContext` returns a value that is owned by a parent, just like a prop.
 * It changes outside the component and re-renders the component on change.
 */
export const isUseContext = (
  context: Rule.RuleContext,
  node: Rule.Node,
): boolean => isReactHook(context, node, "useContext");

/**
 * True when `node` calls `useEffect`, including third-party wrappers with
 * `useEffect` semantics.
 *
 * Does not include `useLayoutEffect`.
 * When used correctly, it interacts with the DOM = external system = (probably) valid effect.
 * When used incorrectly, it's probably too difficult to accurately analyze anyway.
 */
export const isUseEffect = (
  context: Rule.RuleContext,
  node: Rule.Node,
): boolean =>
  isReactHook(context, node, "useEffect") ||
  isThirdPartyEffectHook(context, node);
