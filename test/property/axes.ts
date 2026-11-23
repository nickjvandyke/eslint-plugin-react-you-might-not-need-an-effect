// ---------------------------------------------------------------------------
// Axis: imports (src/util/hooks.ts)
// ---------------------------------------------------------------------------

export interface ImportStyle {
  name: string;
  module: string | null;
  form: "named" | "aliased" | "namespace" | "namespaceAlias" | "default";
  namespace?: string;
}

export const importStyles: ImportStyle[] = [
  { name: "named import", module: "react", form: "named" },
  { name: "aliased import", module: "react", form: "aliased" },
  {
    name: "namespace import",
    module: "react",
    form: "namespace",
    namespace: "React",
  },
  {
    name: "renamed namespace import",
    module: "react",
    form: "namespaceAlias",
    namespace: "ReactAlias",
  },
  { name: "default import", module: "react", form: "default" },
  { name: "preact/hooks", module: "preact/hooks", form: "named" },
  { name: "aliased preact/hooks", module: "preact/hooks", form: "aliased" },
  { name: "preact/compat", module: "preact/compat", form: "named" },
  { name: "aliased preact/compat", module: "preact/compat", form: "aliased" },
  { name: "@wordpress/element", module: "@wordpress/element", form: "named" },
  {
    name: "aliased @wordpress/element",
    module: "@wordpress/element",
    form: "aliased",
  },
  { name: "no import", module: null, form: "named" },
];

export interface HookNames {
  useState: string;
  useEffect: string;
  useContext: string;
  useRef: string;
  memo: string;
  forwardRef: string;
}

export const resolvers = (style: ImportStyle): HookNames => {
  const isNamespace =
    style.form === "namespace" || style.form === "namespaceAlias";
  const isDefault = style.form === "default";
  const namespace = style.namespace ?? "React";
  const member = (hook: string): string =>
    isNamespace
      ? `${namespace}.${hook}`
      : isDefault
        ? `ReactAlias.${hook}`
        : hook;
  return {
    useState: member(style.form === "aliased" ? "useStateAlias" : "useState"),
    useEffect: member(
      style.form === "aliased" ? "useEffectAlias" : "useEffect",
    ),
    useContext: member(
      style.form === "aliased" ? "useContextAlias" : "useContext",
    ),
    useRef: member(style.form === "aliased" ? "useRefAlias" : "useRef"),
    memo: member("memo"),
    forwardRef: member("forwardRef"),
  };
};

const assertModule = (style: ImportStyle): void => {
  if (style.module === null) {
    throw new Error(`The ${style.form} import form needs a module`);
  }
};

export const header = (
  style: ImportStyle,
  extras: readonly string[],
): string => {
  if (style.module === null) return "";
  if (style.form === "namespace" || style.form === "namespaceAlias") {
    assertModule(style);
    return `import * as ${style.namespace ?? "React"} from '${style.module}';`;
  }
  if (style.form === "default") {
    assertModule(style);
    return `import ReactAlias from '${style.module}';`;
  }
  const hooks =
    style.form === "aliased"
      ? [
          "useEffect as useEffectAlias",
          "useState as useStateAlias",
          "useContext as useContextAlias",
          "useRef as useRefAlias",
        ]
      : ["useEffect", "useState", "useContext", "useRef"];
  return `import { ${[...hooks, ...extras].join(", ")} } from '${style.module}';`;
};

// ---------------------------------------------------------------------------
// Axis: containers (src/util/components.ts)
// ---------------------------------------------------------------------------

export interface Container {
  name: string;
  extras: readonly string[];
  needsHoc?: boolean;
  /** A custom hook. Rules can treat hooks differently from components. */
  hook?: boolean;
  wrap: (body: string, names: HookNames, params: string) => string;
}

