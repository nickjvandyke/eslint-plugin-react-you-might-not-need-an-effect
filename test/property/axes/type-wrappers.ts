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
