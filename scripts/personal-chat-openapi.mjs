import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptFilePath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptFilePath);
const repoRoot = path.resolve(scriptDir, "..");
const outputPath = path.resolve(
  repoRoot,
  "src/features/personal-chat/transport/generated/openapi.ts",
);
const fallbackSpecPath = path.resolve(
  repoRoot,
  "..",
  "fullstack_microservice",
  "docs",
  "openapi.yaml",
);
const specPath = process.env.OPENAPI_SPEC
  ? path.resolve(repoRoot, process.env.OPENAPI_SPEC)
  : fallbackSpecPath;

if (!existsSync(specPath)) {
  console.error(
    `OpenAPI spec not found at "${specPath}". Set OPENAPI_SPEC to a valid path before running this script.`,
  );
  process.exit(1);
}

const cliPath = path.resolve(
  repoRoot,
  "node_modules",
  "openapi-typescript",
  "bin",
  "cli.js",
);

const args = [cliPath, specPath, "--output", outputPath];

if (process.argv.includes("--check")) {
  args.push("--check");
}

const result = spawnSync(process.execPath, args, {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
