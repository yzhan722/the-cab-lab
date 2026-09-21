/**
 * 设计意图接缝声明（声明式数据）。骨架 4 条 + 冰箱 4 条（与 Fusion 端一致；
 * Zi↔V 槽、H 板↔立梃、VD↔Zi/H34、DS/门板均无声明——规格坑⑥）。
 */
export interface RelationshipDeclaration {
  declarationId: string;
  generator: "generalTall";
  panelAId: string;
  panelBId: string;
  relationshipType: "structural_butt_joint" | "face_contact";
  geometryType: "edge_to_surface" | "surface_to_surface";
  hostPanelId: string;
  targetPanelId: string;
  ruleId: string;
  allowedHardware: string[];
}

const D = (
  declarationId: string, a: string, b: string,
  relationshipType: "structural_butt_joint" | "face_contact",
  geometryType: "edge_to_surface" | "surface_to_surface",
  hw: string[],
): RelationshipDeclaration => ({
  declarationId, generator: "generalTall",
  panelAId: a, panelBId: b,
  relationshipType, geometryType,
  hostPanelId: a, targetPanelId: b,
  ruleId: `${declarationId}_v1`,
  allowedHardware: hw,
});

export const GT_RELATIONSHIP_DECLARATIONS: RelationshipDeclaration[] = [
  D("gt_b1_b3_bottom_rail_to_deck", "B1", "B3", "structural_butt_joint", "edge_to_surface", ["screw_hole"]),
  D("gt_t1_t3_top_rail_to_insert", "T1", "T3", "structural_butt_joint", "edge_to_surface", ["screw_hole"]),
  D("gt_b2_b3_carcass_rail_to_deck", "B2", "B3", "structural_butt_joint", "edge_to_surface", ["screw_hole"]),
  D("gt_t2_t3_carcass_rail_to_insert", "T2", "T3", "structural_butt_joint", "edge_to_surface", ["screw_hole"]),
  D("gt_sidepanel_l_v1", "SidePanel_L", "V1", "face_contact", "surface_to_surface", []),
  D("gt_sidepanel_r_v2", "SidePanel_R", "V2", "face_contact", "surface_to_surface", []),
  D("gt_v5_v1", "V5", "V1", "face_contact", "surface_to_surface", []),
  D("gt_v5_v2", "V5", "V2", "face_contact", "surface_to_surface", []),
];

export function relationshipDeclarationsForBoards(
  boardIds: ReadonlySet<string>,
): RelationshipDeclaration[] {
  return GT_RELATIONSHIP_DECLARATIONS.filter((d) =>
    [d.panelAId, d.panelBId, d.hostPanelId, d.targetPanelId].every((id) => boardIds.has(id)),
  );
}
