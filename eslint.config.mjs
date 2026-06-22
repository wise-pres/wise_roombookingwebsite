import typescriptParser from "@typescript-eslint/parser";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  {
    ignores: [".next/", "coverage/", "node_modules/", "src/data/sop-rooms.json"],
  },
  nextPlugin.flatConfig.coreWebVitals,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "no-constant-binary-expression": "error",
      "no-debugger": "error",
    },
  },
  {
    files: ["src/components/room-image.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
];
