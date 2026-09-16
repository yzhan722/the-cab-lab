/** Tall Cabinet v0 — Small's floor box, taller, extra zone types. No Fusion Style-1 stiles. */

export type TallCabinetZoneType = "left_door" | "right_door" | "double_door" | "drawer" | "open";

export type ProfilePoint =
  | { x: number; y: number }
  | { y: number; z: number }
  | { x: number; z: number };

export interface TallCabinetZone {
  id?: string;
  type: TallCabinetZoneType | string;
  /** Logical zone height (mm). Zones stack top→bottom; sum must equal interior height. */
  height: number;
  lockEnabled?: boolean;
  lockSideDistance?: number;
}

export interface TallCabinetParams {
  cabinetWidth: number;
  cabinetDepth: number;
  cabinetHeight: number;
  panelThickness?: number;
  frontPanelThickness?: number;
  frontClearance?: number;
  locksEnabled?: boolean;
  lockSideDistance?: number;
  carcassColor?: string;
  carcassColorName?: string;
  leftSideDoorColor?: boolean;
  rightSideDoorColor?: boolean;
  zones?: TallCabinetZone[];
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

export interface TallCabinetFeature {
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
  type: TallCabinetZoneType;
  height: number;
  zTop: number;
  zBottom: number;
  clearZ0: number;
  clearZ1: number;
  lockEnabled: boolean;
  lockSideDistance: number;
}

export interface TallCabinetResult {
  params: {
    cabinetWidth: number;
    cabinetDepth: number;
    cabinetHeight: number;
    panelThickness: number;
    frontPanelThickness: number;
    frontClearance: number;
    locksEnabled: boolean;
    lockSideDistance: number;
    carcassColor: string;
    carcassColorName: string;
    leftSideDoorColor: boolean;
    rightSideDoorColor: boolean;
  };
  zones: ResolvedZone[];
  boards: Board[];
  features: TallCabinetFeature[];
  validation: { errors: string[]; warnings: string[] };
  debug?: Record<string, unknown>;
}
