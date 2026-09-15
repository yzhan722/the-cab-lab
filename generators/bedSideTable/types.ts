/**
 * Bed Side Table v0 — a nightstand volume beside the bed, against the
 * Bedroom body and a side wall. Emits no boards: the renderer shows the
 * envelope. One table per side (left / right).
 *
 * Local: origin at the room-side face at floor level; X left→right,
 * Y room face → body, Z up.
 */

export interface BedSideTableParams {
  width: number;
  depth: number;
  height: number;
  /** Which side of the van: against min-X or max-X. */
  side?: "left" | "right";
  panelThickness?: number;
  frontPanelThickness?: number;
  carcassColor?: string;
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
}

export interface BedSideTableResult {
  params: {
    width: number;
    depth: number;
    height: number;
    side: "left" | "right";
    panelThickness: number;
    frontPanelThickness: number;
    carcassColor: string;
  };
  zones: Array<{ id: "table"; x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }>;
  boards: Board[];
  features: never[];
  validation: { errors: string[]; warnings: string[] };
}

export const BED_SIDE_DEFAULT_HEIGHT = 420;
export const BED_SIDE_MIN = { width: 200, depth: 300, height: 100 };
