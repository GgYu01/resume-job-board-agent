import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");

test("package exposes build, typecheck, contract, and verify scripts", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.type, "module");
  assert.equal(pkg.scripts.build, "tsc -p tsconfig.json");
  assert.equal(pkg.scripts.typecheck, "tsc --noEmit -p tsconfig.json");
  assert.match(pkg.scripts.test, /test\/contracts\/\*\.test\.mjs/);
  assert.equal(pkg.scripts.verify, "npm run typecheck && npm test");
  assert.match(pkg.dependencies.zod, /^\^4\./);
  assert.match(pkg.dependencies.yaml, /^\^2\./);
  assert.match(pkg.dependencies.commander, /^\^14\./);
  assert.match(pkg.devDependencies.typescript, /^\^5\./);
  assert.match(pkg.devDependencies["@types/node"], /^\^24\./);
});

test("tsconfig is strict NodeNext ESM and builds only TypeScript source", () => {
  const tsconfig = JSON.parse(fs.readFileSync(path.join(ROOT, "tsconfig.json"), "utf8"));
  assert.equal(tsconfig.compilerOptions.strict, true);
  assert.equal(tsconfig.compilerOptions.module, "NodeNext");
  assert.equal(tsconfig.compilerOptions.moduleResolution, "NodeNext");
  assert.equal(tsconfig.compilerOptions.outDir, "dist");
  assert.deepEqual(tsconfig.include, ["src/**/*.ts"]);
});