export const containers: Container[] = [
  {
    name: "function component",
    extras: [],
    wrap: (body, _names, params) => `function C(${params}) {\n${body}\n}`,
  },
  {
    name: "arrow component",
    extras: [],
    wrap: (body, _names, params) => `const C = (${params}) => {\n${body}\n};`,
  },
  {
    name: "function-expression component",
    extras: [],
    wrap: (body, _names, params) =>
      `const C = function (${params}) {\n${body}\n};`,
  },
  {
    name: "exported arrow",
    extras: [],
    wrap: (body, _names, params) =>
      `export const C = (${params}) => {\n${body}\n};`,
  },
  {
    name: "custom hook",
    extras: [],
    hook: true,
    wrap: (body, _names, params) =>
      `function useThing(${params}) {\n${body}\n}`,
  },
  {
    name: "arrow custom hook",
    extras: [],
    hook: true,
    wrap: (body, _names, params) =>
      `const useThing = (${params}) => {\n${body}\n};`,
  },
  {
    name: "memo",
    extras: ["memo"],
    needsHoc: true,
    wrap: (body, names, params) =>
      `const C = ${names.memo}((${params}) => {\n${body}\n});`,
  },
  {
    name: "memo function expression",
    extras: ["memo"],
    needsHoc: true,
    wrap: (body, names, params) =>
      `const C = ${names.memo}(function (${params}) {\n${body}\n});`,
  },
  {
    name: "forwardRef",
    extras: ["forwardRef"],
    needsHoc: true,
    wrap: (body, names, params) =>
      `const C = ${names.forwardRef}((${params ? `${params}, ` : ""}ref) => {\n${body}\n});`,
  },
];

export const opaqueContainers: Container[] = [
  {
    name: "underscore-prefixed",
    extras: [],
    wrap: (body, _names, params) => `const _C = (${params}) => {\n${body}\n};`,
  },
  {
    name: "dollar-prefixed",
    extras: [],
    wrap: (body, _names, params) => `const $C = (${params}) => {\n${body}\n};`,
  },
  {
    name: "lowercase function",
    extras: [],
    wrap: (body, _names, params) => `function build(${params}) {\n${body}\n}`,
  },
  {
    name: "custom hook with underscore",
    extras: [],
    hook: true,
    wrap: (body, _names, params) =>
      `function use_counter(${params}) {\n${body}\n}`,
  },
  {
    name: "inline HOC",
    extras: [],
    wrap: (body, _names, params) =>
      `const C = withRouter((${params}) => {\n${body}\n});`,
  },
  {
    name: "nested inline HOC",
    extras: [],
    wrap: (body, _names, params) =>
      `const C = inject('store')(observer((${params}) => {\n${body}\n}));`,
  },
  {
    name: "nested separate HOC",
    extras: [],
    wrap: (body, _names, params) =>
      `const C = (${params}) => {\n${body}\n};\nexport default inject('store')(observer(C));`,
  },
  {
    name: "separate HOC",
    extras: [],
    wrap: (body, _names, params) =>
      `const C = (${params}) => {\n${body}\n};\nexport default withRouter(C);`,
  },
];

// ---------------------------------------------------------------------------
// Axis: effect callback shapes (src/util/effect.ts, src/util/ast.ts)
// ---------------------------------------------------------------------------

export type EffectShapeName =
  | "block arrow"
  | "expression arrow"
  | "function expression"
  | "function variable"
  | "function declaration"
  | "conditional";

export const effectShapes: EffectShapeName[] = [
  "block arrow",
  "expression arrow",
  "function expression",
  "function variable",
  "function declaration",
  "conditional",
];

/** Opaque execution boundaries. Findings inside these must not be reported. */
export interface BodyWrapper {
  name: string;
  wrap: (body: string) => string;
}

export const identityBodyWrapper: BodyWrapper = {
  name: "none",
  wrap: (body: string) => body,
};

