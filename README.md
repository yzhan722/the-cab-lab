# The Cab Lab

Cabinet CAD workspace. Metric (mm), Z up, right-handed. Electron + Three.js.

Workflow: **step 1 define the space** (Box, or Vehicle = box rear + side-profile nose; Floor plan later) → pick a **module** on the left → drag its **box** on the floor.
The box *is* the generator's outer size. Pull its faces to change W / D / H, drag the orange bars to move
zone boundaries, or click / drag the **2D schematic** in the right panel. Boards are always regenerated from `job.json`, never edited.

Current state: Small, Overhead, U overhead (three OHC runs), Bedroom body, Bed Box, Bed Side Table, Tall, kitchen Base and Lounge
are wired. Cab Lab Overhead is **not** replaced by the older Fusion pin (it already has LED groove and rangehood).
Lounge is a rail group (I / L / U / Parallel). Cab Lab U is three I-shape runs; Fusion `89bedb2` still draws L.
Hide Tall / Base / Lounge on the rail with `CABLAB_MIGRATED_GENERATORS=0`.

## Run

First time (installs deps, repairs the Electron binary if needed, creates `The Cab Lab.exe` and a desktop shortcut):

```
TheCabLab.bat
```

After that, use the **The Cab Lab** desktop shortcut, or:

```
npm start
```

On Linux, if Chrome sandbox is not setuid, add `--no-sandbox` to the Electron invocation.

`npm start` also rebuilds `renderer/gen/*.js` from `generators/`. The bundles are committed so the
desktop shortcut works without a build step; run `npm run build:generators` after changing a generator.
Generator unit + oracle tests: `npm run test:generators`.

## Layout

- `main.js` — Electron window, open / save dialogs, DXF open, `settings.json` read / atomic write (IPC)
- `preload.js` — exposes `window.cablab.openJob / saveJob / openDxf / readSettings / writeSettings` and `flags.migratedGenerators`
- `renderer/space.js` — scene, camera, grid, axes, room (walls and roof follow the resolved profile), picking helpers
- `renderer/job.js` — `job.json` in memory, undo / redo snapshots, generator result cache; `finish` + `stock` are the job cabinet catalogue
- `renderer/materials.js` — carcass/partition colour (White Stipple), door card (Acrylic / HPL, one or two colours), board stocks (carcass 15 / partition 18 / door 16); new cabinets copy these into params
- `renderer/spaces.js` — space kinds (`box`, `vehicle`) → floor polygon, roof profile, height, obstacles; `clearHeightAt`; fit tests
- `renderer/dxf.js` — minimal DXF reader (LINE / LWPOLYLINE / POLYLINE / ARC / SPLINE → chained points) for the vehicle nose
- `renderer/settings.js` — user defaults persisted in `<userData>/settings.json` (loaded before the space dialog opens)
- `renderer/spaceDialog.js` — "Define the space" modal (step 1, also Edit space): kinds, fields, nose preview, points table, DXF import, cabinet colours + board stocks, Set current as default
- `renderer/modules.js` — module registry: generator bundle + envelope (W / D / H) + divider handles; `placement: "nose"`
  modules add `withSpace` (bind width / height / roof profile to the space), `envelopeProfile`, `handles`, `roofAware`
- `renderer/cabinets3d.js` — draws boards, envelope, handles from generator output
- `renderer/snap.js` — feature points (space + cabinet corners), face planes for alignment, edge / height inference
- `renderer/interact.js` — left-button interaction: three-step placement (floor-standing modules start on the floor; overhead on a ceiling edge), Lounge polyline, Move command, type-ins, select, resize, dividers, keys
- `renderer/loungePlace.js` — I / L / U / Parallel floor polyline → generator params / pose
- `renderer/schematic.js` — Fusion-style 2D front / plan schematic (click a cell, drag a boundary)
- `renderer/presets.js` — per-module starting sizes (preset H today; a settings UI will edit them)
- `renderer/hud.js` — cursor tooltip
- `renderer/panel.js` — right panel (space or selected cabinet, wide schematic for geometry modules) and drawer tables
- `renderer/ui.js` — shell wiring
- `generators/` — Cab Lab's own cabinet generators (TypeScript). Small / OHC / Bedroom / Bed Box are Cab Lab-native. Tall / kitchen / lounge are Fusion `89bedb2` copies. Test-only Fusion oracle: `generators/test/reference-fusion/` (never imported from `renderer/`).
- `renderer/gen/` — generated ESM bundles of `generators/*/generator.ts` (do not edit)
- `build-generators.js` — esbuild script producing `renderer/gen`
- `ensure-electron.js` — repairs a missing `electron.exe`
- `create-desktop-shortcut.ps1` — builds `The Cab Lab.exe` + desktop shortcut (`npm run shortcut`)
- `.cursor/rules/cab-lab-core.mdc` — project contract

