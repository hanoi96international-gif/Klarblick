// ESLint-Konfiguration für den gesamten Workspace.
//
// Bewusst schmal gehalten: die Regeln sollen Fehler finden, nicht über
// Formatierung streiten. Wichtigster Zugewinn sind die react-hooks-Regeln —
// eine vergessene Abhängigkeit in useMemo liefert stillschweigend veraltete
// Ergebnisse, was in einem Detektor besonders unangenehm wäre.

import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "landing/klarblick.css",
      "landing/fonts/**",
    ],
  },

  js.configs.recommended,

  // Gemeinsame Basis
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": [
        "error",
        // Absichtlich ungenutzte Parameter mit Unterstrich kennzeichnen,
        // z. B. der vierte Parameter im Express-Fehlerhandler.
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      eqeqeq: ["error", "smart"],
      "no-var": "error",
      "prefer-const": "error",
      "no-console": "off",
    },
  },

  // Erkennungslogik: läuft in Browser und Node, deshalb keine umgebungs-
  // spezifischen Globals erlauben.
  {
    files: ["shared/**/*.js"],
    languageOptions: {
      globals: { ...globals.es2021 },
    },
  },

  // Backend
  {
    files: ["backend/**/*.js"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Frontend
  {
    files: ["frontend/**/*.{js,jsx}"],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  // Tests
  {
    files: ["**/test/**/*.{js,jsx}"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },

  // Konfigurationsdateien laufen unter Node, auch die innerhalb der Pakete.
  // Muss nach den Paket-Blöcken stehen, sonst überschreibt frontend/** die
  // Node-Globals wieder mit denen des Browsers.
  {
    files: ["**/*.config.{js,mjs}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
