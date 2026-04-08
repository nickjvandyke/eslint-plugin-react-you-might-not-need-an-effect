import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  format: ["esm", "cjs"],
  platform: "node",
  sourcemap: true,
  dts: {
    enabled: true,
    sourcemap: true,
    tsgo: true,
  },
  publint: {
    enabled: true,
    level: "error",
  },
  attw: {
    enabled: true,
    level: "error",
    profile: "node16", // Ignore node10 resolution errors - we require node 14+
  },
});
