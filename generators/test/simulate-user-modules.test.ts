/**
 * Simulate placing every module the way the renderer does: job stock,
 * defaults(W,D,H), generate, wrap for 3D, then resize / divider / style
 * changes a user would make in the panel and with the blue handles.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateSmallCabinet } from "../smallCabinet/generator.ts";
import { generateOverheadCabinet } from "../overheadCabinet/generator.ts";
import { generateBedroom } from "../bedroom/generator.ts";
import { generateBedBox } from "../bedBox/generator.ts";
import { generateGeneralTallCabinet } from "../generalTall/generator.ts";
import { generateKitchenCabinetGeometry } from "../kitchen/generator.ts";
import { generateLoungeGeometry } from "../lounge/generator.ts";
import { generateUShapeOverhead } from "../uShapeOverhead/generator.ts";
import { generateBedSideTable } from "../bedSideTable/generator.ts";
import { displayGeneralTall, displayKitchen, displayLounge, withKitchenVPanelPrefs } from "../../renderer/displayBoards.js";

const STOCK = { carcass: 15, partition: 18, door: 16 };
const SPACE = { W: 4000, D: 3000, H: 2400 };
const MIN_ZONE = 60;
const round1 = (v: number) => Math.round(v * 10) / 10;

function fitZones(zones: Array<{ height: number }>, interior: number) {
  if (!zones.length) return [];
  const sum = zones.reduce((s, z) => s + z.height, 0) || 1;
  const out = zones.map((z) => ({ ...z, height: Math.max(MIN_ZONE, Math.round((z.height / sum) * interior)) }));
  const partial = out.slice(0, -1).reduce((s, z) => s + z.height, 0);
  out[out.length - 1].height = round1(interior - partial);
  return out;
}

function fitWidths(items: Array<{ width: number }>, total: number) {
  if (!items.length) return [];
  const sum = items.reduce((s, z) => s + z.width, 0) || 1;
  const out = items.map((z) => ({ ...z, width: Math.max(150, Math.round((z.width / sum) * total)) }));
  const partial = out.slice(0, -1).reduce((s, z) => s + z.width, 0);
  out[out.length - 1].width = round1(total - partial);
  return out;
}

type Board = {
  id: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
};

function checkBoards(label: string, boards: Board[], env: { W: number; D: number; H: number }, opts: { allowEmpty?: boolean } = {}) {
  if (!opts.allowEmpty) assert.ok(boards.length > 0, `${label}: no boards`);
  const ids = new Set<string>();
  for (const b of boards) {
    assert.ok(b.id, `${label}: board missing id`);
    assert.equal(ids.has(b.id), false, `${label}: duplicate id ${b.id}`);
    ids.add(b.id);
    for (const k of ["x0", "x1", "y0", "y1", "z0", "z1"] as const) {
      assert.ok(Number.isFinite(b[k]), `${label} ${b.id}.${k} not finite`);
    }
    assert.ok(b.x1 + 1e-6 >= b.x0, `${label} ${b.id} x inverted`);
    assert.ok(b.y1 + 1e-6 >= b.y0, `${label} ${b.id} y inverted`);
    assert.ok(b.z1 + 1e-6 >= b.z0, `${label} ${b.id} z inverted`);
    const pad = 80;
    assert.ok(b.x0 >= -pad && b.x1 <= env.W + pad, `${label} ${b.id} X ${b.x0}..${b.x1} vs W ${env.W}`);
    assert.ok(b.y0 >= -pad && b.y1 <= env.D + pad, `${label} ${b.id} Y ${b.y0}..${b.y1} vs D ${env.D}`);
    assert.ok(b.z0 >= -pad && b.z1 <= env.H + pad, `${label} ${b.id} Z ${b.z0}..${b.z1} vs H ${env.H}`);
  }
}

function errorsOf(result: { validation?: { errors?: string[] }; errors?: string[] }) {
  return result?.validation?.errors ?? result?.errors ?? [];
}

function placeSmall(W: number, D: number, H: number) {
  const cpt = STOCK.carcass;
  return generateSmallCabinet({
    cabinetWidth: W,
    cabinetDepth: D,
    cabinetHeight: H,
    panelThickness: cpt,
    frontPanelThickness: STOCK.door,
    frontClearance: 2.5,
    zones: [{ id: "zone-1", type: "left_door", height: round1(H - 2 * cpt) }],
  });
}

function placeOhc(W: number, D: number, H: number) {
  return generateOverheadCabinet({
    style: "style_1",
    cabinetWidth: W,
    cabinetDepth: D,
    cabinetHeight: H,
    topClearanceHeight: 40,
    featureWidth: STOCK.carcass,
    frontPanelThickness: STOCK.door,
    clearance: 2.5,
    zones: [{ id: "zone-1", type: "up_flap", width: W }],
  });
}

function placeTall(W: number, D: number, H: number) {
  const zones = [
    { id: "zone-1", type: "side_door" as const, height: 600 },
    { id: "zone-2", type: "drawer" as const, height: 300 },
    { id: "zone-3", type: "double_door" as const, height: 945, verticalDivider: true },
  ];
  const rawH = 2000;
  const params = {
    cabinetWidth: W,
    cabinetDepth: D,
    cabinetHeight: H,
    panelThickness: STOCK.carcass,
    frontFaceAllowance: STOCK.door,
    doorPanelThickness: STOCK.door,
    frontClearance: 2.5,
    sideClearance: 3,
    topSystem: { style: "style_1" as const, frontRailHeight: 40 },
    bottomSystem: { style: "style_1" as const, frontRailHeight: 53 },
    avoidance: { enabled: false, depth: 200, height: 400 },
    zones: H === rawH ? zones : fitZones(zones, round1(zones.reduce((s, z) => s + z.height, 0) + (H - rawH))),
  };
  return displayGeneralTall(generateGeneralTallCabinet(params as never));
}

function placeKitchen(W: number, D: number, H: number) {
  const cpt = STOCK.carcass;
  const kick = 100;
  const interior = Math.max(MIN_ZONE, round1(H - kick - cpt));
  return displayKitchen(generateKitchenCabinetGeometry({
    globalSettings: {
      length: W,
      depth: D,
      height: H,
      materialThickness: cpt,
      frontThickness: STOCK.door,
      bottomClearanceHeight: kick,
      bottomClearanceStyle: "style_1",
    },
    columns: [{ id: "col-1", width: W, columnType: "left_door", zones: [{ id: "zone-1", height: interior, zoneType: "left_door" }] }],
    wheelAvoidances: [],
    vPanelMachiningPreferences: [],
  } as never));
}

function placeLounge(style: "I_SHAPE" | "L_SHAPE" | "PARALLEL" | "U_SHAPE", W: number, D: number, H: number) {
  return displayLounge(generateLoungeGeometry({
    style,
    height: H,
    partitionPanelThickness: STOCK.partition,
    wheelAvoidanceEnabled: false,
    mainWidth: W,
    mainDepth: style === "U_SHAPE" ? Math.min(D, 350) : D,
    lWidth: 1600,
    lDepth: Math.max(D, 800),
    lPosition: "RIGHT",
    topLidEnabled: true,
    lFrontAccess: "NONE",
    totalWidth: style === "U_SHAPE" ? W : Math.max(W, 4000),
    singleLoungeWidth: 1500,
    depth: style === "U_SHAPE" ? D : Math.max(D, 800),
    avoidanceDepth: 300,
    avoidanceHeight: 250,
    hasMiddleCabinet: false,
  }));
}

function testSmallDefaultAndResize(): void {
  const r = placeSmall(600, 560, 720);
  assert.equal(errorsOf(r).length, 0, errorsOf(r).join("; "));
  checkBoards("small default", r.boards, { W: 600, D: 560, H: 720 });
  const resized = generateSmallCabinet({
    ...r.params,
    cabinetWidth: 900,
    cabinetHeight: 900,
    zones: fitZones(
      r.zones.map((z) => ({ id: z.id, type: z.type, height: z.height })),
      round1(900 - 2 * STOCK.carcass),
    ),
  } as never);
  assert.equal(errorsOf(resized).length, 0, errorsOf(resized).join("; "));
  checkBoards("small resized", resized.boards, { W: 900, D: 560, H: 900 });
}

function testSmallTwoZones(): void {
  const r = generateSmallCabinet({
    cabinetWidth: 600,
    cabinetDepth: 560,
    cabinetHeight: 800,
    panelThickness: STOCK.carcass,
    frontPanelThickness: STOCK.door,
    zones: [
      { id: "upper", type: "left_door", height: 400 },
      { id: "lower", type: "drawer", height: 370 },
    ],
  });
  assert.equal(errorsOf(r).length, 0, errorsOf(r).join("; "));
  checkBoards("small 2-zone", r.boards, { W: 600, D: 560, H: 800 });
}

function testOhcDefaultAndThreeZones(): void {
  const r = placeOhc(1200, 350, 400);
  assert.equal(errorsOf(r).length, 0, errorsOf(r).join("; "));
  checkBoards("ohc default", r.boards, { W: 1200, D: 350, H: 400 });
  const three = generateOverheadCabinet({
    style: "style_1",
    cabinetWidth: 2000,
    cabinetDepth: 400,
    cabinetHeight: 400,
    topClearanceHeight: 40,
    featureWidth: STOCK.carcass,
    frontPanelThickness: STOCK.door,
    clearance: 2.5,
    zones: [
      { id: "zone-1", type: "up_flap", width: 650 },
      { id: "zone-2", type: "fixed_panel", width: 750 },
      { id: "zone-3", type: "up_flap", width: 600 },
    ],
  });
  assert.equal(errorsOf(three).length, 0, errorsOf(three).join("; "));
  checkBoards("ohc 3-zone", three.boards, { W: 2000, D: 400, H: 400 });

  const led = generateOverheadCabinet({
    style: "style_1",
    cabinetWidth: 1200,
    cabinetDepth: 350,
    cabinetHeight: 400,
    topClearanceHeight: 40,
    featureWidth: STOCK.carcass,
    frontPanelThickness: STOCK.door,
    clearance: 2.5,
    ledGroove: true,
    zones: [{ id: "zone-1", type: "up_flap", width: 1200 }],
  });
  assert.equal(errorsOf(led).length, 0, errorsOf(led).join("; "));
  checkBoards("ohc LED", led.boards, { W: 1200, D: 350, H: 400 });

  const rangehood = generateOverheadCabinet({
    cabinetWidth: 1000,
    cabinetDepth: 400,
    cabinetHeight: 400,
    featureWidth: STOCK.carcass,
    frontPanelThickness: STOCK.door,
    topClearanceHeight: 40,
    rangehoodPreset: "NCE",
    rangehoodClearHeight: 75,
    rangehoodAlignment: "left",
    rangehoodEdgeOffsetX: 40,
    zones: [{ id: "rangehood", type: "rangehood_flap", width: 1000 }],
  });
  assert.equal(errorsOf(rangehood).length, 0, errorsOf(rangehood).join("; "));
  checkBoards("ohc rangehood", rangehood.boards, { W: 1000, D: 400, H: 400 });
}

function testBedroomAndBedBox(): void {
  const bed = generateBedroom({
    width: 2100,
    depth: 700,
    height: 1965,
    roofProfile: [[0, 1965], [700, 1800]],
    panelThickness: STOCK.carcass,
    frontPanelThickness: 0,
  });
  assert.equal(errorsOf(bed).length, 0, errorsOf(bed).join("; "));
  assert.equal(bed.boards.length, 0, "bedroom v0 is volume-only");
  const box = generateBedBox({ width: 1400, depth: 1900, height: 420, panelThickness: STOCK.carcass, frontPanelThickness: 0 });
  assert.equal(errorsOf(box).length, 0, errorsOf(box).join("; "));
  assert.equal(box.boards.length, 0, "bed box v0 is volume-only");
  const table = generateBedSideTable({ width: 400, depth: 400, height: 420, side: "right" });
  assert.equal(errorsOf(table).length, 0, errorsOf(table).join("; "));
  assert.equal(table.boards.length, 0, "bed side table v0 is volume-only");
}

function testTallDefaultResizeDividerFridge(): void {
  const r = placeTall(600, 584, 2000);
  assert.equal(errorsOf(r).length, 0, errorsOf(r).join("; "));
  checkBoards("tall default", r.boards, { W: 600, D: 584, H: 2000 });
  assert.ok((r.frontPanels || []).length > 0, "tall has fronts");

  const drawn = placeTall(700, 600, 1800);
  assert.equal(errorsOf(drawn).length, 0, `tall drawn H=1800: ${errorsOf(drawn).join("; ")}`);
  checkBoards("tall drawn", drawn.boards, { W: 700, D: 600, H: 1800 });

  const items = (r.stacking?.items || []).filter((i: { type: string }) => i.type === "functional_zone");
  assert.ok(items.length >= 2, "tall stacking zones");
  const mid = (items[0].z1 + items[1].z0) / 2;
  const params = {
    cabinetWidth: 600,
    cabinetDepth: 584,
    cabinetHeight: 2000,
    panelThickness: STOCK.carcass,
    frontFaceAllowance: STOCK.door,
    doorPanelThickness: STOCK.door,
    sideClearance: 3,
    topSystem: { style: "style_1", frontRailHeight: 40 },
    bottomSystem: { style: "style_1", frontRailHeight: 53 },
    avoidance: { enabled: false, depth: 200, height: 400 },
    zones: [
      { id: "zone-1", type: "side_door", height: 600 },
      { id: "zone-2", type: "drawer", height: 300 },
      { id: "zone-3", type: "double_door", height: 945, verticalDivider: true },
    ],
  };
  const delta = Math.round(mid) - items[0].z1;
  const nextZones = params.zones.map((z) => ({ ...z }));
  nextZones[0].height = round1(nextZones[0].height + delta);
  nextZones[1].height = round1(nextZones[1].height - delta);
  const afterDiv = displayGeneralTall(generateGeneralTallCabinet({ ...params, zones: nextZones } as never));
  assert.equal(errorsOf(afterDiv).length, 0, errorsOf(afterDiv).join("; "));
  checkBoards("tall after divider", afterDiv.boards, { W: 600, D: 584, H: 2000 });

  const avoided = displayGeneralTall(generateGeneralTallCabinet({
    cabinetWidth: 600,
    cabinetDepth: 584,
    cabinetHeight: 2000,
    panelThickness: STOCK.carcass,
    frontFaceAllowance: STOCK.door,
    doorPanelThickness: STOCK.door,
    sideClearance: 3,
    topSystem: { style: "style_1", frontRailHeight: 40 },
    bottomSystem: { style: "style_1", frontRailHeight: 53 },
    avoidance: { enabled: true, depth: 200, height: 400 },
    zones: [
      { id: "zone-1", type: "side_door", height: 600 },
      { id: "zone-2", type: "drawer", height: 300 },
      { id: "zone-3", type: "double_door", height: 945, verticalDivider: true },
    ],
  } as never));
  assert.equal(errorsOf(avoided).length, 0, `tall avoidance: ${errorsOf(avoided).join("; ")}`);
  checkBoards("tall avoidance", avoided.boards, { W: 600, D: 584, H: 2000 });

  const fridge = displayGeneralTall(generateGeneralTallCabinet({
    cabinetHeight: 2100,
    cabinetWidth: 611,
    cabinetDepth: 616,
    panelThickness: STOCK.carcass,
    frontFaceAllowance: STOCK.door,
    sideClearance: 3,
    topSystem: { style: "style_1", frontRailHeight: 40 },
    bottomSystem: { style: "style_1", frontRailHeight: 53 },
    zones: [
      { id: "bottom-drawer", type: "drawer", height: 200 },
      {
        id: "fridge-cavity",
        type: "fridge",
        height: 999,
        applianceWidthMm: 550,
        applianceDepthMm: 580,
        applianceHeightMm: 1470,
      },
      { id: "top-flap", type: "top_flap", height: 180 },
    ],
  } as never));
  assert.equal(errorsOf(fridge).length, 0, `fridge: ${errorsOf(fridge).join("; ")}`);
  checkBoards("tall fridge", fridge.boards, { W: 611, D: 616, H: 2100 });
}

function testKitchenDefaultUserSizeTwoColumnResize(): void {
  const r = placeKitchen(800, 560, 720);
  assert.equal(errorsOf(r).length, 0, errorsOf(r).join("; "));
  checkBoards("kitchen default", r.boards, { W: 800, D: 560, H: 720 });

  const user = placeKitchen(1420, 1074, 1250);
  assert.equal(errorsOf(user).length, 0, `kitchen user size: ${errorsOf(user).join("; ")}`);
  checkBoards("kitchen user", user.boards, { W: 1420, D: 1074, H: 1250 });

  const fixture = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "generator-parity/kitchen_base.json"), "utf8"));
  const rawTwo = displayKitchen(generateKitchenCabinetGeometry(fixture as never));
  assert.ok(
    errorsOf(rawTwo).some((e) => e.includes("Unresolved double-sided half-slot")),
    "Fusion kitchen_base has no V-panel machining prefs; generator must error",
  );
  const two = displayKitchen(generateKitchenCabinetGeometry(withKitchenVPanelPrefs(fixture) as never));
  assert.equal(errorsOf(two).length, 0, errorsOf(two).join("; "));
  const g = fixture.globalSettings;
  checkBoards("kitchen_base", two.boards, { W: g.length, D: g.depth, H: g.height });

  const wider = placeKitchen(1600, 560, 720);
  const cols = fitWidths([{ width: 800 }, { width: 800 }], 1600);
  const splitParams = withKitchenVPanelPrefs({
    globalSettings: {
      length: 1600,
      depth: 560,
      height: 720,
      materialThickness: STOCK.carcass,
      frontThickness: STOCK.door,
      bottomClearanceHeight: 100,
      bottomClearanceStyle: "style_1",
    },
    columns: [
      { id: "col-1", width: cols[0].width, columnType: "left_door", zones: [{ id: "z1", height: 605, zoneType: "left_door" }] },
      { id: "col-2", width: cols[1].width, columnType: "drawer", zones: [{ id: "z2", height: 605, zoneType: "drawer" }] },
    ],
    wheelAvoidances: [],
    vPanelMachiningPreferences: [],
  });
  const split = displayKitchen(generateKitchenCabinetGeometry(splitParams as never));
  assert.equal(errorsOf(split).length, 0, errorsOf(split).join("; "));
  checkBoards("kitchen 2-col", split.boards, { W: 1600, D: 560, H: 720 });
  assert.ok(wider.boards.length > 0);

  const tripleW = fitWidths([{ width: 500 }, { width: 500 }, { width: 500 }], 1500);
  const triple = displayKitchen(generateKitchenCabinetGeometry(withKitchenVPanelPrefs({
    globalSettings: {
      length: 1500,
      depth: 560,
      height: 720,
      materialThickness: STOCK.carcass,
      frontThickness: STOCK.door,
      bottomClearanceHeight: 100,
      bottomClearanceStyle: "style_1",
    },
    columns: [
      { id: "col-1", width: tripleW[0].width, columnType: "left_door", zones: [{ id: "z1", height: 605, zoneType: "left_door" }] },
      { id: "col-2", width: tripleW[1].width, columnType: "drawer", zones: [{ id: "z2", height: 605, zoneType: "drawer" }] },
      { id: "col-3", width: tripleW[2].width, columnType: "right_door", zones: [{ id: "z3", height: 605, zoneType: "right_door" }] },
    ],
    wheelAvoidances: [],
    vPanelMachiningPreferences: [],
  }) as never));
  assert.equal(errorsOf(triple).length, 0, errorsOf(triple).join("; "));
  checkBoards("kitchen 3-col", triple.boards, { W: 1500, D: 560, H: 720 });
}

function testLoungeStylesAndUserSize(): void {
  const i = placeLounge("I_SHAPE", 2000, 600, 420);
  assert.equal(errorsOf(i).length, 0, errorsOf(i).join("; "));
  checkBoards("lounge I", i.boards, { W: 2000, D: 600, H: 420 });

  const l = placeLounge("L_SHAPE", 2000, 800, 420);
  assert.equal(errorsOf(l).length, 0, errorsOf(l).join("; "));
  checkBoards("lounge L", l.boards, { W: 2000, D: Math.max(600, 800), H: 420 });

  const p = placeLounge("PARALLEL", 4000, 800, 420);
  assert.equal(errorsOf(p).length, 0, errorsOf(p).join("; "));
  checkBoards("lounge PARALLEL", p.boards, { W: 4000, D: 800, H: 420 });

  const u = placeLounge("U_SHAPE", 2000, 1200, 420);
  assert.equal(errorsOf(u).length, 0, errorsOf(u).join("; "));
  assert.ok(u.boards.length > l.boards.length, "U_SHAPE is three I runs, not L");

  const user = placeLounge("I_SHAPE", 1090, 784, 1500);
  assert.equal(errorsOf(user).length, 0, errorsOf(user).join("; "));
  checkBoards("lounge user I", user.boards, { W: 1090, D: 784, H: 1500 });
}

function testJobOfSeveralCabinetsFitsTheBox(): void {
  const placed = [
    { id: "small", env: { W: 600, D: 560, H: 720 }, pose: { x: 0, y: 0 } },
    { id: "tall", env: { W: 600, D: 584, H: 2000 }, pose: { x: 700, y: 0 } },
    { id: "kitchen", env: { W: 800, D: 560, H: 720 }, pose: { x: 1400, y: 0 } },
    { id: "lounge", env: { W: 2000, D: 600, H: 420 }, pose: { x: 0, y: 2400 } },
    { id: "ohc", env: { W: 1200, D: 350, H: 400 }, pose: { x: 0, y: SPACE.D - 350 } },
  ];
  for (const p of placed) {
    assert.ok(p.pose.x >= 0 && p.pose.x + p.env.W <= SPACE.W + 1, `${p.id} X outside space`);
    assert.ok(p.pose.y >= 0 && p.pose.y + p.env.D <= SPACE.D + 1, `${p.id} Y outside space`);
    assert.ok(p.env.H <= SPACE.H, `${p.id} taller than space`);
  }
  const results = [
    placeSmall(600, 560, 720),
    placeTall(600, 584, 2000),
    placeKitchen(800, 560, 720),
    placeLounge("I_SHAPE", 2000, 600, 420),
    placeOhc(1200, 350, 400),
  ];
  for (const r of results) assert.equal(errorsOf(r).length, 0, errorsOf(r).join("; "));
}

function testUOverheadCompose(): void {
  const u = generateUShapeOverhead({
    cabinetWidth: 2000,
    outerDepth: 1200,
    cabinetHeight: 400,
    cabinetDepth: 350,
    featureWidth: STOCK.carcass,
    frontPanelThickness: STOCK.door,
    topClearanceHeight: 40,
    clearance: 2.5,
  });
  assert.equal(errorsOf(u).length, 0, errorsOf(u).join("; "));
  checkBoards("u-overhead", u.boards, { W: 2000, D: 1200, H: 400 });
}

function testDeterministic(): void {
  const a = placeKitchen(800, 560, 720);
  const b = placeKitchen(800, 560, 720);
  assert.deepEqual(a.boards.map((x) => x.id), b.boards.map((x) => x.id));
  const ta = placeTall(600, 584, 2000);
  const tb = placeTall(600, 584, 2000);
  assert.deepEqual(ta.boards.map((x) => x.id), tb.boards.map((x) => x.id));
}

const tests = [
  testSmallDefaultAndResize,
  testSmallTwoZones,
  testOhcDefaultAndThreeZones,
  testBedroomAndBedBox,
  testTallDefaultResizeDividerFridge,
  testKitchenDefaultUserSizeTwoColumnResize,
  testLoungeStylesAndUserSize,
  testJobOfSeveralCabinetsFitsTheBox,
  testUOverheadCompose,
  testDeterministic,
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
  console.log(`OK ${tests.length}/${tests.length} user-simulation`);
}
