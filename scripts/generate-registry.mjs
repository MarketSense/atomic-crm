#!/usr/bin/env node

import { globSync } from "glob";
import fs from "node:fs";
import path from "node:path";

const registryPath = "registry.json";
const basePath = "src";
// Glob patterns and registry paths always use forward slashes: path.join would
// produce backslashes on Windows, which glob reads as escapes (matching nothing).
const atomicCrmComponentsPath = path.posix.join(
  basePath,
  "components",
  "atomic-crm",
);
const supabaseComponentsPath = path.posix.join(
  basePath,
  "components",
  "supabase",
);
const hooksPath = path.posix.join(basePath, "hooks");
const libPath = path.posix.join(basePath, "lib");
const globOptions = { posix: true };
// glob returns files in filesystem order, which differs between OSes: sort so
// the generated registry is identical whoever runs the pre-commit hook.
const byPath = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const excludedHooks = [
  "filter-context.tsx",
  "saved-queries.tsx",
  "use-mobile.ts",
  "useSupportCreateSuggestion.tsx",
];

const excludedLibFiles = [
  "field.type.ts",
  "genericMemo.ts",
  "i18nProvider.ts",
  "sanitizeInputRestProps.ts",
  "utils.ts",
];

const testFilePattern = "**/*.{test,spec}.*";
const storyFilePattern = "**/*.stories.*";

const atomicCrmComponents = globSync(
  path.posix.join(atomicCrmComponentsPath, "**", "*.ts*"),
  { ...globOptions, ignore: [testFilePattern, storyFilePattern] },
).sort(byPath);
const supabaseComponents = globSync(
  path.posix.join(supabaseComponentsPath, "**", "*.ts*"),
  { ...globOptions, ignore: [testFilePattern, storyFilePattern] },
).sort(byPath);
const hooks = globSync(path.posix.join(hooksPath, "**", "*.ts*"), globOptions)
  .filter((hook) => {
    return !excludedHooks.includes(path.posix.basename(hook));
  })
  .sort(byPath);
const libFiles = globSync(path.posix.join(libPath, "**", "*.ts*"), globOptions)
  .filter((file) => {
    return !excludedLibFiles.includes(path.posix.basename(file));
  })
  .sort(byPath);
const changelogPath = "CHANGELOG.md";

const registryContent = JSON.parse(fs.readFileSync(registryPath, "utf-8"));

const files = [
  ...atomicCrmComponents.map((path) => {
    return {
      path,
      type: "registry:component",
    };
  }),
  ...supabaseComponents.map((path) => {
    return {
      path,
      type: "registry:component",
    };
  }),
  ...hooks.map((path) => {
    return {
      path,
      type: "registry:hook",
    };
  }),
  ...libFiles.map((path) => {
    return {
      path,
      type: "registry:lib",
    };
  }),
  {
    path: changelogPath,
    type: "registry:file",
    target: "~/CHANGELOG.md",
  },
];

const newRegistryContent = {
  ...registryContent,
  items: registryContent.items.map((item) => {
    if (item.name === "atomic-crm") {
      return {
        ...item,
        files,
      };
    }

    return item;
  }),
};

fs.writeFileSync(
  registryPath,
  JSON.stringify(newRegistryContent, null, 2),
  "utf-8",
);
