import type plugin from "../../src/index.ts";
import { diagnostic, type Diagnostic } from "../harness.ts";
import type { Container } from "./axes/containers.ts";
import type { BodyWrapper } from "./axes/execution-boundaries.ts";
import type { Template, TemplateContext } from "./builder.ts";

// ---------------------------------------------------------------------------

export type RuleName = keyof typeof plugin.rules;

/** The template reports `messageId` in every container. */
const reports = (rule: RuleName, messageId: string) => (): Diagnostic[] => [
  diagnostic(rule, messageId),
];

/** The template reports a different message in a custom hook. */
const reportsWithHookMessage =
  (rule: RuleName, messageId: string, hookMessageId: string) =>
  (container: Container): Diagnostic[] => [
    diagnostic(rule, container.hook ? hookMessageId : messageId),
  ];

/** The template is valid code and reports nothing. */
const reportsNothing = (): Diagnostic[] => [];

/**
 * One template per rule. A missing, stale, or duplicate rule is a type error,
 * so the property matrix cannot silently skip a rule.
 */
const templatesByRule = {
  "no-derived-state": {
    expected: reports("no-derived-state", "avoidDerivedState"),
    suppressedByCleanup: true,
    body: (ctx) => ({
      pre: [
        ctx.state("count", "setCount", "0"),
        ctx.state("double", "setDouble", "0"),
      ],
      effect: ctx.effect(
        `setDouble(${ctx.set(`${ctx.hop("count")} * 2`)})`,
        "[count]",
      ),
    }),
  },
  "no-chain-state-updates": {
    expected: reports("no-chain-state-updates", "avoidChainingStateUpdates"),
    suppressedByCleanup: true,
    body: (ctx) => ({
      pre: [
        ctx.state("count", "setCount", "0"),
        ctx.state("isEven", "setIsEven", "false"),
      ],
      effect: ctx.effect(`setIsEven(true)`, `[${ctx.hop("count")}]`),
    }),
  },
  "no-event-handler": {
    expected: reports("no-event-handler", "avoidEventHandler"),
    suppressedByCleanup: true,
    body: (ctx) => ({
      pre: [ctx.state("dataToSubmit", "setDataToSubmit")],
      effect: ctx.effect(
        `if (${ctx.hop("dataToSubmit")}) { submitData(dataToSubmit); }`,
        "[dataToSubmit]",
      ),
    }),
  },
  "no-adjust-state-on-prop-change": {
    expected: reports(
      "no-adjust-state-on-prop-change",
      "avoidAdjustingStateWhenAValueChanges",
    ),
    body: (ctx) => ({
      // `useState()` initializes to `undefined`, so setting `null` is not a
      // full reset by `no-reset-all-state-on-prop-change`.
      pre: [ctx.state("selection", "setSelection")],
      effect: ctx.effect(
        `setSelection(null)`,
        `[${ctx.hop(ctx.prop("items"))}]`,
      ),
    }),
  },
  "no-initialize-state": {
    expected: reports("no-initialize-state", "avoidInitializingState"),
    body: (ctx) => ({
      pre: [ctx.state("message", "setMessage")],
      effect: ctx.effect(`setMessage(${ctx.set(`'Hello'`)})`, "[]"),
    }),
  },
  "no-external-store-subscription": {
    expected: reports(
      "no-external-store-subscription",
      "avoidExternalStoreSubscription",
    ),
    body: (ctx) => ({
      pre: [
        ctx.state("online", "setOnline", "true"),
        `const update = () => setOnline(${ctx.set("navigator.onLine")});`,
      ],
      effect: ctx.effect(
        ["window.addEventListener('online', update);", "update();"].join("\n"),
        "[]",
        "return () => window.removeEventListener('online', update);",
      ),
    }),
  },
  "no-reset-all-state-on-prop-change": {
    // A custom hook cannot receive `key`, so the adjust rule takes over there.
    expected: (container) =>
      container.hook
        ? [
            diagnostic(
              "no-adjust-state-on-prop-change",
              "avoidAdjustingStateWhenAValueChanges",
            ),
          ]
        : [
            diagnostic(
              "no-reset-all-state-on-prop-change",
              "avoidResettingAllStateWhenAPropChanges",
            ),
          ],
    needsComponentOrHook: true,
    body: (ctx) => ({
      pre: [ctx.state("user", "setUser", "null")],
      effect: ctx.effect("setUser(null)", `[${ctx.hop(ctx.prop("userId"))}]`),
    }),
  },
  "no-pass-live-state-to-parent": {
    expected: reportsWithHookMessage(
      "no-pass-live-state-to-parent",
      "avoidPassingLiveStateToParentInComponent",
      "avoidPassingLiveStateToParentInHook",
    ),
    needsComponentOrHook: true,
    body: (ctx) => ({
      pre: [ctx.state("data", "setData")],
      effect: ctx.effect(
        ctx.call(ctx.prop("onFetched"), [ctx.hop("data")]),
        `[${ctx.prop("onFetched")}, data]`,
      ),
    }),
  },
  "no-pass-data-to-parent": {
    expected: reportsWithHookMessage(
      "no-pass-data-to-parent",
      "avoidPassingDataToParentInComponent",
      "avoidPassingDataToParentInHook",
    ),
    needsComponentOrHook: true,
    suppressedByCleanup: true,
    body: (ctx) => ({
      pre: ["const { data } = useQuery('/data');"],
      effect: ctx.effect(
        ctx.call(ctx.prop("onFetched"), [ctx.hop("data")]),
        `[${ctx.prop("onFetched")}, data]`,
      ),
    }),
  },
} satisfies Record<RuleName, Omit<Template, "rule">>;

