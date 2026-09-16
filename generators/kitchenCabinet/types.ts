/** Kitchen Base v0 — Small's floor box plus a toe-kick plinth. No Fusion V-panel / wheel arch. */

export type KitchenCabinetZoneType = "left_door" | "right_door" | "drawer";

export type ProfilePoint =
  | { x: number; y: number }
  | { y: number; z: number }
  | { x: number; z: number };

export interface KitchenCabinetZone {
  id?: string;
  type: KitchenCabinetZoneType | string;
  /** Logical zone height (mm). Zones stack top→bottom; sum must equal carcass interior. */
  height: number;
  lockEnabled?: boolean;
  lockSideDistance?: number;
}

export interface KitchenCabinetParams {
  cabinetWidth: number;
  cabinetDepth: number;
  cabinetHeight: number;
  panelThickness?: number;
  frontPanelThickness?: number;
  frontClearance?: number;
  /** Toe-kick height (mm). Carcass sits on top; included in cabinetHeight. */
  plinthHeight?: number;
  /** Recess of the plinth front from the carcass face (mm). */
  plinthSetback?: number;
  locksEnabled?: boolean;
  lockSideDistance?: number;
  carcassColor?: string;
  carcassColorName?: string;
  leftSideDoorColor?: boolean;
  rightSideDoorColor?: boolean;
  zones?: KitchenCabinetZone[];
}

export interface Board {
  id: string;
  name: string;
  category: string;
  boardType: string;
  materialThickness: number;
  profilePlane: "XY" | "XZ" | "YZ";
  thicknessAxis: "X" | "Y" | "Z";
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
  source?: string;
  notes?: string[];
  useDoorColor?: boolean;
  hingeSide?: "left" | "right";
  zoneId?: string;
  profileVector?: ProfilePoint[];
  profileFeatures?: Array<Record<string, unknown>>;
  cutProfileVector?: Array<{ y: number; z: number }>;
  lockCutout?: LockCutout;
  thickness?: number;
}

export interface LockCutout {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  radius: number;
  orientation: "vertical" | "horizontal";
}

export interface KitchenCabinetFeature {
  id: string;
  type: "shelf_tongue" | "back_tongue" | "side_groove" | "door_lock";
  targetBoardId: string;
  relatedBoardId?: string;
  side?: "left" | "right";
  y0?: number;
  y1?: number;
  z0?: number;
  z1?: number;
  x0?: number;
  x1?: number;
  depth?: number;
  insertionDepth?: number;
  source?: string;
}

export interface ResolvedZone {
  id: string;
  type: KitchenCabinetZoneType;
  height: number;
  zTop: number;
  zBottom: number;
  clearZ0: number;
  clearZ1: number;
  lockEnabled: boolean;
  lockSideDistance: number;
}

export interface KitchenCabinetResult {
  params: {
    cabinetWidth: number;
    cabinetDepth: number;
    cabinetHeight: number;
    panelThickness: number;
    frontPanelThickness: number;
    frontClearance: number;
    plinthHeight: number;
    plinthSetback: number;
    locksEnabled: boolean;
    lockSideDistance: number;
    carcassColor: string;
    carcassColorName: string;
    leftSideDoorColor: boolean;
    rightSideDoorColor: boolean;
  };
  zones: ResolvedZone[];
  boards: Board[];
  features: KitchenCabinetFeature[];
  validation: { errors: string[]; warnings: string[] };
  debug?: Record<string, unknown>;
}
