import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const outputPath = "./src/features/personal-chat/transport/generated/openapi.ts";
const fallbackSpecPath = path.resolve(
  process.cwd(),
  "..",
  "fullstack_microservice",
  "docs",
  "openapi.yaml",
);
const specPath = process.env.OPENAPI_SPEC
  ? path.resolve(process.cwd(), process.env.OPENAPI_SPEC)
  : fallbackSpecPath;

if (!existsSync(specPath)) {
  console.error(
    `OpenAPI spec not found at "${specPath}". Set OPENAPI_SPEC to a valid path before running this script.`,
  );
  process.exit(1);
}

const cliPath = path.resolve(
  process.cwd(),
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
