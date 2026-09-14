/** First-pass defaults copied from Fusion UI / source tests (mm). Fusion pin 89bedb2. */

export const defaultTallParams = {
  cabinetHeight: 2000,
  cabinetWidth: 600,
  cabinetDepth: 584,
  panelThickness: 16,
  frontFaceAllowance: 16,
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

export const defaultKitchenParams = {
  globalSettings: {
    length: 800,
    depth: 560,
    height: 720,
    materialThickness: 16,
    frontThickness: 16,
    bottomClearanceHeight: 100,
    bottomClearanceStyle: "style_1",
  },
  columns: [
    {
      id: "col-1",
      width: 800,
      columnType: "left_door",
      zones: [{ id: "zone-1", height: 604, zoneType: "left_door" }],
    },
  ],
  wheelAvoidances: [],
  vPanelMachiningPreferences: [],
};

export const defaultLoungeParams = {
  style: "I_SHAPE",
  height: 420,
  partitionPanelThickness: 18,
  wheelAvoidanceEnabled: false,
  mainWidth: 2000,
  mainDepth: 600,
  lWidth: 1600,
  lDepth: 800,
  lPosition: "RIGHT",
  topLidEnabled: true,
  lFrontAccess: "NONE",
  totalWidth: 4000,
  singleLoungeWidth: 1500,
  depth: 800,
  avoidanceDepth: 300,
  avoidanceHeight: 250,
  hasMiddleCabinet: false,
};
