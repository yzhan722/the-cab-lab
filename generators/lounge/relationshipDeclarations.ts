/**
 * L 形 v1 三条接缝（spec §6）。I / Parallel / 中柜本轮不声明。
 */
export interface RelationshipDeclaration {
  declarationId: string;
  generator: "lounge";
  panelAId: string;
  panelBId: string;
  hostPanelId: string;
  targetPanelId: string;
}

export const LOUNGE_RELATIONSHIP_DECLARATIONS: RelationshipDeclaration[] = [
  { declarationId: "lg_main_front_to_top", generator: "lounge", panelAId: "main_front", panelBId: "main_top", hostPanelId: "main_front", targetPanelId: "main_top" },
  { declarationId: "lg_l_front_to_side", generator: "lounge", panelAId: "l_front", panelBId: "l_side", hostPanelId: "l_front", targetPanelId: "l_side" },
  { declarationId: "lg_l_front_to_top", generator: "lounge", panelAId: "l_front", panelBId: "l_top", hostPanelId: "l_front", targetPanelId: "l_top" },
];

export function relationshipDeclarationsForBoards(ids: ReadonlySet<string>): RelationshipDeclaration[] {
  return LOUNGE_RELATIONSHIP_DECLARATIONS.filter((d) => ids.has(d.panelAId) && ids.has(d.panelBId));
}
