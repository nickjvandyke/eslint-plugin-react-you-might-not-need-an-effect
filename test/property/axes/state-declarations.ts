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

/** State shapes where the opaque boundary must suppress the finding. */
export const opaqueStateShapes: StateShape[] = [
  {
    name: "let setter alias",
    declare: ({ state, setter, initial, useState, declaration }) =>
      `const [${state}, ${setter}Real] = ${useState}(${initial})${declaration};\nlet ${setter} = ${setter}Real;`,
  },
];
