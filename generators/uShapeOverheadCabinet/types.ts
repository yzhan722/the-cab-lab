/** U overhead v0 — three generateOverheadCabinet runs in one envelope. Opening at y = 0. */

import type { Board } from "../overheadCabinet/types.ts";

export type { Board };

export interface UOverheadZone {
  id?: string;
  type?: string;
  width: number;
}

export interface UOverheadParams {
  cabinetWidth: number;
  cabinetDepth: number;
  cabinetHeight: number;
  /** Depth of each OHC arm (OHC cabinetDepth). */
  armDepth?: number;
  style?: string;
  featureWidth?: number;
  frontPanelThickness?: number;
  topClearanceHeight?: number;
  clearance?: number;
  carcassColor?: string;
  carcassColorName?: string;
  doorSeries?: string;
  doorColor?: string;
  doorColorName?: string;
  colorSlot?: string;
  leftZones?: UOverheadZone[];
  backZones?: UOverheadZone[];
  rightZones?: UOverheadZone[];
}

export interface UOverheadResult {
  params: {
    cabinetWidth: number;
    cabinetDepth: number;
    cabinetHeight: number;
    armDepth: number;
    frontPanelThickness: number;
    featureWidth: number;
    carcassColor: string;
    carcassColorName: string;
  };
  zones: UOverheadZone[];
  boards: Board[];
  features: unknown[];
  validation: { errors: string[]; warnings: string[] };
  debug?: Record<string, unknown>;
}
