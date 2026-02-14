import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
    "lib/db.ts",
    "**/node_modules/**",
    "**/package-lock.json",
    ".vercel/**",
    "playwright-report/**",
    "test-results/**",
    "coverage/**"
  ]),
  {
    files: ["**/*.js", "scripts/**/*.js"], 
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-var-requires": "off"
    },
  },
]);

export default eslintConfig;
