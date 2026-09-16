/** Lounge v0 — floor polyline of I / L / U box segments. Not a Fusion lounge paste. */

export type LoungeStyle = "I" | "L" | "U";

export interface LoungePoint {
  x: number;
  y: number;
}

export interface LoungeParams {
  /** Polyline of the back (wall) edge, local XY. First point at origin after placement shift. */
  path?: LoungePoint[];
  /** Seat depth toward the room (mm). */
  depth?: number;
  height?: number;
  /** A local point on the room side of the polyline (chooses the offset side). */
  inwardX?: number;
  inwardY?: number;
  panelThickness?: number;
  frontPanelThickness?: number;
  carcassColor?: string;
  carcassColorName?: string;
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
}

export interface LoungeSegment {
  id: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface LoungeResult {
  params: {
    path: LoungePoint[];
    depth: number;
    height: number;
    inwardX: number;
    inwardY: number;
    panelThickness: number;
    frontPanelThickness: number;
    carcassColor: string;
    carcassColorName: string;
    style: LoungeStyle;
  };
  zones: LoungeSegment[];
  boards: Board[];
  features: never[];
  validation: { errors: string[]; warnings: string[] };
  debug?: Record<string, unknown>;
}
