export const effectShapes = [
  "block arrow",
  "expression arrow",
  "function expression",
  "function variable",
  "function declaration",
  "conditional",
] as const;

export type EffectShapeName = (typeof effectShapes)[number];
