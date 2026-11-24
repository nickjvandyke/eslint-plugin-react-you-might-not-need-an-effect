import fc from "fast-check";
import type { Diagnostic } from "../harness.ts";
import { oneOf } from "./helpers.ts";
import { containers, type Container } from "./axes/containers.ts";
import { effectShapes, type EffectShapeName } from "./axes/effect-shapes.ts";
import {
  identityBodyWrapper,
  type BodyWrapper,
} from "./axes/execution-boundaries.ts";
import {
  header,
  importStyles,
  resolvers,
  type ImportStyle,
} from "./axes/import-styles.ts";
import { propShapes, type PropShape } from "./axes/property-access.ts";
import { stateShapes, type StateShape } from "./axes/state-declarations.ts";
import { tsWrappers, type TsWrapper } from "./axes/type-wrappers.ts";
import { hopShapes, type HopShape } from "./axes/variable-hops.ts";

// ---------------------------------------------------------------------------
// Program builder
// ---------------------------------------------------------------------------

export interface TemplateContext {
  useState: string;
  useEffect: string;
  useContext: string;
  useRef: string;
  /** Adds a state declaration with the TypeScript wrapper applied. */
  state: (stateName: string, setterName: string, initial?: string) => string;
  /** The expression that reads the named prop or callback. */
  prop: (name: string) => string;
  /** Routes an expression through `hops` intermediate variables. */
  hop: (expr: string) => string;
  /** Applies the TypeScript setter-argument wrapper. */
  set: (expr: string) => string;
  /** Calls a prop callback, including a TypeScript callee wrapper. */
  call: (callee: string, args: string[]) => string;
  /** Builds the effect call with the TypeScript deps wrapper applied. */
  effect: (body: string, deps: string, cleanup?: string) => string;
}

export interface Template {
  /** Rule name for failure messages. Absent for boundary fixtures. */
  rule?: string;
  /**
   * The diagnostics this template must produce for `container`. An empty list
   * means the rule must stay silent.
   */
  expected: (container: Container) => Diagnostic[];
  /** The finding needs a container that the plugin treats as a component or hook. */
  needsComponentOrHook?: boolean;
  /** A cleanup return makes the effect a subscription, so the finding is suppressed. */
  suppressedByCleanup?: boolean;
  body: (ctx: TemplateContext) => { pre: string[]; effect: string };
}

export interface BuilderOptions {
  style: ImportStyle;
  container: Container;
  propShape: PropShape;
  effectShape: EffectShapeName;
  ts: TsWrapper;
  hops: number;
  hopShape: HopShape;
  stateShape: StateShape;
  /** Optional wrapper around the effect body. */
  bodyWrap?: (body: string) => string;
}

