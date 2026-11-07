import type { Rule } from "eslint";
import { getRef, isFunctionExpression } from "./ast.ts";
import { getOutermostWrapper, unwrapExpression } from "./typescript.ts";

export const isComponent = (node: Rule.Node): boolean => {
  const init =
    node.type === "VariableDeclarator" && node.init
      ? unwrapExpression(node.init)
      : undefined;
  return (
    (node.type === "FunctionDeclaration" ||
      (node.type === "VariableDeclarator" &&
        init !== undefined &&
        (isFunctionExpression(init) || init.type === "CallExpression"))) &&
    node.id?.type === "Identifier" &&
    node.id.name[0].toUpperCase() === node.id.name[0]
  );
};

export const isHOC = (context: Rule.RuleContext, node: Rule.Node): boolean => {
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
      isFunctionExpression(init.arguments[0] as Rule.Node)
    );
  };

  // e.g. `export default withRouter(MyComponent);`
  const isWrappedSeparately = (n: Rule.Node): boolean =>
    getRef(
      context,
      (n as Rule.Node & { id: Rule.Node }).id,
    )?.resolved?.references.some((ref) => {
      const wrapper = getOutermostWrapper(ref.identifier as Rule.Node);
      const call = wrapper.parent;
      if (
        call?.type !== "CallExpression" ||
        !call.arguments.some((arg) => arg === wrapper)
      ) {
        return false;
      }
      const callee = unwrapExpression(call.callee as Rule.Node);
      return (
        callee.type === "Identifier" && !knownPureHocs.includes(callee.name)
      );
    }) ?? false;

  return (
    isComponent(node) && (isWrappedInline(node) || isWrappedSeparately(node))
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
      init === undefined ||
      !isFunctionExpression(init))
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

// Returns the component or custom hook that contains the `useEffect` node.
//
// Per the `isComponent` etc. internals, this will return undefined for some non-idiomatic component definitions.
// e.g. `function buildComponent(arg1, arg2) { return <div />; }`
// Not sure we can account for that without introducing false positives, and those are rare and arguably bad practice.
export const findEnclosingComponentOrHook = (
  context: Rule.RuleContext,
  node: Rule.Node | undefined,
): Rule.Node | undefined => {
  if (!node) {
    return undefined;
  } else if (isComponent(node) || isHOC(context, node) || isCustomHook(node)) {
    return node;
  } else {
    return findEnclosingComponentOrHook(context, node.parent);
  }
};

// Extracts the component/hook name from a node found by `findEnclosingComponentOrHook`.
// Returns `undefined` for anonymous functions or when the node cannot be identified.
export const getComponentOrHookName = (
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
