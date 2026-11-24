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
