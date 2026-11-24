export interface PartitionHelpers {
  /** The expression that reads the named prop or callback. */
  prop: (name: string) => string;
  useRef: string;
  useContext: string;
}

export interface TriggerSource {
  name: string;
  isState: boolean;
  isExternal: boolean;
  expression: (helpers: PartitionHelpers) => string;
  declarations: (helpers: PartitionHelpers) => string[];
}

export const triggerSources: TriggerSource[] = [
  {
    name: "internal state",
    isState: true,
    isExternal: false,
    expression: () => "a",
    declarations: () => [],
  },
  {
    name: "prop",
    isState: false,
    isExternal: true,
    expression: (helpers) => helpers.prop("items"),
    declarations: () => [],
  },
  {
    name: "external hook value",
    isState: false,
    isExternal: true,
    expression: () => "data",
    declarations: () => ["const { data } = useQuery('/data');"],
  },
  {
    name: "ref current",
    isState: false,
    isExternal: false,
    expression: () => "nodeRef.current",
    declarations: (helpers) => [`const nodeRef = ${helpers.useRef}();`],
  },
  {
    name: "context value",
    isState: false,
    isExternal: true,
    expression: () => "theme",
    declarations: (helpers) => [
      `const theme = ${helpers.useContext}(ThemeContext);`,
    ],
  },
  {
    name: "global alias",
    isState: false,
    isExternal: false,
    expression: () => "globalAlias.title",
    declarations: () => ["const globalAlias = window;"],
  },
];

export interface WrittenSource {
  name: string;
  value: (dependency: string) => string;
}

export const writtenSources: WrittenSource[] = [
  { name: "dependency", value: (dependency) => dependency },
  { name: "literal", value: () => "null" },
  { name: "internal state", value: () => "a" },
];
