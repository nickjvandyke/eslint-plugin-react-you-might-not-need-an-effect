import fc from "fast-check";
import globals from "globals";
import assert from "assert";
import { describe, it } from "node:test";
import {
  diagnostic,
  lint,
  lintInput,
  lintMessages,
  oneOf,
  rulePrefix,
  stateRuleIds,
  type Diagnostic,
  type LintOptions,
} from "./property/helpers.ts";
import {
  containers,
  deferredBodyWrappers,
  opaqueContainers,
  opaqueStateShapes,
  synchronousBodyWrappers,
  triggerSources,
  tsContainers,
  tsPropShapes,
  writtenSources,
  type PartitionHelpers,
  type TriggerSource,
  type WrittenSource,
} from "./property/axes.ts";
import {
  buildProgram,
  combination,
  describeCombination,
  templateResult,
  type ProgramInput,
  type Template,
} from "./property/builder.ts";
import { templates, validTemplate } from "./property/fixtures.ts";

/**
 * Generates a program from `template` and `input`, then compares its
 * diagnostics. The message names the combination that failed.
 */
const checkProgram = (
  template: Template,
  input: ProgramInput,
  expected: Diagnostic[],
  options: { ts?: boolean } = {},
): void => {
  const code = buildProgram(template, input);
  const actual = options.ts ? lint(code, { ts: true }) : lintInput(code, input);
  assert.deepStrictEqual(
    actual,
    expected,
    `${template.rule ? `${template.rule}: ` : ""}${describeCombination(input)}\n${code}`,
  );
};

// ---------------------------------------------------------------------------
// Property: transparent syntax preserves every canonical diagnostic
// ---------------------------------------------------------------------------

for (const template of templates) {
  describe(`property: ${template.rule} survives transparent syntax`, () => {
    const allowedContainers = containers.filter(
      (container) => !(template.skipHooks && container.hook),
    );

    it("reports the expected diagnostics for every combination", () => {
      fc.assert(
        fc.property(combination({ containers: allowedContainers }), (input) => {
          checkProgram(
            template,
            input,
            templateResult(template, input.container),
          );
        }),
        { numRuns: 100 },
      );
    });
  });
}

