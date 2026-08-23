import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import process from "node:process";

const root = process.cwd();
const roots = [
  "src/main",
  "src/preload",
  "src/renderer",
  "scripts",
  ".github",
  "docs",
  "build",
];
const topLevel = [
  ".env.example",
  "LICENSE",
  "package.json",
  "README.md",
  "PRODUCT.md",
  "DESIGN.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "THIRD_PARTY_NOTICES.md",
  "electron.vite.config.ts",
  "playwright.config.ts",
];
const textExtensions = new Set([
  ".cjs",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".svg",
  ".ts",
  ".tsx",
  ".yml",
  ".yaml",
]);
const excluded = [
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)out\//,
  /(^|\/)verify-brand\.mjs$/,
  /\.test\.[cm]?[jt]sx?$/,
];
const legacyProductNamePattern = new RegExp(`\\b${"Post"}${"ure"}\\b`, "g");
const legacyRepositoryPattern = new RegExp(
  `github\\.com\\/vivaanseth\\/(?:${"Post"}${"ure"}|${"post"}${"ure"})(?=[/#"'\\s]|$)`,
  "g",
);
const legacyReleasePrefixPattern = new RegExp(
  `\\b${"Post"}${"ure"}-(?=\\$|v?\\d)`,
  "g",
);
const legacyPackageIdentityPattern = new RegExp(
  `\\b${"post"}${"ure"}-desktop\\b`,
  "g",
);
const legacyAppProtocolPattern = new RegExp(
  `app:\\/\\/${"post"}${"ure"}\\b`,
  "g",
);
const legacyAppIdPattern = new RegExp(
  `\\bapp\\.${"post"}${"ure"}\\.desktop\\b`,
  "g",
);
const forbidden = [
  { label: "legacy visible product name", pattern: legacyProductNamePattern },
  { label: "legacy repository URL", pattern: legacyRepositoryPattern },
  { label: "legacy renderer API", pattern: /window\.posture\b/g },
  { label: "legacy build variable", pattern: /\bPOSTURE_[A-Z0-9_]+\b/g },
  { label: "legacy package identity", pattern: legacyPackageIdentityPattern },
  { label: "legacy app protocol", pattern: legacyAppProtocolPattern },
  { label: "legacy app id", pattern: legacyAppIdPattern },
  { label: "legacy release asset prefix", pattern: legacyReleasePrefixPattern },
];

const files = [];
async function collect(path) {
  const entries = await readdir(join(root, path), { withFileTypes: true });
  for (const entry of entries) {
    const child = join(path, entry.name);
    const normalized = child.replaceAll("\\", "/");
    if (excluded.some((pattern) => pattern.test(normalized))) continue;
    if (entry.isDirectory()) await collect(child);
    else if (entry.isFile() && textExtensions.has(extname(entry.name)))
      files.push(child);
  }
}

for (const path of roots) await collect(path);
files.push(...topLevel);

const failures = [];
for (const file of [...new Set(files)]) {
  const content = await readFile(join(root, file), "utf8");
  for (const rule of forbidden) {
    for (const match of content.matchAll(rule.pattern)) {
      const line = content.slice(0, match.index).split("\n").length;
      const sourceLine = content.split("\n")[line - 1] ?? "";
      if (sourceLine.includes("brand-audit: allow-history")) continue;
      failures.push(
        `${relative(root, join(root, file))}:${line} ${rule.label}`,
      );
    }
  }
}

if (failures.length) {
  console.error("Upright brand audit failed:\n" + failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Upright brand audit passed across ${new Set(files).size} files.`,
  );
}