export const templates: Template[] = (
  Object.keys(templatesByRule) as RuleName[]
).map((rule) => ({ rule, ...templatesByRule[rule] }));

// A valid effect that no rule should flag. It still has deps and state, so
// wrappers must not create a false positive.
export const validTemplate: Template = {
  expected: reportsNothing,
  body: (ctx: TemplateContext) => ({
    pre: [ctx.state("value", "setValue", "''")],
    effect: ctx.effect(`document.title = ${ctx.hop("value")};`, "[value]"),
  }),
};

/** Returns the canonical template for `rule`. */
export const templateFor = (rule: RuleName): Template => {
  const template = templates.find((item) => item.rule === rule);
  if (!template) throw new Error(`No template for ${rule}`);
  return template;
};

export const passLiveTemplate = templateFor("no-pass-live-state-to-parent");

/** Templates whose finding needs a container the plugin treats as a component or hook. */
export const containerBoundaryTemplates = templates.filter(
  (template) => template.needsComponentOrHook,
);

/** Templates whose finding a cleanup return must suppress. */
export const cleanupTemplates = templates.filter(
  (template) => template.suppressedByCleanup,
);

/** Props read through context share the render-value behavior of props. */
export const contextTemplates: Template[] = [
  {
    expected: reports("no-derived-state", "avoidDerivedState"),
    body: (ctx) => ({
      pre: [
        `const theme = ${ctx.useContext}(ThemeContext);`,
        ctx.state("isDark", "setIsDark", "false"),
      ],
      effect: ctx.effect("setIsDark(theme === 'dark')", "[theme]"),
    }),
  },
  {
    expected: reports("no-derived-state", "avoidDerivedState"),
    body: (ctx) => ({
      pre: [
        `const { theme } = ${ctx.useContext}(ThemeContext);`,
        ctx.state("isDark", "setIsDark", "false"),
      ],
      effect: ctx.effect("setIsDark(theme === 'dark')", "[theme]"),
    }),
  },
];

/** Ref reads are not render values. */
export const refTemplates: Template[] = [
  {
    expected: reportsNothing,
    body: (ctx) => ({
      pre: [`const nodeRef = ${ctx.useRef}();`],
      effect: ctx.effect(
        `${ctx.prop("onRef")}(nodeRef.current)`,
        `[${ctx.prop("onRef")}, nodeRef.current]`,
      ),
    }),
  },
  {
    expected: reportsNothing,
    body: (ctx) => ({
      pre: [`const nodeRef = ${ctx.useRef}();`],
      effect: ctx.effect(
        [
          "nodeRef.current.addEventListener('click', (event) => {",
          `  ${ctx.prop("onClicked")}(event);`,
          "});",
        ].join("\n"),
        `[${ctx.prop("onClicked")}, nodeRef]`,
      ),
    }),
  },
  {
    expected: reportsNothing,
    body: (ctx) => ({
      pre: [],
      effect: ctx.effect(
        `${ctx.prop("elementRef")}.current.addEventListener('click', (event) => console.log(event));`,
        `[${ctx.prop("elementRef")}]`,
      ),
    }),
  },
];

/** Callback parameters and render-time call results are opaque. */
export const opaqueCallbackTemplates: Template[] = [
  {
    expected: reportsNothing,
    body: (ctx) => ({
      pre: [ctx.state("count", "setCount", "0"), "setCount(count * 2);"],
      effect: `${ctx.useEffect}(${ctx.prop("callback")}, []);`,
    }),
  },
  {
    expected: reportsNothing,
    body: (ctx) => ({
      pre: [
        ctx.state("count", "setCount", "0"),
        "const effect = makeEffect(setCount(count * 2));",
      ],
      effect: `${ctx.useEffect}(effect, [count]);`,
    }),
  },
];

/** A type-only reference is not a runtime read. */
export const typeOnlyTemplate: Template = {
  expected: reports("no-initialize-state", "avoidInitializingState"),
  body: (ctx) => ({
    pre: [
      ctx.state("count", "setCount", "0"),
      ctx.state("label", "setLabel", "''"),
    ],
    effect: ctx.effect("setLabel(computeLabel() as typeof count)", "[]"),
  }),
};

/** A local `as const` object is data, not a parent value. */
export const asConstTemplate: Template = {
  expected: reportsNothing,
  body: (ctx) => ({
    pre: ["const DATA = { ok: true } as const;"],
    effect: ctx.effect(
      ctx.call(ctx.prop("onData"), ["DATA"]),
      `[${ctx.prop("onData")}]`,
    ),
  }),
};

/** A cleanup return makes the effect a subscription, not a derivation. */
export const cleanupBodyWrapper: BodyWrapper = {
  name: "cleanup return",
  wrap: (body) => `${body}\nreturn () => cleanup();`,
};
