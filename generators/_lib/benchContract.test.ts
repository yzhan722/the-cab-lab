/**
 * Migrated generators must feed bench explode + formula display.
 */
import assert from "node:assert/strict";
import { relations, isStrong } from "../../renderer/bench/explode.js";
import { generateKitchenCabinet } from "../kitchen/generator.ts";
import { generateGeneralTall } from "../generalTall/generator.ts";
import { generateLounge } from "../lounge/generator.ts";

function assertBench(name: string, result: { boards: Array<{ id: string }>; joints: Array<{ id?: string; a?: { board?: string }; b?: { board?: string } }>; debug?: { provenance?: { entries?: Record<string, unknown> } } }) {
  const n = Object.keys(result.debug?.provenance?.entries ?? {}).length;
  assert.ok(n > 0, `${name}: provenance entries`);
  for (const j of result.joints) {
    assert.equal(typeof j.a?.board, "string", `${name} ${j.id} a.board`);
    assert.equal(typeof j.b?.board, "string", `${name} ${j.id} b.board`);
  }
  const rels = relations(result);
  assert.ok(rels.size > 0, `${name}: explode relations`);
  assert.ok([...rels.values()].some(isStrong), `${name}: at least one declared/feature relation`);
}

assertBench("kitchen", generateKitchenCabinet({
  globalSettings: { length: 887, depth: 270, height: 880 },
  materialThickness: 15, frontThickness: 16, frontClearance: 2.5,
  bottomClearanceHeight: 55, bottomClearanceStyle: "style_1", lockEnabled: true,
  columns: [
    { id: "k-col-1", width: 444, zones: [{ id: "c1-door", height: 825, zoneType: "left_door", shelfEnabled: true, shelfHeight: 400, leftSidePanelOptions: { panelType: "door", frontVisible: true, bchNotchEnabled: false, strengtheningStripEnabled: true } }] },
    { id: "k-col-2", width: 443, zones: [{ id: "c2-drawer", height: 300, zoneType: "drawer" }, { id: "c2-door", height: 525, zoneType: "right_door", shelfEnabled: false }] },
  ],
}));

assertBench("generalTall", generateGeneralTall({
  cabinetHeight: 2000, cabinetWidth: 600, cabinetDepth: 584,
  panelThickness: 16, frontPanelThickness: 16, ziThickness: 15, hThickness: 15,
  sideClearance: 3, dividerThickness: 15,
  topSystem: { style: "style_1", frontRailHeight: 40 },
  bottomSystem: { style: "style_1", frontRailHeight: 53 },
  zones: [
    { id: "zone-1", type: "side_door", height: 600 },
    { id: "zone-2", type: "drawer", height: 300 },
    { id: "zone-3", type: "double_door", height: 945, verticalDivider: true },
  ],
}));

assertBench("lounge", generateLounge({
  style: "L_SHAPE", height: 420, partitionPanelThickness: 18,
  mainWidth: 2000, mainDepth: 600, lWidth: 1600, lDepth: 800, lPosition: "RIGHT", topLidEnabled: true,
}));

console.log("bench contract: kitchen / tall / lounge explode + provenance OK");
