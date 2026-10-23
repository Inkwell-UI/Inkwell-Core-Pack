# Inkwell Core Pack

The core visual-scripting nodes for Inkwell, released on its own schedule. The full design is in `Inkwell Design Spec.md` (workspace root), sections "Visual scripting" and "Node packs"; read them before adding or changing nodes. Where this file and the spec disagree, the spec wins; fix this file.

## Contents

`manifest.json`, node definitions in JSON (fields in JSON Schema), AS2 templates per node, optional `.as` class files. The manifest format comes from `inkwell-spec`.

## Rules that are easy to break

- **No JavaScript, ever.** Packs are declarative data plus AS2 templates.
- **Node identity is `packId/nodeKind@major`.** Changing pins, removing a node or changing semantics is breaking: bump the major and keep the old major until projects can migrate.
- **Semver for every release,** with a changelog entry per changed node; the editor shows it in "Update packs".
- **Templates generate readable AS2:** namespaced classes (`mods.<modId>.*`), no global names, source-mapped to the node.
- **Templates target Flash 8 AS2 as Skyrim's GFx runs it:** there is no `Error` class (throw strings or plain objects carrying the node ID) and no AS2 runtime `flash.filters`.
- **Outputs coerce to pin defaults** (`undefined` Number → `0`, String → `""`); templates must never throw past the event handler's `try/catch`.
- **Pure nodes must be side-effect free,** since the compiler caches them per dependency scope.
- **Milestones:** 0.2 ships events, flow, variables, logic/text, components and Log; data, list, animation and game-bridge nodes come in 0.3 with the runtime.
- **Generated output license:** core pack templates carry Inkwell's non-commercial terms, including the paywall rule. Keep the license notice in the repo.
