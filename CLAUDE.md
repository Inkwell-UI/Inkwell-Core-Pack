# Inkwell Core Pack

The core visual-scripting nodes for Inkwell, released on its own schedule. The full design is in `Inkwell Design Spec.md` (workspace root), sections "Visual scripting" and "Node packs"; read them before adding or changing nodes. Where this file and the spec disagree, the spec wins; fix this file.

## Contents

- `manifest.json` (id `core`), `nodes/<Kind>.json` (one definition per node, `NodeDef` from `inkwell-spec`; `fields` maps field name to a JSON Schema), `templates/<Kind>.as2` (one AS2 template per node; editor-only nodes have none), optional `.as` class files later.
- `docs/templates.md`: the template format (placeholders, pure nodes, loops, Delay, error convention). Read it before touching a template.
- `scripts/lib.mjs` (loader and a minimal test renderer; the real renderer is the editor's codegen), `scripts/validate.mjs`, `test/` (snapshot of every rendered template).

Commands (yarn only): `yarn validate` (schemas, template files exist, placeholders match pins), `yarn test` (`UPDATE=1 yarn test` rewrites `test/rendered.snap.as2`; review the diff). `inkwell-spec` is a `link:../Inkwell-Spec` dev dependency: run `yarn build` there after schema changes. Changing a template or pin means updating the snapshot and `CHANGELOG.md`.

## Rules that are easy to break

- **No JavaScript, ever.** Packs are declarative data plus AS2 templates.
- **Node identity is `packId/nodeKind@major`.** Changing pins, removing a node or changing semantics is breaking: bump the major and keep the old major until projects can migrate.
- **Semver for every release,** with a changelog entry per changed node; the editor shows it in "Update packs".
- **Templates generate readable AS2:** namespaced classes (`mods.<modId>.*`), no global names, source-mapped to the node.
- **Templates target Flash 8 AS2 as Skyrim's GFx runs it:** there is no `Error` class (throw strings or plain objects carrying the node ID) and no AS2 runtime `flash.filters`.
- **Outputs coerce to pin defaults** (`undefined` Number → `0`, String → `""`); templates must never throw past the event handler's `try/catch`. The only template that throws on purpose is the Debug `Throw` node (`{node, message}`), for testing that handler.
- **Pure nodes must be side-effect free,** since the compiler caches them per dependency scope.
- **Milestones:** 0.2 ships events, flow, variables, logic/text/math, components, Log and Assert, and (pulled forward by the owner, 2026-10-25, because they need no runtime) the Data and Animation nodes; 0.3 adds the runtime events, List and Game bridge nodes (`requiresRuntime`, templates call `__g.bridge`). 130 nodes (pack version 0.5.1), 127 with a template (`yarn validate` prints the counts; the Editor's FFDec integration test compiles the 127). Get Selected and Get Input Device are exec nodes although SPEC-CHANGES S8 says pure (see `SPEC-CHANGES.md` section T).
- **Contract nodes (0.5):** `extra.contract: "<Menu>"` marks a node that only works in a menu replacement of that contract (the editor refuses it elsewhere); titles start with the menu (`Inventory: Play Sound`) so they never clash with the runtime nodes. Templates use only `_root.inkwellContract.on/send/select/list` (`docs/templates.md`, Contract nodes).
- **No per-frame event.** A custom menu runs `onEnterFrame` about 700 times a second while the game is paused (SPEC-CHANGES V13.4): time comes from `getTimer()` (Get Time) and periodic work from `setInterval` (On Timer, On Update with its measured `delta`).
- **Delay is retriggerable** (a second entry into the same Delay restarts its timer) and Cancel Delay / Stop Timer find timers by `name` or node id; see `docs/templates.md`. Items of Array and Object pins are untyped: nodes carry `valueType` and coerce (`docs/templates.md`, Untyped items).
- **Generated output license:** core pack templates carry Inkwell's non-commercial terms, including the paywall rule. Keep the license notice in the repo.