export const deferredBodyWrappers: BodyWrapper[] = [
  {
    name: "async IIFE",
    wrap: (body) => `(async () => {\n${body}\n})();`,
  },
  {
    name: "void async IIFE",
    wrap: (body) => `void (async () => {\n${body}\n})();`,
  },
  {
    name: "promise then callback",
    wrap: (body) => `Promise.resolve().then(() => {\n${body}\n});`,
  },
  {
    name: "constructor callback",
    // Calling a method on the constructor result must not run the callback
    // that was passed to the constructor.
    wrap: (body) =>
      `const observer = new ResizeObserver(() => {\n${body}\n});\nobserver.observe(document.body);`,
  },
  {
    name: "uncalled helper",
    wrap: (body) => `const later = () => {\n${body}\n};`,
  },
  {
    name: "call expression callback",
    wrap: (body) =>
      `function later() {\n${body}\n}\nconst observer = createResizeObserver(later);\nobserver.observe(document.body);`,
  },
  {
    name: "called async arrow",
    wrap: (body) => `const load = async () => {\n${body}\n};\nload();`,
  },
  {
    name: "called async declaration",
    wrap: (body) => `async function load() {\n${body}\n}\nload();`,
  },
  {
    name: "event listener callback",
    wrap: (body) =>
      `function later() {\n${body}\n}\ndocument.addEventListener('click', later);`,
  },
];

/** Synchronous wrappers. They run now, so findings stay reported. */
export const synchronousBodyWrappers: BodyWrapper[] = [
  {
    name: "synchronous IIFE",
    wrap: (body) => `(() => {\n${body}\n})();`,
  },
  {
    name: "called helper",
    wrap: (body) => `const run = () => {\n${body}\n};\nrun();`,
  },
  {
    name: "nested conditional",
    wrap: (body) => `if (Date.now() > 0) {\n${body}\n}`,
  },
];

/** State shapes where the opaque boundary must suppress the finding. */
export const opaqueStateShapes: StateShape[] = [
  {
    name: "let setter alias",
    declare: ({ state, setter, initial, useState, declaration }) =>
      `const [${state}, ${setter}Real] = ${useState}(${initial})${declaration};\nlet ${setter} = ${setter}Real;`,
  },
];

// ---------------------------------------------------------------------------
// Axis: variable hops (src/util/ast.ts)
// ---------------------------------------------------------------------------

export interface HopStep {
  declarations: string[];
  result: string;
}

export interface HopShape {
  name: string;
  step: (index: number, expr: string) => HopStep;
}

export const hopShapes: HopShape[] = [
  {
    name: "const alias",
    step: (index, expr) => ({
      declarations: [`const hop${index} = ${expr};`],
      result: `hop${index}`,
    }),
  },
  {
    name: "object destructuring",
    step: (index, expr) => ({
      declarations: [`const { value: hop${index} } = { value: ${expr} };`],
      result: `hop${index}`,
    }),
  },
  {
    name: "array hole",
    step: (index, expr) => ({
      declarations: [`const [, hop${index}] = [null, ${expr}];`],
      result: `hop${index}`,
    }),
  },
  {
    name: "pure local helper",
    step: (index, expr) => ({
      declarations: [
        `const identity${index} = (v) => v;`,
        `const hop${index} = identity${index}(${expr});`,
      ],
      result: `hop${index}`,
    }),
  },
  {
    name: "global call",
    step: (index, expr) => ({
      declarations: [`const hop${index} = Object(${expr});`],
      result: `hop${index}`,
    }),
  },
];

// ---------------------------------------------------------------------------
// Axis: state declarations (src/util/state.ts)
// ---------------------------------------------------------------------------

export interface StateParts {
  state: string;
  setter: string;
  initial: string;
  useState: string;
  declaration: string;
}

export interface StateShape {
  name: string;
  declare: (parts: StateParts) => string;
}

