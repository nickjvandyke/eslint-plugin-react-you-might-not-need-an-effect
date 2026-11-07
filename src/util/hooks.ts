import type { Rule } from "eslint";
import { getRef } from "./ast.ts";
import { unwrapExpression } from "./typescript.ts";

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
export const isUseEffect = (
  context: Rule.RuleContext,
  node: Rule.Node,
): boolean =>
  node.type === "CallExpression" &&
  (isReactHook(context, node.callee as Rule.Node, "useEffect") ||
    isThirdPartyEffectHook(context, node.callee as Rule.Node));
