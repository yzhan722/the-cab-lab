/**
 * 设计意图接缝声明（声明式数据）。kitchen v1 仅 2 条（与 Fusion 端一致，
 * 源码自认 "v1: bottom rail-to-deck only"）；其余接缝未声明（规格坑④）。
 */
export interface RelationshipDeclaration {
  declarationId: string;
  generator: "kitchen";
  panelAId: string;
  panelBId: string;
  relationshipType: "structural_butt_joint";
  geometryType: "edge_to_surface";
  hostPanelId: string;
  targetPanelId: string;
  ruleId: string;
  allowedHardware: string[];
}

export const KITCHEN_RELATIONSHIP_DECLARATIONS: RelationshipDeclaration[] = [
  {
    declarationId: "kt_b1_b3_bottom_rail_to_deck",
    generator: "kitchen",
    panelAId: "B1",
    panelBId: "B3",
    relationshipType: "structural_butt_joint",
    geometryType: "edge_to_surface",
    hostPanelId: "B1",
    targetPanelId: "B3",
    ruleId: "kt_b1_b3_bottom_rail_to_deck_v1",
    allowedHardware: ["screw_hole"],
  },
  {
    declarationId: "kt_b2_b3_carcass_rail_to_deck",
    generator: "kitchen",
    panelAId: "B2",
    panelBId: "B3",
    relationshipType: "structural_butt_joint",
    geometryType: "edge_to_surface",
    hostPanelId: "B2",
    targetPanelId: "B3",
    ruleId: "kt_b2_b3_carcass_rail_to_deck_v1",
    allowedHardware: ["screw_hole"],
  },
];

export function relationshipDeclarationsForBoards(
  boardIds: ReadonlySet<string>,
): RelationshipDeclaration[] {
  return KITCHEN_RELATIONSHIP_DECLARATIONS.filter((d) =>
    [d.panelAId, d.panelBId, d.hostPanelId, d.targetPanelId].every((id) => boardIds.has(id)),
  );
}
