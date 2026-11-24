export interface ImportStyle {
  name: string;
  module: string | null;
  form: "named" | "aliased" | "namespace" | "namespaceAlias" | "default";
  namespace?: string;
}

export const importStyles: ImportStyle[] = [
  { name: "named import", module: "react", form: "named" },
  { name: "aliased import", module: "react", form: "aliased" },
  {
    name: "namespace import",
    module: "react",
    form: "namespace",
    namespace: "React",
  },
  {
    name: "renamed namespace import",
    module: "react",
    form: "namespaceAlias",
    namespace: "ReactAlias",
  },
  { name: "default import", module: "react", form: "default" },
  { name: "preact/hooks", module: "preact/hooks", form: "named" },
  { name: "aliased preact/hooks", module: "preact/hooks", form: "aliased" },
  { name: "preact/compat", module: "preact/compat", form: "named" },
  { name: "aliased preact/compat", module: "preact/compat", form: "aliased" },
  { name: "@wordpress/element", module: "@wordpress/element", form: "named" },
  {
    name: "aliased @wordpress/element",
    module: "@wordpress/element",
    form: "aliased",
  },
  { name: "no import", module: null, form: "named" },
];

export interface HookNames {
  useState: string;
  useEffect: string;
  useContext: string;
  useRef: string;
  memo: string;
  forwardRef: string;
}

export const resolvers = (style: ImportStyle): HookNames => {
  const isNamespace =
    style.form === "namespace" || style.form === "namespaceAlias";
  const isDefault = style.form === "default";
  const namespace = style.namespace ?? "React";
  const member = (hook: string): string =>
    isNamespace
      ? `${namespace}.${hook}`
      : isDefault
        ? `ReactAlias.${hook}`
        : hook;
  return {
    useState: member(style.form === "aliased" ? "useStateAlias" : "useState"),
    useEffect: member(
      style.form === "aliased" ? "useEffectAlias" : "useEffect",
    ),
    useContext: member(
      style.form === "aliased" ? "useContextAlias" : "useContext",
    ),
    useRef: member(style.form === "aliased" ? "useRefAlias" : "useRef"),
    memo: member("memo"),
    forwardRef: member("forwardRef"),
  };
};

const assertModule = (style: ImportStyle): void => {
  if (style.module === null) {
    throw new Error(`The ${style.form} import form needs a module`);
  }
};

export const header = (
  style: ImportStyle,
  extras: readonly string[],
): string => {
  if (style.module === null) return "";
  if (style.form === "namespace" || style.form === "namespaceAlias") {
    assertModule(style);
    return `import * as ${style.namespace ?? "React"} from '${style.module}';`;
  }
  if (style.form === "default") {
    assertModule(style);
    return `import ReactAlias from '${style.module}';`;
  }
  const hooks =
    style.form === "aliased"
      ? [
          "useEffect as useEffectAlias",
          "useState as useStateAlias",
          "useContext as useContextAlias",
          "useRef as useRefAlias",
        ]
      : ["useEffect", "useState", "useContext", "useRef"];
  return `import { ${[...hooks, ...extras].join(", ")} } from '${style.module}';`;
};
