/** Opaque execution boundaries. Findings inside these must not be reported. */
export interface BodyWrapper {
  name: string;
  wrap: (body: string) => string;
}

export const identityBodyWrapper: BodyWrapper = {
  name: "none",
  wrap: (body: string) => body,
};

export const deferredBodyWrappers: BodyWrapper[] = [
  {
    name: "async IIFE",
    wrap: (body) => `(async () => {\n${body}\n})();`,
  },
  {
    name: "void async IIFE",
    wrap: (body) => `void (async () => {\n${body}\n})();`,
  },
  {
    name: "promise then callback",
    wrap: (body) => `Promise.resolve().then(() => {\n${body}\n});`,
  },
  {
    name: "constructor callback",
    // Calling a method on the constructor result must not run the callback
    // that was passed to the constructor.
    wrap: (body) =>
      `const observer = new ResizeObserver(() => {\n${body}\n});\nobserver.observe(document.body);`,
  },
  {
    name: "uncalled helper",
    wrap: (body) => `const later = () => {\n${body}\n};`,
  },
  {
    name: "call expression callback",
    wrap: (body) =>
      `function later() {\n${body}\n}\nconst observer = createResizeObserver(later);\nobserver.observe(document.body);`,
  },
  {
    name: "called async arrow",
    wrap: (body) => `const load = async () => {\n${body}\n};\nload();`,
  },
  {
    name: "called async declaration",
    wrap: (body) => `async function load() {\n${body}\n}\nload();`,
  },
  {
    name: "event listener callback",
    wrap: (body) =>
      `function later() {\n${body}\n}\ndocument.addEventListener('click', later);`,
  },
];

/** Synchronous wrappers. They run now, so findings stay reported. */
export const synchronousBodyWrappers: BodyWrapper[] = [
  {
    name: "synchronous IIFE",
    wrap: (body) => `(() => {\n${body}\n})();`,
  },
  {
    name: "called helper",
    wrap: (body) => `const run = () => {\n${body}\n};\nrun();`,
  },
  {
    name: "nested conditional",
    wrap: (body) => `if (Date.now() > 0) {\n${body}\n}`,
  },
];
