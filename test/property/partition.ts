import type {
  PartitionHelpers,
  TriggerSource,
  WrittenSource,
} from "./axes/state-setter-sources.ts";
import type { Template } from "./builder.ts";

/** One template per trigger and written-value pair, shared by every axis. */
export const partitionTemplate = (
  trigger: TriggerSource,
  written: WrittenSource,
  cleanup: boolean,
): Template => ({
  // The caller computes the expected diagnostic from the trigger and written
  // value, so this template carries no rule outcome.
  expected: () => [],
  body: (ctx) => {
    const helpers: PartitionHelpers = {
      prop: ctx.prop,
      useRef: ctx.useRef,
      useContext: ctx.useContext,
    };
    const dependency = ctx.hop(trigger.expression(helpers));
    const value = written.value(dependency);
    return {
      pre: [
        ctx.state("a", "setA", "0"),
        ctx.state("b", "setB", "0"),
        ...trigger.declarations(helpers),
      ],
      effect: ctx.effect(
        `setB(${ctx.set(value)});`,
        `[${dependency}]`,
        cleanup ? "return () => console.log('cleanup');" : undefined,
      ),
    };
  },
});

export const expectedStateRule = (
  trigger: TriggerSource,
  written: WrittenSource,
  cleanup: boolean,
  hops: number,
): string | undefined => {
  const valueFromDependency =
    written.name === "dependency" ||
    (written.name === "internal state" && trigger.isState);
  // A ref or global is not render-safe, but a const hop turns it into an
  // ordinary local value.
  const renderTrigger = trigger.isState || trigger.isExternal || hops > 0;
  if (valueFromDependency) {
    // A cleanup return makes the effect a subscription, not a derivation.
    return renderTrigger && !cleanup ? "no-derived-state" : undefined;
  }
  if (trigger.isState) {
    return cleanup ? undefined : "no-chain-state-updates";
  }
  // Adjusting state when an external value changes does not depend on a
  // cleanup return.
  return trigger.isExternal ? "no-adjust-state-on-prop-change" : undefined;
};
