import type { Rule } from "eslint";

// ESLint attaches a `parent` property to every AST node before invoking rule
// visitors. `Rule.Node` already includes it, but the nested node types from
// `@types/estree` do not, which forces casts like `ref.identifier as Rule.Node`.
// Teaching `estree` about `parent` makes every node assignable to `Rule.Node`.
declare module "estree" {
  interface BaseNode {
    parent: Rule.Node;
  }
}
