import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/* State module convention: files under the state folder of any feature
   (features/<module>/state/) split by concern: types.ts, constants.ts,
   actions.ts, reducer.ts, context.ts, *Provider.tsx, hooks.ts. One concern
   per file — a module that both creates the context AND owns the reducer's
   useReducer call is the megafile pattern. */
const stateStructurePlugin = {
  rules: {
    "no-state-spaghetti": {
      meta: {
        type: "problem",
        docs: { description: "State modules must split concerns: createContext and useReducer in separate files." },
        messages: { mix: "Split this state module: createContext and useReducer in the same file violate the one-concern-per-file rule (state/types.ts, constants.ts, actions.ts, reducer.ts, context.ts, *Provider.tsx, hooks.ts)." },
      },
      create(context) {
        let hasContext = false;
        let hasReducer = false;
        return {
          CallExpression(node) {
            const name = node.callee.type === "Identifier" ? node.callee.name : null;
            if (name === "createContext") hasContext = true;
            if (name === "useReducer") hasReducer = true;
          },
          "Program:exit"() {
            if (hasContext && hasReducer) context.report({ messageId: "mix", loc: { line: 1, column: 0 } });
          },
        };
      },
    },
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Placed AFTER nextVitals/nextTs so the structural rule isn't overridden.
  {
    plugins: { state: stateStructurePlugin },
    files: ["features/**/state/**/*.{ts,tsx}"],
    rules: { "state/no-state-spaghetti": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