describe("property: valid code survives transparent syntax", () => {
  it("reports nothing for every combination", () => {
    fc.assert(
      fc.property(combination(), (input) => {
        checkProgram(validTemplate, input, []);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property: opaque execution boundaries suppress every finding
// ---------------------------------------------------------------------------

describe("property: deferred effect bodies suppress every finding", () => {
  it("reports nothing inside async and deferred callbacks", () => {
    fc.assert(
      fc.property(
        fc.record({
          template: oneOf(templates),
          input: combination({ bodyWrappers: deferredBodyWrappers }),
        }),
        ({ template, input }) => {
          checkProgram(template, input, []);
        },
      ),
      { numRuns: 120 },
    );
  });
});

describe("property: synchronous effect bodies preserve every finding", () => {
  it("keeps the diagnostic inside synchronous wrappers", () => {
    fc.assert(
      fc.property(
        fc.record({
          template: oneOf(templates),
          input: combination({
            containers: containers.filter((container) => !container.hook),
            bodyWrappers: synchronousBodyWrappers,
          }),
        }),
        ({ template, input }) => {
          checkProgram(
            template,
            input,
            templateResult(template, input.container),
          );
        },
      ),
      { numRuns: 120 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property: state-setter rules partition one setter
// ---------------------------------------------------------------------------

/** One template per trigger and written-value pair, shared by every axis. */
const partitionTemplate = (
  trigger: TriggerSource,
  written: WrittenSource,
  cleanup: boolean,
): Template => ({
  rule: "",
  messageId: "",
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

const expectedStateRule = (
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

describe("property: state-setter rules partition one setter", () => {
  it("reports at most one state-setter rule, and the expected one", () => {
    fc.assert(
      fc.property(
        fc.record({
          trigger: oneOf(triggerSources),
          written: oneOf(writtenSources),
          cleanup: fc.boolean(),
          input: combination(),
        }),
        ({ trigger, written, cleanup, input }) => {
          const code = buildProgram(
            partitionTemplate(trigger, written, cleanup),
            input,
          );
          const reportedRules = lintInput(code, input)
            .map(({ ruleId }) => ruleId)
            .filter((ruleId) =>
              stateRuleIds.some((rule) => ruleId === `${rulePrefix}/${rule}`),
            );
          const expectedRule = expectedStateRule(
            trigger,
            written,
            cleanup,
            input.hops,
          );
          assert.deepStrictEqual(
            reportedRules,
            expectedRule ? [`${rulePrefix}/${expectedRule}`] : [],
            `${trigger.name}, ${written.name}, cleanup=${cleanup}, ${describeCombination(input)}\n${code}`,
          );
        },
      ),
      { numRuns: 300 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property: component and hook boundaries (src/util/components.ts)
// ---------------------------------------------------------------------------

describe("property: component boundaries", () => {
  const propTemplates = templates.filter(
    (template) =>
      template.rule === "no-pass-live-state-to-parent" ||
      template.rule === "no-pass-data-to-parent" ||
      template.rule === "no-reset-all-state-on-prop-change",
  );

  it("skips containers that are not components or hooks", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...propTemplates),
        combination({ containers: opaqueContainers }),
        (template, input) => {
          checkProgram(template, input, []);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property: property access shapes and external values
// ---------------------------------------------------------------------------

describe("property: prop access shapes", () => {
  it("treats context values like props", () => {
    const contextTemplates: Template[] = [
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
    fc.assert(
      fc.property(
        fc.record({
          template: oneOf(contextTemplates),
          input: combination(),
        }),
        ({ template, input }) => {
          checkProgram(template, input, [
            diagnostic("no-derived-state", "avoidDerivedState"),
          ]);
        },
      ),
      { numRuns: 60 },
    );
  });

  it("does not treat ref reads as render values", () => {
    const refTemplates: Template[] = [
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
    fc.assert(
      fc.property(
        fc.record({
          template: oneOf(refTemplates),
          input: combination(),
        }),
        ({ template, input }) => {
          checkProgram(template, input, []);
        },
      ),
      { numRuns: 60 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property: browser globals (src/util/props.ts)
// ---------------------------------------------------------------------------

describe("property: browser globals", () => {
  const globalReads: [string, string][] = [
    ["window", ".innerWidth"],
    ["navigator", ".onLine"],
    ["localStorage", ".getItem('key')"],
    ["document", ".title"],
  ];

  // Alias the global object itself, so the alias is still a global value.
  // `const value = window.innerWidth` would make `value` an ordinary local.
  const aliasRoot = (
    root: string,
    hops: number,
  ): { declarations: string[]; source: string } => {
    let source = root;
    const declarations: string[] = [];
    for (let i = 0; i < hops; i++) {
      declarations.push(`const g${i} = ${source};`);
      source = `g${i}`;
    }
    return { declarations, source };
  };

  const configurations: [string, LintOptions][] = [
    ["without browser globals", {}],
    ["with browser globals", { globals: globals.browser }],
  ];

  it("gives the same results with and without configured globals", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...globalReads),
        fc.integer({ min: 0, max: 3 }),
        ([root, member], hops) => {
          const { declarations, source } = aliasRoot(root, hops);
          const expression = `${source}${member}`;
          const code = `
            import { useEffect, useState } from 'react';
            function Child({ onFetched }) {
              const [value, setValue] = useState();
              ${declarations.join("\n")}
              useEffect(() => {
                setValue(${expression});
                onFetched(${expression});
              }, [onFetched, ${expression}]);
            }
          `;
          const results = configurations.map(([, options]) =>
            lint(code, options),
          );
          assert.deepStrictEqual(results[0], results[1], code);
          // The global read reaches the parent callback, so the property must
          // observe it. Otherwise it would pass with an empty result list.
          assert.deepStrictEqual(
            results[0]
              .map(({ messageId }) => messageId)
              .includes("avoidPassingDataToParentInComponent"),
            true,
            code,
          );
        },
      ),
      { numRuns: 60 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property: state declarations and setter aliases (src/util/state.ts)
// ---------------------------------------------------------------------------

describe("property: state and setter shapes", () => {
  it("ignores reassignable let aliases", () => {
    const derived = templates.find(
      (template) => template.rule === "no-derived-state",
    ) as Template;
    fc.assert(
      fc.property(combination({ stateShapes: opaqueStateShapes }), (input) => {
        checkProgram(derived, input, []);
      }),
      { numRuns: 60 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property: TypeScript type-only syntax (src/util/typescript.ts)
// ---------------------------------------------------------------------------

describe("property: TypeScript type-only syntax", () => {
  const typeOnlyTemplate: Template = {
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
  const asConstTemplate: Template = {
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

  it("does not count type-only references as runtime reads", () => {
    fc.assert(
      fc.property(combination(), (input) => {
        checkProgram(
          typeOnlyTemplate,
          input,
          [diagnostic("no-initialize-state", "avoidInitializingState")],
          { ts: true },
        );
      }),
      { numRuns: 60 },
    );
  });

  it("treats an as-const local object as data, not a parent value", () => {
    fc.assert(
      fc.property(combination(), (input) => {
        checkProgram(asConstTemplate, input, [], { ts: true });
      }),
      { numRuns: 60 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property: TypeScript-only syntax slots
// ---------------------------------------------------------------------------

describe("property: TypeScript-only wrappers", () => {
  const passLiveTemplate = templates.find(
    (template) => template.rule === "no-pass-live-state-to-parent",
  ) as Template;
  const componentContainers = containers.filter((container) => !container.hook);

  it("reads props through an asserted props object", () => {
    fc.assert(
      fc.property(
        combination({
          containers: componentContainers,
          propShapes: tsPropShapes,
        }),
        (input) => {
          checkProgram(
            passLiveTemplate,
            input,
            templateResult(passLiveTemplate, input.container),
            { ts: true },
          );
        },
      ),
      { numRuns: 80 },
    );
  });

  it("sees through assertions on the component expression", () => {
    fc.assert(
      fc.property(combination({ containers: tsContainers }), (input) => {
        checkProgram(
          passLiveTemplate,
          input,
          templateResult(passLiveTemplate, input.container),
          { ts: true },
        );
      }),
      { numRuns: 80 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property: opaque effect callback and cleanup boundaries (src/util/effect.ts)
// ---------------------------------------------------------------------------

describe("property: effect callback boundaries", () => {
  it("keeps callback parameters and render-time call results opaque", () => {
    const opaqueTemplates: Template[] = [
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
    fc.assert(
      fc.property(
        fc.record({
          template: oneOf(opaqueTemplates),
          input: combination(),
        }),
        ({ template, input }) => {
          checkProgram(template, input, []);
        },
      ),
      { numRuns: 60 },
    );
  });

  it("treats a cleanup return as a subscription", () => {
    const cleanupTemplates = templates.filter(
      (template) =>
        template.rule === "no-derived-state" ||
        template.rule === "no-chain-state-updates" ||
        template.rule === "no-event-handler" ||
        template.rule === "no-pass-data-to-parent",
    );
    fc.assert(
      fc.property(
        fc.record({
          template: oneOf(cleanupTemplates),
          input: combination({
            bodyWrappers: [
              {
                name: "cleanup return",
                wrap: (body) => `${body}\nreturn () => cleanup();`,
              },
            ],
          }),
        }),
        ({ template, input }) => {
          checkProgram(template, input, []);
        },
      ),
      { numRuns: 60 },
    );
  });

  it("reports every statement in a multi-statement body", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4 }), (statements) => {
        const setters = Array.from(
          { length: statements },
          () => "setDouble(count * 2);",
        ).join("\n");
        const code = `
          const C = () => {
            const [count, setCount] = useState(0);
            const [double, setDouble] = useState(0);
            useEffect(() => {
              ${setters}
            }, [count]);
          };
        `;
        assert.deepStrictEqual(
          lint(code),
          Array.from({ length: statements }, () =>
            diagnostic("no-derived-state", "avoidDerivedState"),
          ),
          code,
        );
      }),
      { numRuns: 20 },
    );
  });
});

// ---------------------------------------------------------------------------
// Termination and opaque call chains
// ---------------------------------------------------------------------------

describe("property: deep local call chains terminate", () => {
  it("survives a chain of up to 25 local functions", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 25 }), (depth) => {
        const declarations = ["const f0 = (v) => v;"];
        for (let i = 1; i <= depth; i++) {
          declarations.push(`const f${i} = (v) => f${i - 1}(v);`);
        }
        const code = `
          function C() {
            const [count, setCount] = useState(0);
            const [double, setDouble] = useState(0);
            ${declarations.join("\n")}
            useEffect(() => {
              setDouble(f${depth}(count * 2));
            }, [count]);
          }
        `;
        assert.deepStrictEqual(
          lint(code),
          [diagnostic("no-derived-state", "avoidDerivedState")],
          code,
        );
      }),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Message wording
// ---------------------------------------------------------------------------

describe("property: message formatting", () => {
  it("quotes every name in a dependency list", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (count) => {
        const names = Array.from(
          { length: count },
          (_, index) => `value${index}`,
        );
        const list = names.join(", ");
        const code = `
          function C({ ${list} }) {
            const [selection, setSelection] = useState();
            useEffect(() => { setSelection(null); }, [${list}]);
          }
        `;
        const [message] = lintMessages(code);
        const expected = names.map((name) => `"${name}"`).join(" and ");
        assert.strictEqual(
          message.message.includes(expected),
          true,
          `${expected}\n${message.message}`,
        );
      }),
      { numRuns: 20 },
    );
  });
});