## Controls

- Left-drag: orbit · click: select · Alt+left-drag: orbit over handles · hold wheel: orbit · right-drag: pan · scroll: zoom
- Placing, three steps (SketchUp-style): pick a module → **floor-standing modules start on the space floor only** (not a wall or a cabinet top); **Overhead** still starts on a ceiling ∩ wall line. Hover shows that working face (blue sheet) → click a corner or grid point on it → draw a flat, zero-thickness rectangle
  on that face and click the opposite corner → pull the rectangle off the face, one way only (away from the wall / floor / cabinet —
  it can't be pulled into them) and click. Side walls are only selectable from the **room inside** (Move still uses any pickable face). A corner is shared by up to three faces: for overhead, drag onto the ceiling, the back wall, or a side
  wall — the face is not locked until the second click. Floor and ceiling stay pickable from either side. A cabinet top
  flush with the ceiling counts as the ceiling (pull down into the room). A cabinet
  face flush with a wall (no room outward) pulls into the room on that same plane;
  an empty side wall is still not selectable from outside. Only the two in-plane sizes are typed in
  step 2; `Enter` creates with the preset size along the face normal (H on floors, D on front/back walls, W on side
  walls). Boxes are axis-aligned. The door side is chosen when the box is created: never against a wall or a
  neighbour (a blocked side puts the doors opposite); otherwise the long horizontal edge is the door edge, facing the
  middle of the room (ties: front). W is always the edge along the doors, D the edge through them (fronts included in the
  box), H the height — so a box drawn on a side wall becomes a cabinet whose W runs along that wall. After creating you stay armed;
  `Shift+click` repeats the last size at a new corner; typing digits re-sizes the box you just made. `Esc` restarts /
  stops.
- Space dialog: Front / Right / Back / Left wall checkboxes (all on by default). Below the space fields:
  **Cabinets** — carcass / partition colour is **White Stipple**; doors are **Acrylic** or **HPL** (one or two
  colours from that series). Board stocks default to **Carcass 15 mm**, **Partition 18 mm**, **Door 16 mm**.
  These live on the job (`finish` / `stock`), not on the space. New cabinets copy White Stipple onto the box,
  door colour A onto the fronts, and the matching thicknesses. Which modules use door colour B is set later.
  **Set current as default** (in the Cabinets block) saves the catalogue to `settings.json` for new jobs.
- **Vehicle space**: width is constant; the rear is a box (Width × Rear depth × Height) and the nose is a side view
  (Y along the van from the nose tip at `Y = 0`, Z up) grafted onto its front. The nose comes either from **Points**
  (a table of feature points joined by straight lines — the built-in default is `(0,0) (0,737) (345,1515) (579,1758)
  (1520,1965) (1520,0)`) or from a **DXF** side view (LINE / POLYLINE / ARC / SPLINE, longest chain, `$INSUNITS`
  respected). The roof at any Y is the highest point of the drawing there, so an open upper edge or a closed outline
  both work. The nose's rearmost edge (the seam) is scaled uniformly to Height; the preview shows the seam in blue when
  it already matches and in orange with the scale factor when it does not. Boxes stop at the sloped roof
  (`H stopped at roof`), the flat rear ceiling stays pickable, the sloped roof is not a working plane yet.
  **Set current as default** saves the whole Vehicle form to `settings.json` immediately (atomic write, survives a
  restart, outside the repo); new Vehicle spaces start from it. **Reset to built-in** removes it. The **Side** view
  looks across the van so the profile reads as drawn.
- **Overhead** (OHC, `generators/overheadCabinet/generator.ts`): hangs from the ceiling with its back on a wall. The
  anchor can only be a feature point on a **ceiling ∩ wall line** (a top corner of the room, an overhead's top-back
  corner, a plane ∩ ceiling corner); other points are refused with a hint. **W runs along that wall**, the doors face
  the room, the top stays on the ceiling (the box only grows down). Three faces take the 2D rectangle: the ceiling
  (W×D, pull H down), the wall itself (W×H, pull D into the room) or a face perpendicular to the wall — a neighbour's
  side, or the adjacent wall at a corner (D×H, pull W). At a corner both walls qualify; the box decides at the end:
  W follows the wall its longer horizontal edge runs along. The type-in labels switch to module terms as soon as the
  wall is known (on the left wall the X field reads `D`). The box is the whole solid — carcass, the 40 mm top
  structure and the door thickness (box depth = `cabinetDepth + door`, exactly like Small); the doors hang 30 mm below
  it by design. Every non-door board is carcass stock, the doors are door stock. **Face and `R` are refused** (one
  possible door side), Move slides it along the ceiling only (ΔZ is 0), the H handle sits on the bottom and pulls it
  down. Selecting an overhead turns the right panel into its **editor page** (wide): a **zone strip** left → right
  (drag a boundary in 10 mm steps, `Shift` = 1 mm; click a zone, `Ctrl+click` adds to the selection; **Add / Delete /
  Average selected**; widths and running positions underneath), the **2D front schematic** (click a zone, drag a
  boundary — the same as the strip), a card for the selected zone (type Up flap / Fixed panel / Open, width — the neighbour absorbs the
  difference) and the cabinet-level fields folded below (outer size incl. doors, bottom height, stock). Zones are
  never narrower than 150 mm and always sum to W. Every editor action is one undo step. The orange vertical bars in
  3D are the same boundaries. Boards are emitted in their final assembled pose (fronts at local −Y, top at H).
- **U overhead**: one bounding box on the ceiling (same placement as Overhead). Inside it, three existing OHC
  generators run along the left, back and right of that box; doors face the opening. Envelope D is the U's outer
  depth; **Run depth** is each cabinet's carcass depth. The box has no extra door allowance (doors hang inward).
  The right-panel plan schematic shows the three runs; drag a zone boundary on a run.
- **Lounge** is a rail group: hovering it opens **I** (two clicks), **L** (three), **U** (four) and **Parallel** (three).
  All clicks stay on the floor. The polyline is the **back edge** (axis-aligned; each run after the first is 90°);
  section depth grows toward the room; height and depth come from the preset. `Enter` finishes when the shape is
  complete; `Esc` cancels. You stay armed for another of the same branch. **U** is three existing I-shape runs inside
  the bounding box (mouth at local Y = 0) — Fusion at `89bedb2` still falls through to L. Parallel along X is posed
  `rotZ 90` so Fusion's facing axis stays local X. Generator: `generators/lounge/generator.ts`.
- **Bedroom** is a rail group: hovering it opens a flyout with **Body** (the nose slab below), **Bed Box** (below) and
  **Bed Side Table** (below). Groups are declared in `MODULE_GROUPS` in `renderer/modules.js`.
- **Bedroom › Bed Box** (one per vehicle, needs the Body first — the flyout item is disabled until it exists): the bed
  base as one solid volume, glued to the Body's room-side face, centred on the van's centre line and symmetric about
  it; height = tunnel boot height (420 until the boot is defined on the Body). Two steps: **width** — a 2D line on the
  floor along the Body face grows symmetrically from the centre line (width = 2 × distance from the centre line to the
  cursor), type `W`, click or `Enter` locks it; **length** — the box rises and its room-side face follows the cursor
  into the room (snaps to cabinet faces, stops at the back wall and at cabinets in its lane), type `D`, click or `Enter`
  creates. `Esc` at any step cancels the whole thing. Picking Bed Box again selects the existing one and re-runs both
  steps (nothing is duplicated). It follows the Body: change the Body's depth, redefine the space or edit W / D in the
  panel and `attach()` re-centres it and keeps it against the Body face (`bindToJob` in `job.js`); the Body's depth drag
  ignores cabinets attached to it. Generator `generators/bedBox/generator.ts`.
- **Bedroom › Bed Side Table** (one per side, needs the Body): a nightstand volume against the Body's room-side face
  and a side wall. Two steps: **width** — move toward the left or right of the van; the table sits on that wall and
  grows inward (stops at the Bed Box if present, otherwise the centre line); **length** — pull into the room from
  the body. Picking the module again and hovering a side that already has a table re-sizes it. Follows the Body via
  `attach()`. v0 emits no boards. Generator: `generators/bedSideTable/generator.ts`.
- **Bedroom › Body** (nose slab, one per vehicle): not a free box. Its front is the nose cross-section, its width the van's
  inside width, its height the roof at the room-side face; the only free size is the depth **from the front**.
  Pick the module → the slab is already shown at the preset depth (700). Click anywhere → the room-side face follows
  the cursor along the van (snaps to roof breaks, the seam and cabinet faces; stops at the back wall and at other
  cabinets), the single **From front** type-in takes numbers and expressions; click again or `Enter` creates it,
  `Esc` cancels; `Enter` straight away takes the preset. Picking the module again selects the existing slab and
  re-enters the same depth drag (nothing is duplicated). The slab is posed `rotZ 180` at the nose so the room-side
  face is its front; local Y runs from the room face toward the nose and the roof profile over the slab is bound into
  its params (`roofProfile`) on create, on every edit and whenever the space is redefined. Only a D handle is shown;
  the panel's **From front** field moves the room-side face too. v0 emits no boards: the slab is drawn as one solid
  cut to the roof (a volume-only module — no boards, no validation errors, `envelopeProfile` present). Tunnel boot,
  robes and overhead will be partitioned inside this envelope later. Generator: `generators/bedroom/generator.ts`.
- Type-ins: `Tab` or a digit opens W / D / H. Values may be `1110`, `+50`, `-20`, `*2`, `/2`, `max`, or `1110,560,720`
  (comma fills the next fields). Plain numbers apply live; expressions apply on `Tab` / `Enter`.
- Inference: after touching a corner, moving along one of its edges pins that coordinate (dashed axis-coloured line),
  rest on a point of the line for ~0.4 s ("Point kept for the next edge") and a third edge can start from it ·
  vertical faces of walls and cabinets act as guide lines
  ("Flush with cab-1 side", orange dashes) · the extrude step snaps to faces and corners along the normal · hold `Shift` to keep
  the current line. The cursor tooltip always says which rule is active and which dimension was stopped by a wall.
- The box never leaves the space or enters another cabinet: rectangle and extrusion stop at walls and at existing boxes
  (outline turns orange, tooltip names what stopped it, e.g. `H stopped at cab-2`); Move and resize handles stop at the boundary
- Command bar (the icon row under the file bar): **Move** (four-way arrow, `M`), **Face** (cube with a facing side, `O`), **Plane** (two parallels, `P`). Hover for the name.
- Plane (`P` or the Plane icon): click a wall or cabinet face, pull a parallel plane into the room (type Offset), click or `Enter` to leave it. What you see is the plane ∩ the space (including the roof). Its corners become snap points, so a box can start off a wall without starting from a space corner. Planes are stored in `job.planes` and do not follow the source face. Delete removes the selected plane.
- Move (`M` or the Move icon): click a grab point, then a target point; `Tab` types ΔX / ΔY / ΔZ; `Ctrl+click` copies.
  There is no drag-to-move.
- Face (`O` or the Face icon): click a side of a cabinet and its doors move to that side. **The box never moves**:
  W and D swap so the envelope stays exactly where it is (the side goes orange as a preview); click another side to
  change, click elsewhere or `Enter` to confirm (the side flashes green), `Esc` puts it back. Tops and bottoms are never
  door sides, nor is a side flush against a wall or a neighbour, nor one that would leave W or D below the module minimum.
  `R` still rotates the whole cabinet 90° about its centre (that does change the footprint).
  Fronts are drawn light blue, carcass tan, so the door side of every cabinet is visible at a glance.
- Blue cubes: pull W / D / H · orange bars: zone boundaries (horizontal for stacked zones, vertical for zones along W)
- Right panel (geometry modules): a **2D schematic** of the generated cabinet — front for stacked / OHC / kitchen, plan for Lounge / U overhead. Click a cell to select it; drag a boundary to change a divider (10 mm steps, `Shift` = 1 mm). That writes params and regenerates; it does not edit mesh vertices.
- `M` move · `O` face · `R` rotate 90° · `F` frame selection (or space) · `Del` remove · `Esc` cancel / deselect
- `Ctrl+N/O/S` new / open / save (`Ctrl+Shift+S` save as) · `Ctrl+Z/Y` undo / redo · `F12` dev tools
- `Ctrl+Shift+L` open the usage log folder
- `Ctrl+Shift+P` (or **Capture** next to Top/Front/Side) save the live camera plus Top / Front / Side / 3D into `logs/latest-view/` (and a timestamped `logs/view-<time>/`)
- `Ctrl+Shift+Q` or `Ctrl+Shift+G` (or **QA** next to Capture) replace the job with a QA layout of every wired module, then capture each module into `logs/qa/` (asks first if cabinets already exist)

## Usage log

Every action and every system decision is appended to `logs/usage.jsonl` (git-ignored), one JSON object per line: module armed, anchor point, the last 60 cursor resolutions of a placement (feature / inference / plane, with the world point), typed dimensions, final box, handle drags (envelope before → after), panel edits, space definition, file operations, undo/redo, generator validation errors and uncaught errors (which also write `logs/crash-<time>.json` with the whole job). `logs/latest.json` holds the last action and last error. `Ctrl+Shift+P` writes PNG views of the 3D canvas to `logs/latest-view/` (current camera + Top / Front / Side / 3D). When something goes wrong, the log is what to read first — see `.cursor/rules/cab-lab-usage-log.mdc`.
