import { describe, it } from "node:test";
import fc from "fast-check";
import "./config.ts";
import { containers, opaqueContainers } from "./axes/containers.ts";
import {
  deferredBodyWrappers,
  synchronousBodyWrappers,
} from "./axes/execution-boundaries.ts";
import { opaqueStateShapes } from "./axes/state-declarations.ts";
import { combination, templateResult } from "./builder.ts";
import { checkProgram } from "./check.ts";
import {
  cleanupBodyWrapper,
  cleanupTemplates,
  containerBoundaryTemplates,
  opaqueCallbackTemplates,
  templateFor,
  templates,
} from "./fixtures.ts";
import { oneOf } from "./helpers.ts";

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
    );
  });
});

describe("property: component boundaries", () => {
  it("skips containers that are not components or hooks", () => {
    fc.assert(
      fc.property(
        oneOf(containerBoundaryTemplates),
        combination({ containers: opaqueContainers }),
        (template, input) => {
          checkProgram(template, input, []);
        },
      ),
    );
  });
});

describe("property: state and setter shapes", () => {
  it("ignores reassignable let aliases", () => {
    fc.assert(
      fc.property(combination({ stateShapes: opaqueStateShapes }), (input) => {
        checkProgram(templateFor("no-derived-state"), input, []);
      }),
    );
  });
});

describe("property: effect callback boundaries", () => {
  it("keeps callback parameters and render-time call results opaque", () => {
    fc.assert(
      fc.property(
        fc.record({
          template: oneOf(opaqueCallbackTemplates),
          input: combination(),
        }),
        ({ template, input }) => {
          checkProgram(template, input, []);
        },
      ),
    );
  });

  it("treats a cleanup return as a subscription", () => {
    fc.assert(
      fc.property(
        fc.record({
          template: oneOf(cleanupTemplates),
          input: combination({ bodyWrappers: [cleanupBodyWrapper] }),
        }),
        ({ template, input }) => {
          checkProgram(template, input, []);
        },
      ),
    );
  });
});
