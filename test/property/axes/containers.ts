import type { HookNames } from "./import-styles.ts";

export interface Container {
  name: string;
  extras: readonly string[];
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
    wrap: (body, names, params) =>
      `const C = ${names.memo}((${params}) => {\n${body}\n});`,
  },
  {
    name: "memo function expression",
    extras: ["memo"],
    wrap: (body, names, params) =>
      `const C = ${names.memo}(function (${params}) {\n${body}\n});`,
  },
  {
    name: "forwardRef",
    extras: ["forwardRef"],
    wrap: (body, names, params) =>
      `const C = ${names.forwardRef}((${params ? `${params}, ` : ""}ref) => {\n${body}\n});`,
  },
];

/** Names that do not look like a component or hook are opaque. */
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
    wrap: (body, names, params) =>
      `const C = ${names.memo}(function (${params}) {\n${body}\n}) satisfies React.FC;`,
  },
  {
    name: "asserted memo function expression",
    extras: ["memo"],
    wrap: (body, names, params) =>
      `const C = ${names.memo}(function (${params}) {\n${body}\n}) as React.FC;`,
  },
];