export const stateShapes: StateShape[] = [
  {
    name: "tuple",
    declare: ({ state, setter, initial, useState, declaration }) =>
      `const [${state}, ${setter}] = ${useState}(${initial})${declaration};`,
  },
  {
    name: "default initializer",
    declare: ({ state, setter, initial, useState, declaration }) =>
      initial === ""
        ? `const [${state}, ${setter}] = ${useState}()${declaration};`
        : `const [${state} = ${initial}, ${setter}] = ${useState}(${initial})${declaration};`,
  },
  {
    name: "const setter alias",
    declare: ({ state, setter, initial, useState, declaration }) =>
      `const [${state}, ${setter}Real] = ${useState}(${initial})${declaration};\nconst ${setter} = ${setter}Real;`,
  },
  {
    name: "destructured setter alias",
    declare: ({ state, setter, initial, useState, declaration }) =>
      `const [${state}, ${setter}Real] = ${useState}(${initial})${declaration};\nconst { ${setter}Real: ${setter} } = { ${setter}Real };`,
  },
  {
    name: "wrapper setter",
    declare: ({ state, setter, initial, useState, declaration }) =>
      `const [${state}, ${setter}Real] = ${useState}(${initial})${declaration};\nconst ${setter} = (v) => ${setter}Real(v);`,
  },
];

// ---------------------------------------------------------------------------
// Axis: property access (src/util/props.ts)
// ---------------------------------------------------------------------------

export interface PropShape {
  name: string;
  params: (used: string[]) => string;
  pre: (used: string[]) => string[];
  expr: (name: string) => string;
}

export const propShapes: PropShape[] = [
  {
    name: "destructured",
    params: (used) => (used.length === 0 ? "" : `{ ${used.join(", ")} }`),
    pre: () => [],
    expr: (name) => name,
  },
  {
    name: "renamed destructured",
    params: (used) =>
      used.length === 0
        ? ""
        : `{ ${used.map((n) => `${n}: ${n}Prop`).join(", ")} }`,
    pre: () => [],
    expr: (name) => `${name}Prop`,
  },
  {
    name: "whole props object",
    params: () => "props",
    pre: () => [],
    expr: (name) => `props.${name}`,
  },
  {
    name: "late destructuring",
    params: () => "props",
    pre: (used) => used.map((n) => `const { ${n} } = props;`),
    expr: (name) => name,
  },
  {
    name: "member alias",
    params: () => "props",
    pre: (used) => used.map((n) => `const ${n} = props.${n};`),
    expr: (name) => name,
  },
  {
    name: "nested member access",
    params: () => "props",
    pre: () => [],
    expr: (name) => `props.nested.${name}`,
  },
  {
    name: "nested destructuring",
    params: () => "props",
    pre: (used) => used.map((n) => `const { ${n} } = props.callbacks;`),
    expr: (name) => name,
  },
  {
    name: "optional chain",
    params: () => "props",
    pre: () => [],
    expr: (name) => `props.${name}?.value`,
  },
];

// ---------------------------------------------------------------------------
// Axis: TypeScript wrappers (src/util/typescript.ts)
// ---------------------------------------------------------------------------

export interface TsWrapper {
  name: string;
  declaration: string;
  deps: string;
  initial: (expr: string) => string;
  setArgument: (expr: string) => string;
  /** Suffix applied to a prop callback callee, e.g. `onFetched!`. */
  callSuffix: string;
}

