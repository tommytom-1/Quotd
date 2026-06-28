import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";

export default defineConfig({
  extends: [core],
  ignorePatterns: core.ignorePatterns,
  rules: {
    "no-use-before-define": "off",
    "func-style": "off",
    "sort-keys": "off",
    "prefer-module": "off",
    "node/global-require": "off",
  },
});
