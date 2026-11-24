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

/** Prop shapes that need the TypeScript parser. */
export const tsPropShapes: PropShape[] = [
  {
    name: "asserted props object",
    params: () => "props",
    pre: () => [],
    expr: (name) => `(props as any).${name}`,
  },
];
