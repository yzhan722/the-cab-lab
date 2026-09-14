# Source inventory — Fusion `89bedb2`

Read-only source: `yzhan722/troysfirstfusionproject` @ `89bedb204c5aabe839409a62d56609f2ef86ce20`.

Oracle copies (test-only, never imported from `renderer/`): `generators/test/reference-fusion/modules/`.
Native Cab Lab copies: `generators/{generalTall,kitchen,lounge}/`.

No `adsk` imports in the TypeScript modules. Fusion API lives only in plugin adapters — not copied here.

## generalTallCabinet

**In module:** `generator.ts`, `types.ts`, `stackingCalculator.ts`, `boundaryResolver.ts`, `assemblyOverlapAudit.ts`, `relationshipDeclarations.ts`, `validationCases.heightBalanced.ts`, tests: `generator`, `regression`, `fridgeZone`, `stackingCalculator`, `boundaryResolver`, `assemblyOverlapAudit`.

**Entry:** `generateGeneralTallCabinet(GeneralTallCabinetParams) → GeneralTallCabinetResult`
`{ boards, features, frontPanels, stacking, boundaries, validation, warnings, debug, relationshipDeclarations }`.

Cab Lab 3D concatenates `frontPanels` onto `boards` in `renderer/displayBoards.js` (fronts stay separate in the Fusion result).

**Params:** `cabinetHeight/Width/Depth`, optional thicknesses / side-panel fridge flags, `frontHardware`, `avoidance {enabled, depth, height}`, `topSystem`, `bottomSystem`, `zones[]`, `exteriorSide`, `syncCabinetWidthFromFridge`.

**ZoneType:** `side_door`, `left_side_door`, `right_side_door`, `double_door`, `drawer`, `open_space`, `open_appliance`, `fridge`, `top_flap`, `bottom_flap`, `blank_panel`. Fridge is a zone, not a fifth module.

**Top/bottom:** `style_1` (rail + insert) / `style_2` (solid ≥60). Stacking: bottom system → zones + Zi boundaries → top system. Zones in params are **bottom → top**.

## overheadCabinet

**Not copied from Fusion into Cab Lab.** Cab Lab already has `generators/overheadCabinet/` with LED groove, rangehood, and `boardFrame: "final"` — ahead of Fusion `89bedb2`. See `INTENTIONAL_DIVERGENCE` in the parity matrix.

Fusion at this pin: no `rangehood`, no `ledGroove`.

## kitchenCabinet

**In module (3 files, no in-module Fusion tests):** `generator.ts`, `types.ts`, `relationshipDeclarations.ts`.

**Entry:** `generateKitchenCabinetGeometry(KitchenLayoutState) → KitchenGeometryResult`
`{ boards, frontPanels, vPanels, panelDxf, slotRequests, resolvedSlots, relationshipDeclarations, warnings, errors, debug }`.

Cab Lab 3D concatenates fronts + V-panels (YZ profile bbox) onto `boards`.

**Column/zone types:** `left_door`, `right_door`, `double_door`, `drawer`, `open`, `down_flap`, `stove`, `custom`. `vPanelMachiningPreferences` stay on params (manufacturing, not envelope).

**Fixture:** `generators/test/generator-parity/kitchen_base.json`.

## loungeGenerator

**In module:** `generator.ts`, `types.ts`, `relationshipDeclarations.ts`, `generator.test.ts` (L / I / PARALLEL).

**Entry:** `generateLoungeGeometry(Partial<LoungeSettings>) → LoungeGeometryResult`
`{ panels, openings, lids, footprint, validation, relationshipDeclarations }` (panels, not `boards`).

Cab Lab 3D maps `panels` + `lids` through `placement` + `outer` in `renderer/displayBoards.js`.

**Styles:** `L_SHAPE`, `I_SHAPE`, `PARALLEL`, `U_SHAPE`. `U_SHAPE` is typed; **the generator falls through to the L path** at this SHA (`SOURCE_AMBIGUITY`).

## Execution stamps

- A: test oracle at `generators/test/reference-fusion/modules` — never imported from `renderer/`
- B: existing Cab Lab modules (small / OHC / bedroom / bed box) keep working
- C: existing job/module behavior stays stable (no CFP `engineeringHash`)
- D: kitchen machining prefs on params, not envelope fields
- E: millimetres, 0.01 mm native vs oracle
- F: agent = compile / bbox / tests; 3D visual QA left to human
- Feature flag `CABLAB_MIGRATED_GENERATORS` default **off**