export const tsWrappers: TsWrapper[] = [
  {
    name: "none",
    declaration: "",
    deps: "",
    initial: (expr) => expr,
    setArgument: (expr) => expr,
    callSuffix: "",
  },
  {
    name: "declaration assertion",
    declaration: " as [unknown, (v: unknown) => void]",
    deps: "",
    initial: (expr) => expr,
    setArgument: (expr) => expr,
    callSuffix: "",
  },
  {
    name: "deps as const",
    declaration: "",
    deps: " as const",
    initial: (expr) => expr,
    setArgument: (expr) => expr,
    callSuffix: "",
  },
  {
    name: "initializer assertion",
    declaration: "",
    deps: "",
    initial: (expr) => (expr === "" ? "" : `${expr} as unknown`),
    setArgument: (expr) => expr,
    callSuffix: "",
  },
  {
    name: "non-null callback",
    declaration: "",
    deps: "",
    initial: (expr) => expr,
    setArgument: (expr) => expr,
    callSuffix: "!",
  },
  {
    name: "setter argument assertion",
    declaration: "",
    deps: "",
    initial: (expr) => expr,
    setArgument: (expr) => `(${expr}) as unknown`,
    callSuffix: "",
  },
];

// ---------------------------------------------------------------------------
// Axis: TypeScript-only slots (src/util/typescript.ts)
// ---------------------------------------------------------------------------

/** Prop shapes that need the TypeScript parser. */
export const tsPropShapes: PropShape[] = [
  {
    name: "asserted props object",
    params: () => "props",
    pre: () => [],
    expr: (name) => `(props as any).${name}`,
  },
];

/** Containers with a TypeScript assertion around the component expression. */
export const tsContainers: Container[] = [
  {
    name: "satisfies arrow",
    extras: [],
    wrap: (body, _names, params) =>
      `const C = ((${params}) => {\n${body}\n}) satisfies React.FC;`,
  },
  {
    name: "asserted arrow",
    extras: [],
    wrap: (body, _names, params) =>
      `const C = ((${params}) => {\n${body}\n}) as React.FC;`,
  },
  {
    name: "satisfies memo function expression",
    extras: ["memo"],
    needsHoc: true,
    wrap: (body, names, params) =>
      `const C = ${names.memo}(function (${params}) {\n${body}\n}) satisfies React.FC;`,
  },
  {
    name: "asserted memo function expression",
    extras: ["memo"],
    needsHoc: true,
    wrap: (body, names, params) =>
      `const C = ${names.memo}(function (${params}) {\n${body}\n}) as React.FC;`,
  },
];

// ---------------------------------------------------------------------------
// Axis: state-setter partition sources
// ---------------------------------------------------------------------------

export interface PartitionHelpers {
  /** The expression that reads the named prop or callback. */
  prop: (name: string) => string;
  useRef: string;
  useContext: string;
}

export interface TriggerSource {
  name: string;
  isState: boolean;
  isExternal: boolean;
  expression: (helpers: PartitionHelpers) => string;
  declarations: (helpers: PartitionHelpers) => string[];
}

export const triggerSources: TriggerSource[] = [
  {
    name: "internal state",
    isState: true,
    isExternal: false,
    expression: () => "a",
    declarations: () => [],
  },
  {
    name: "prop",
    isState: false,
    isExternal: true,
    expression: (helpers) => helpers.prop("items"),
    declarations: () => [],
  },
  {
    name: "external hook value",
    isState: false,
    isExternal: true,
    expression: () => "data",
    declarations: () => ["const { data } = useQuery('/data');"],
  },
  {
    name: "ref current",
    isState: false,
    isExternal: false,
    expression: () => "nodeRef.current",
    declarations: (helpers) => [`const nodeRef = ${helpers.useRef}();`],
  },
  {
    name: "context value",
    isState: false,
    isExternal: true,
    expression: () => "theme",
    declarations: (helpers) => [
      `const theme = ${helpers.useContext}(ThemeContext);`,
    ],
  },
  {
    name: "global alias",
    isState: false,
    isExternal: false,
    expression: () => "globalAlias.title",
    declarations: () => ["const globalAlias = window;"],
  },
];

export interface WrittenSource {
  name: string;
  value: (dependency: string) => string;
}

export const writtenSources: WrittenSource[] = [
  { name: "dependency", value: (dependency) => dependency },
  { name: "literal", value: () => "null" },
  { name: "internal state", value: () => "a" },
];
