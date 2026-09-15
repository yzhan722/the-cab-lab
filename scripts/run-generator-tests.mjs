#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "generators/smallCabinet/generator.test.ts",
  "generators/overheadCabinet/generator.test.ts",
  "generators/generalTall/stackingCalculator.test.ts",
  "generators/generalTall/boundaryResolver.test.ts",
  "generators/generalTall/assemblyOverlapAudit.test.ts",
  "generators/generalTall/fridgeZone.test.ts",
  "generators/generalTall/generalTallCabinet.regression.test.ts",
  "generators/generalTall/generator.test.ts",
  "generators/lounge/generator.test.ts",
  "generators/test/first-pass.test.ts",
  "generators/test/oracle-parity.test.ts",
  "generators/test/simulate-user-modules.test.ts",
  "generators/test/panel-options.test.ts",
  "generators/test/u-overhead.test.ts",
  "generators/test/lounge-place.test.ts",
];

let failed = 0;
for (const file of files) {
  console.log(`\n=== ${file} ===`);
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", file],
    { cwd: root, stdio: "inherit" },
  );
  if (r.status !== 0) failed += 1;
}
if (failed > 0) {
  console.error(`\n${failed}/${files.length} suites failed`);
  process.exit(1);
}
console.log(`\nAll ${files.length} generator suites passed`);
