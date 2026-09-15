/**
 * Panel options must generate: changing a control cannot empty the cabinet.
 * Geometry formulas stay in the generators; this only checks Cab Lab defaults.
 */
import assert from "node:assert/strict";
import { generateGeneralTallCabinet } from "../generalTall/generator.ts";
import { generateKitchenCabinetGeometry } from "../kitchen/generator.ts";
import { generateLoungeGeometry } from "../lounge/generator.ts";
import { displayGeneralTall, displayKitchen, displayLounge, withKitchenVPanelPrefs } from "../../renderer/displayBoards.js";
import { withTallFridgeDefaults, loungeWithStyle } from "../../renderer/panelDefaults.js";

const STOCK = { carcass: 15, door: 16, partition: 18 };

function errorsOf(result: { validation?: { errors?: string[] }; errors?: string[] }) {
  return result?.validation?.errors ?? result?.errors ?? [];
}

function tallBase() {
  return {
    cabinetWidth: 600,
    cabinetDepth: 584,
    cabinetHeight: 2000,
    panelThickness: STOCK.carcass,
    frontFaceAllowance: STOCK.door,
    doorPanelThickness: STOCK.door,
    sideClearance: 3,
    topSystem: { style: "style_1" as const, frontRailHeight: 40 },
    bottomSystem: { style: "style_1" as const, frontRailHeight: 53 },
    avoidance: { enabled: false, depth: 200, height: 400 },
    zones: [
      { id: "zone-1", type: "side_door" as const, height: 600 },
      { id: "zone-2", type: "drawer" as const, height: 300 },
      { id: "zone-3", type: "double_door" as const, height: 945, verticalDivider: true },
    ],
  };
}

function kitchenBase() {
  return withKitchenVPanelPrefs({
    globalSettings: {
      length: 800,
      depth: 560,
      height: 720,
      materialThickness: STOCK.carcass,
      frontThickness: STOCK.door,
      bottomClearanceHeight: 100,
      bottomClearanceStyle: "style_1",
    },
    columns: [{
      id: "col-1",
      width: 800,
      columnType: "left_door",
      zones: [{ id: "zone-1", height: 605, zoneType: "left_door" }],
    }],
    wheelAvoidances: [],
    vPanelMachiningPreferences: [],
  });
}

function loungeBase() {
  return {
    style: "I_SHAPE" as const,
    height: 420,
    partitionPanelThickness: STOCK.partition,
    wheelAvoidanceEnabled: false,
    mainWidth: 2000,
    mainDepth: 600,
    lWidth: 1600,
    lDepth: 800,
    lPosition: "RIGHT" as const,
    topLidEnabled: true,
    lFrontAccess: "NONE" as const,
    totalWidth: 4000,
    singleLoungeWidth: 1500,
    depth: 800,
    avoidanceDepth: 300,
    avoidanceHeight: 250,
    hasMiddleCabinet: false,
  };
}

function assertOk(label: string, result: { boards?: unknown[]; validation?: { errors?: string[] }; errors?: string[] }) {
  assert.equal(errorsOf(result).length, 0, `${label}: ${errorsOf(result).join("; ")}`);
  const boards = result.boards || [];
  assert.ok(boards.length > 0, `${label}: no boards`);
}

function testTallStyle2AndAvoidance(): void {
  const r2 = displayGeneralTall(generateGeneralTallCabinet({
    ...tallBase(),
    topSystem: { style: "style_2", height: 60 },
    bottomSystem: { style: "style_2", height: 60 },
    zones: [
      { id: "zone-1", type: "side_door", height: 640 },
      { id: "zone-2", type: "drawer", height: 300 },
      { id: "zone-3", type: "double_door", height: 940, verticalDivider: true },
    ],
  } as never));
  assertOk("tall style 2", r2);

  const av = displayGeneralTall(generateGeneralTallCabinet({
    ...tallBase(),
    avoidance: { enabled: true, depth: 200, height: 400 },
  } as never));
  assertOk("tall avoidance", av);
}

function testTallZoneTypes(): void {
  const types = [
    "side_door", "left_side_door", "right_side_door", "double_door",
    "drawer", "open_space", "open_appliance", "top_flap", "bottom_flap", "blank_panel",
  ] as const;
  for (const type of types) {
    const zones = [
      { id: "zone-1", type: "drawer" as const, height: 300 },
      { id: "zone-2", type, height: 600, verticalDivider: type === "double_door" },
      { id: "zone-3", type: "drawer" as const, height: 945 },
    ];
    const r = displayGeneralTall(generateGeneralTallCabinet({ ...tallBase(), zones } as never));
    assertOk(`tall zone ${type}`, r);
  }
}

