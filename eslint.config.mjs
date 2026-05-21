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
  ]),
  {
    rules: {
      "no-var": "off",
      "no-empty": "off",
      "no-unused-vars": "off",
      "no-useless-assignment": "off",
      "prefer-const": "off",
      "@typescript-eslint/triple-slash-reference": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-useless-assignment": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
]);

export default eslintConfig;
