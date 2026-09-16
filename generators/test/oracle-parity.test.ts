import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateGeneralTallCabinet as nativeGt } from "../generalTall/generator.ts";
import { generateKitchenCabinetGeometry as nativeKitchen } from "../kitchen/generator.ts";
import { generateLoungeGeometry as nativeLounge } from "../lounge/generator.ts";
import { generateGeneralTallCabinet as oracleGt } from "./reference-fusion/modules/generalTallCabinet/generator.ts";
import { generateKitchenCabinetGeometry as oracleKitchen } from "./reference-fusion/modules/kitchenCabinet/generator.ts";
import { generateLoungeGeometry as oracleLounge } from "./reference-fusion/modules/loungeGenerator/generator.ts";
import { FUSION_SOURCE_SHA } from "./reference-fusion/sha.ts";
import { defaultKitchenParams, defaultLoungeParams, defaultTallParams } from "./defaults.ts";

const TOL_MM = 0.01;

function mm(n: unknown): number {
  return Math.round((Number(n) || 0) / TOL_MM) * TOL_MM;
}

type Placeable = {
  id?: string;
  placement?: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };
  x0?: number;
  x1?: number;
  y0?: number;
  y1?: number;
  z0?: number;
  z1?: number;
};

function fingerprint(items: Placeable[]) {
  return items
    .map((b) => {
      const p = b.placement ?? b;
      return { id: String(b.id), x0: mm(p.x0), x1: mm(p.x1), y0: mm(p.y0), y1: mm(p.y1), z0: mm(p.z0), z1: mm(p.z1) };
    })
    .sort((a, c) => a.id.localeCompare(c.id));
}

function kitchenFp(result: {
  boards: Placeable[];
  frontPanels?: Placeable[];
  vPanels?: Array<{ id: string; x0: number; x1: number; yzProfile?: unknown }>;
}) {
  return {
    boards: fingerprint(result.boards),
    fronts: fingerprint(result.frontPanels ?? []),
    vPanels: (result.vPanels ?? [])
      .map((v) => ({ id: v.id, x0: mm(v.x0), x1: mm(v.x1), yzProfile: v.yzProfile }))
      .sort((a, c) => a.id.localeCompare(c.id)),
  };
}

const kitchenBase = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "generator-parity/kitchen_base.json"), "utf8"),
) as Record<string, unknown>;

function testPinsFusionSha(): void {
  assert.equal(FUSION_SOURCE_SHA, "89bedb204c5aabe839409a62d56609f2ef86ce20");
}

function testGeneralTallOracle(): void {
  const a = nativeGt(defaultTallParams as never);
  const b = oracleGt(defaultTallParams as never);
  // Cab Lab corrects the pinned Fusion V-board Y origin: all structural
  // connections use 0..midDepth, while the pinned source adds FPT only to
  // V1..V4 and disconnects V3/V4 from H13/H24 by exactly FPT.
  const vIds = new Set(["V1", "V2", "V3", "V4"]);
  assert.deepEqual(
    fingerprint(a.boards.filter((board) => !vIds.has(String(board.id)))),
    fingerprint(b.boards.filter((board) => !vIds.has(String(board.id)))),
  );
  const nativeV = fingerprint(a.boards.filter((board) => vIds.has(String(board.id))));
  const oracleV = fingerprint(b.boards.filter((board) => vIds.has(String(board.id))));
  assert.deepEqual(
    nativeV.map(({ y0: _y0, y1: _y1, ...board }) => board),
    oracleV.map(({ y0: _y0, y1: _y1, ...board }) => board),
  );
  const midDepth = Number(defaultTallParams.cabinetDepth) - Number(defaultTallParams.frontFaceAllowance);
  for (const board of nativeV) {
    const rear = board.id === "V3" || board.id === "V4";
    assert.deepEqual(
      [board.y0, board.y1],
      rear ? [midDepth - 150, midDepth] : [0, midDepth],
      `${board.id} must use the structural connection Y range`,
    );
  }
  assert.deepEqual(a.validation.errors, b.validation.errors);
}

function testKitchenDefaultOracle(): void {
  assert.deepEqual(kitchenFp(nativeKitchen(defaultKitchenParams as never)), kitchenFp(oracleKitchen(defaultKitchenParams as never)));
}

function testKitchenBaseOracle(): void {
  assert.deepEqual(kitchenFp(nativeKitchen(kitchenBase as never)), kitchenFp(oracleKitchen(kitchenBase as never)));
}

function testLoungeStylesOracle(): void {
  for (const style of ["I_SHAPE", "L_SHAPE", "PARALLEL"] as const) {
    const params = { ...defaultLoungeParams, style };
    const a = nativeLounge(params);
    const b = oracleLounge(params);
    assert.deepEqual(fingerprint(a.panels), fingerprint(b.panels), style);
    assert.deepEqual(fingerprint(a.lids ?? []), fingerprint(b.lids ?? []), `${style} lids`);
  }
}

const tests = [
  testPinsFusionSha,
  testGeneralTallOracle,
  testKitchenDefaultOracle,
  testKitchenBaseOracle,
  testLoungeStylesOracle,
];

let failed = 0;
for (const test of tests) {
  try {
    test();
    console.log(`PASS ${test.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${test.name}`);
    console.error(error);
  }
}
if (failed > 0) {
  console.error(`${failed}/${tests.length} failed`);
  process.exitCode = 1;
} else {
  console.log(`OK ${tests.length}/${tests.length} oracle parity`);
}
