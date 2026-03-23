// eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginN from "eslint-plugin-n";

export default tseslint.config(
  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript recommended rules
  ...tseslint.configs.recommended,

  // Node.js plugin — flat config for ESM packages
  pluginN.configs["flat/recommended-module"],

  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },

    rules: {
      // ── TypeScript ──────────────────────────────────────────────────────
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // ── Node.js ─────────────────────────────────────────────────────────
      // TypeScript handles module resolution; disable Node plugin's import check
      // to avoid false positives with .js extension imports required for Node16 ESM
      "n/no-missing-import": "off",
      "n/no-unsupported-features/es-syntax": "off",
      // fetch is stable in Node 20+ (undici-based); plugin incorrectly flags it
      "n/no-unsupported-features/node-builtins": ["error", {
        ignores: ["fetch"],
      }],
      // zod is re-exported by @modelcontextprotocol/sdk; not a direct dependency
      "n/no-extraneous-import": ["error", {
        allowModules: ["zod"],
      }],
      // Shutdown handlers legitimately need process.exit()
      "n/no-process-exit": "off",

      // ── General ─────────────────────────────────────────────────────────
      // Warn rather than error: MCP servers use console.error for stderr output
      "no-console": ["warn", { allow: ["error"] }],
      "consistent-return": "error",
      eqeqeq: ["error", "always"],
      "prefer-const": "error",
    },
  },

  // src/index.ts compiles to dist/index.js which is listed in bin —
  // but the actual shebang entry point is bin/gemini-stitch-mcp.js
  {
    files: ["src/index.ts"],
    rules: {
      "n/hashbang": "off",
    },
  },

  // Ignore compiled output and dependencies
  {
    ignores: ["dist/", "node_modules/", "coverage/"],
  }
);
