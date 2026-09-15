# Parity matrix

Tolerance: **0.01 mm**. Source baseline `89bedb204c5aabe839409a62d56609f2ef86ce20`.
Status values: `PASS` | `DIFFERENCE` | `INTENTIONAL_DIVERGENCE` | `BLOCKED_EXTERNAL` | `SOURCE_AMBIGUITY`.

Native copies live in `generators/{generalTall,kitchen,lounge}/`.
Oracle copies (test-only, never imported from `renderer/`) live in `generators/test/reference-fusion/modules/`.

Cab Lab OHC is **not** a Fusion copy.

| Module | Scenario | Source | Target | Status | Notes |
|---|---|---|---|---|---|
| general_tall | Fusion `generator.test.ts` | modules/generalTallCabinet | `generators/generalTall` | PASS | Original node:assert suite |
| general_tall | stackingCalculator | same | native | PASS | |
| general_tall | boundaryResolver | same | native | PASS | |
| general_tall | fridgeZone | same | native | PASS | Fridge remains a zone |
| general_tall | regression | same | native | PASS | |
| general_tall | assemblyOverlapAudit | same | native | PASS | `node:test` replaced with immediate invoke |
| general_tall | default params bbox/ids | oracle vs native | 0.01 mm | PASS | `oracle-parity.test.ts` |
| kitchen | default params boards/fronts/vPanels | oracle vs native | 0.01 mm | PASS | |
| kitchen | `kitchen_base.json` | Fusion fixture | native + oracle | PASS | |
| lounge | Fusion `generator.test.ts` | modules/loungeGenerator | native | PASS | |
| lounge | I/L/PARALLEL bbox | oracle vs native | 0.01 mm | PASS | |
| lounge | U_SHAPE geometry | Fusion generator | three I runs | INTENTIONAL_DIVERGENCE | Fusion falls through to L; Cab Lab composes three I-shape runs |
| overhead | Cab Lab OHC vs Fusion 89bedb2 | Fusion pin | existing Cab Lab OHC | INTENTIONAL_DIVERGENCE | LED groove, rangehood, final pose already in Cab Lab; Fusion pin has neither LED nor rangehood |
| small / bedroom / bed box | existing Cab Lab suites | Cab Lab | unchanged | PASS | Decision B |
| general_tall | every Fusion UI control | Fusion plugin UI | right panel | INTENTIONAL_DIVERGENCE | First-pass: W/D/H, zones, top/bottom style, avoidance |
| kitchen | every Fusion UI control | Fusion plugin UI | right panel | INTENTIONAL_DIVERGENCE | Columns/zones + toe kick. Wheel avoidances / V-panel machining not in the form |
| lounge | every Fusion UI control | Fusion plugin UI | right panel | INTENTIONAL_DIVERGENCE | Style I/L/U/PARALLEL, lids, avoidance, dims, plan schematic. Hinge/lock/groove not in the form |
| all | 3D visual QA | Fusion viewport | Cab Lab Three.js | BLOCKED_EXTERNAL | Decision F: human visual QA |
| kitchen | DXF export | Fusion DXF | not in Cab Lab | INTENTIONAL_DIVERGENCE | Profiles kept on generator result |
| rail | Tall / Base / Lounge entries | — | planned unless flag | PASS | `CABLAB_MIGRATED_GENERATORS` default off |
