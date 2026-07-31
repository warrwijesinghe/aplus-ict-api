import globals from "globals";

export default [
  { ignores: ["node_modules/**", "storage/**"] },
  {
    files: ["**/*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_" }] },
  },
];