export const buildContext = (
  options: BuilderOptions,
): TemplateContext & {
  hopDeclarations: string[];
  usedProps: string[];
  bodyWrap?: (body: string) => string;
} => {
  const {
    ts,
    hops,
    hopShape,
    stateShape,
    propShape,
    effectShape,
    style,
    bodyWrap,
  } = options;
  const names = resolvers(style);
  const hopDeclarations: string[] = [];
  const usedProps: string[] = [];
  let hopCount = 0;
  let runCount = 0;

  const callEffect = (body: string, deps: string, cleanup?: string): string => {
    const dts = ts.deps;
    const wrapped = bodyWrap ? bodyWrap(body) : body;
    const lines = [wrapped, ...(cleanup ? [cleanup] : [])].join("\n");
    const block = () =>
      `${names.useEffect}(() => {\n${lines}\n}, ${deps}${dts});`;

    switch (effectShape) {
      case "function expression":
        return `${names.useEffect}(function () {\n${lines}\n}, ${deps}${dts});`;
      case "function variable": {
        const run = `run${runCount++}`;
        hopDeclarations.push(`const ${run} = () => {\n${lines}\n};`);
        return `${names.useEffect}(${run}, ${deps}${dts});`;
      }
      case "function declaration": {
        const run = `run${runCount++}`;
        hopDeclarations.push(`function ${run}() {\n${lines}\n}`);
        return `${names.useEffect}(${run}, ${deps}${dts});`;
      }
      case "expression arrow": {
        // Only a single expression statement can become an expression body.
        // Inspect the wrapped body, because a body wrapper may add statements.
        const statement = wrapped.trim();
        const expression = statement.endsWith(";")
          ? statement.slice(0, -1)
          : statement;
        if (
          !cleanup &&
          !expression.includes("\n") &&
          !expression.includes("return ") &&
          !expression.startsWith("if ")
        ) {
          return `${names.useEffect}(() => ${expression}, ${deps}${dts});`;
        }
        return block();
      }
      case "conditional":
        return `if (Date.now() > 0) {\n${block()}\n}`;
      default:
        return block();
    }
  };

  return {
    useState: names.useState,
    useEffect: names.useEffect,
    useContext: names.useContext,
    useRef: names.useRef,
    hopDeclarations,
    usedProps,
    bodyWrap,
    state: (stateName, setterName, initial = "") =>
      stateShape.declare({
        state: stateName,
        setter: setterName,
        initial: ts.initial(initial),
        useState: names.useState,
        declaration: ts.declaration,
      }),
    prop: (name) => {
      if (!usedProps.includes(name)) usedProps.push(name);
      return propShape.expr(name);
    },
    hop: (expr) => {
      let source = expr;
      for (let i = 0; i < hops; i++) {
        const step = hopShape.step(hopCount++, source);
        hopDeclarations.push(...step.declarations);
        source = step.result;
      }
      return source;
    },
    set: ts.setArgument,
    call: (callee, args) => `${callee}${ts.callSuffix}(${args.join(", ")})`,
    effect: callEffect,
  };
};

export const importExtras = (
  style: ImportStyle,
  container: Container,
): readonly string[] =>
  container.extras.length > 0 &&
  style.module === "react" &&
  (style.form === "named" || style.form === "aliased")
    ? container.extras
    : [];

export const buildTemplate = (
  template: Template,
  options: BuilderOptions,
): string => {
  const { style, container, propShape } = options;
  const extras = importExtras(style, container);
  const ctx = buildContext(options);
  const { pre, effect } = template.body(ctx);
  const propsPre = propShape.pre(ctx.usedProps);
  const body = [...propsPre, ...pre, ...ctx.hopDeclarations, effect].join("\n");
  return `${header(style, extras)}\n${container.wrap(
    body,
    resolvers(style),
    propShape.params(ctx.usedProps),
  )}`;
};

// ---------------------------------------------------------------------------

export type ProgramInput = Omit<BuilderOptions, "bodyWrap"> & {
  bodyWrap: BodyWrapper;
};

export const buildProgram = (template: Template, input: ProgramInput): string =>
  buildTemplate(template, {
    style: input.style,
    container: input.container,
    propShape: input.propShape,
    effectShape: input.effectShape,
    ts: input.ts,
    hops: input.hops,
    hopShape: input.hopShape,
    stateShape: input.stateShape,
    bodyWrap: input.bodyWrap.wrap,
  });

export interface CombinationOverrides {
  containers?: Container[];
  bodyWrappers?: BodyWrapper[];
  propShapes?: PropShape[];
  stateShapes?: StateShape[];
}

export const combination = ({
  containers: allowedContainers = containers,
  bodyWrappers = [identityBodyWrapper],
  propShapes: allowedPropShapes = propShapes,
  stateShapes: allowedStateShapes = stateShapes,
}: CombinationOverrides = {}) =>
  fc.record<ProgramInput>({
    style: oneOf(importStyles),
    container: oneOf(allowedContainers),
    propShape: oneOf(allowedPropShapes),
    effectShape: oneOf(effectShapes),
    ts: oneOf(tsWrappers),
    hops: fc.integer({ min: 0, max: 4 }),
    hopShape: oneOf(hopShapes),
    stateShape: oneOf(allowedStateShapes),
    bodyWrap: oneOf(bodyWrappers),
  });

export const describeCombination = (input: ProgramInput): string =>
  [
    input.style.name,
    input.container.name,
    input.propShape.name,
    input.effectShape,
    input.ts.name,
    `${input.hops} hops`,
    input.hopShape.name,
    input.stateShape.name,
    input.bodyWrap.name === "none" ? "" : input.bodyWrap.name,
  ]
    .filter(Boolean)
    .join(", ");
