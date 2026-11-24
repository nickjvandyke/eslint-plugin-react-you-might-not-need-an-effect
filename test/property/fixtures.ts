import type { BodyWrapper } from "./axes/execution-boundaries.ts";
import type { Template, TemplateContext } from "./builder.ts";

// ---------------------------------------------------------------------------

export const templates: Template[] = [
  {
    rule: "no-derived-state",
    messageId: "avoidDerivedState",
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
  {
    rule: "no-chain-state-updates",
    messageId: "avoidChainingStateUpdates",
    body: (ctx) => ({
      pre: [
        ctx.state("count", "setCount", "0"),
        ctx.state("isEven", "setIsEven", "false"),
      ],
      effect: ctx.effect(`setIsEven(true)`, `[${ctx.hop("count")}]`),
    }),
  },
  {
    rule: "no-event-handler",
    messageId: "avoidEventHandler",
    body: (ctx) => ({
      pre: [ctx.state("dataToSubmit", "setDataToSubmit")],
      effect: ctx.effect(
        `if (${ctx.hop("dataToSubmit")}) { submitData(dataToSubmit); }`,
        "[dataToSubmit]",
      ),
    }),
  },
  {
    rule: "no-adjust-state-on-prop-change",
    messageId: "avoidAdjustingStateWhenAValueChanges",
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
  {
    rule: "no-initialize-state",
    messageId: "avoidInitializingState",
    body: (ctx) => ({
      pre: [ctx.state("message", "setMessage")],
      effect: ctx.effect(`setMessage(${ctx.set(`'Hello'`)})`, "[]"),
    }),
  },
  {
    rule: "no-external-store-subscription",
    messageId: "avoidExternalStoreSubscription",
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
  {
    rule: "no-reset-all-state-on-prop-change",
    messageId: "avoidResettingAllStateWhenAPropChanges",
    // Custom hooks cannot receive `key`, so the rule skips them.
    skipHooks: true,
    body: (ctx) => ({
      pre: [ctx.state("user", "setUser", "null")],
      effect: ctx.effect("setUser(null)", `[${ctx.hop(ctx.prop("userId"))}]`),
    }),
  },
  {
    rule: "no-pass-live-state-to-parent",
    messageId: "avoidPassingLiveStateToParentInComponent",
    hookMessageId: "avoidPassingLiveStateToParentInHook",
    body: (ctx) => ({
      pre: [ctx.state("data", "setData")],
      effect: ctx.effect(
        ctx.call(ctx.prop("onFetched"), [ctx.hop("data")]),
        `[${ctx.prop("onFetched")}, data]`,
      ),
    }),
  },
  {
    rule: "no-pass-data-to-parent",
    messageId: "avoidPassingDataToParentInComponent",
    hookMessageId: "avoidPassingDataToParentInHook",
    body: (ctx) => ({
      pre: ["const { data } = useQuery('/data');"],
      effect: ctx.effect(
        ctx.call(ctx.prop("onFetched"), [ctx.hop("data")]),
        `[${ctx.prop("onFetched")}, data]`,
      ),
    }),
  },
];

// A valid effect that no rule should flag. It still has deps and state, so
// wrappers must not create a false positive.
export const validTemplate: Template = {
  rule: "",
  messageId: "",
  body: (ctx: TemplateContext) => ({
    pre: [ctx.state("value", "setValue", "''")],
    effect: ctx.effect(`document.title = ${ctx.hop("value")};`, "[value]"),
  }),
};

/** Returns the canonical template for `rule`. */
export const templateFor = (rule: string): Template => {
  const template = templates.find((item) => item.rule === rule);
  if (!template) throw new Error(`No template for ${rule}`);
  return template;
};

export const passLiveTemplate = templateFor("no-pass-live-state-to-parent");

/** Templates whose finding needs a container the plugin treats as a component or hook. */
export const containerBoundaryTemplates = templates.filter((template) =>
  [
    "no-pass-live-state-to-parent",
    "no-pass-data-to-parent",
    "no-reset-all-state-on-prop-change",
  ].includes(template.rule),
);

/** Templates whose finding a cleanup return must suppress. */
export const cleanupTemplates = templates.filter((template) =>
  [
    "no-derived-state",
    "no-chain-state-updates",
    "no-event-handler",
    "no-pass-data-to-parent",
  ].includes(template.rule),
);

/** Props read through context share the render-value behavior of props. */
export const contextTemplates: Template[] = [
  {
    rule: "no-derived-state",
    messageId: "avoidDerivedState",
    body: (ctx) => ({
      pre: [
        `const theme = ${ctx.useContext}(ThemeContext);`,
        ctx.state("isDark", "setIsDark", "false"),
      ],
      effect: ctx.effect("setIsDark(theme === 'dark')", "[theme]"),
    }),
  },
  {
    rule: "no-derived-state",
    messageId: "avoidDerivedState",
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
    rule: "",
    messageId: "",
    body: (ctx) => ({
      pre: [`const nodeRef = ${ctx.useRef}();`],
      effect: ctx.effect(
        `${ctx.prop("onRef")}(nodeRef.current)`,
        `[${ctx.prop("onRef")}, nodeRef.current]`,
      ),
    }),
  },
  {
    rule: "",
    messageId: "",
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
    rule: "",
    messageId: "",
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
    rule: "",
    messageId: "",
    body: (ctx) => ({
      pre: [ctx.state("count", "setCount", "0"), "setCount(count * 2);"],
      effect: `${ctx.useEffect}(${ctx.prop("callback")}, []);`,
    }),
  },
  {
    rule: "",
    messageId: "",
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
  rule: "no-initialize-state",
  messageId: "avoidInitializingState",
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
  rule: "",
  messageId: "",
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