function testTallFridgeFromPanel(): void {
  const r = displayGeneralTall(generateGeneralTallCabinet({
    cabinetWidth: 611,
    cabinetDepth: 616,
    cabinetHeight: 2100,
    panelThickness: STOCK.carcass,
    frontFaceAllowance: STOCK.door,
    sideClearance: 3,
    topSystem: { style: "style_1", frontRailHeight: 40 },
    bottomSystem: { style: "style_1", frontRailHeight: 53 },
    avoidance: { enabled: false, depth: 300, height: 200 },
    zones: [
      { id: "zone-1", type: "drawer", height: 200 },
      {
        id: "zone-2",
        type: "fridge",
        height: 1470,
        applianceWidthMm: 550,
        applianceDepthMm: 580,
        applianceHeightMm: 1470,
      },
      { id: "zone-3", type: "top_flap", height: 180 },
    ],
  } as never));
  assertOk("tall fridge", r);
}

function testKitchenZoneTypes(): void {
  const types = ["left_door", "right_door", "double_door", "drawer", "open", "down_flap", "stove", "custom"];
  for (const zoneType of types) {
    const r = displayKitchen(generateKitchenCabinetGeometry({
      ...kitchenBase(),
      columns: [{
        id: "col-1",
        width: 800,
        columnType: zoneType,
        zones: [{ id: "zone-1", height: 605, zoneType }],
      }],
    } as never));
    assertOk(`kitchen ${zoneType}`, r);
  }
}

function testKitchenTwoColumn(): void {
  const r = displayKitchen(generateKitchenCabinetGeometry(withKitchenVPanelPrefs({
    ...kitchenBase(),
    globalSettings: { ...kitchenBase().globalSettings, length: 1600 },
    columns: [
      { id: "col-1", width: 800, columnType: "left_door", zones: [{ id: "z1", height: 605, zoneType: "left_door" }] },
      { id: "col-2", width: 800, columnType: "drawer", zones: [{ id: "z2", height: 605, zoneType: "drawer" }] },
    ],
  }) as never));
  assertOk("kitchen 2-col", r);
}

function testTallFridgeTypeSwitch(): void {
  const filled = withTallFridgeDefaults({
    ...tallBase(),
    zones: [
      { id: "zone-1", type: "side_door", height: 600 },
      { id: "zone-2", type: "drawer", height: 300 },
      { id: "zone-3", type: "fridge", height: 945 },
    ],
  });
  const r = displayGeneralTall(generateGeneralTallCabinet(filled as never));
  assertOk("tall fridge type switch", r);
}

function testLoungeStyleKeepsBox(): void {
  const fromI = loungeWithStyle(loungeBase(), "PARALLEL");
  assert.equal(fromI.totalWidth, 2000);
  assert.ok(fromI.singleLoungeWidth * 2 + 100 <= fromI.totalWidth);
  const r = displayLounge(generateLoungeGeometry(fromI));
  assertOk("lounge I→PARALLEL keeps W=2000", r);
  const fromU = loungeWithStyle(loungeBase(), "U_SHAPE");
  assert.equal(fromU.style, "U_SHAPE");
  const u = displayLounge(generateLoungeGeometry(fromU));
  assertOk("lounge I→U", u);
  assert.ok((u.boards || []).length > (r.boards || []).length, "U has more boards than Parallel");
}

function testLoungeStyles(): void {
  const base = loungeBase();
  for (const style of ["I_SHAPE", "L_SHAPE", "PARALLEL", "U_SHAPE"] as const) {
    const r = displayLounge(generateLoungeGeometry({ ...base, style }));
    assertOk(`lounge ${style}`, r);
  }
  const wheel = displayLounge(generateLoungeGeometry({ ...base, style: "I_SHAPE", wheelAvoidanceEnabled: true }));
  assertOk("lounge wheel avoidance", wheel);
}

const tests = [
  testTallStyle2AndAvoidance,
  testTallZoneTypes,
  testTallFridgeFromPanel,
  testTallFridgeTypeSwitch,
  testKitchenZoneTypes,
  testKitchenTwoColumn,
  testLoungeStyles,
  testLoungeStyleKeepsBox,
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
  console.log(`OK ${tests.length}/${tests.length} panel-options`);
}
