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
