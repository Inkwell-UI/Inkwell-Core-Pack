# Writing a node pack

A node pack adds nodes to Inkwell's graph editor without a new editor version. A pack is **data**: JSON node definitions plus AS2 templates. Nothing in a pack runs inside the editor; the templates become AS2 code in the menus that use your nodes. The formats are defined in `inkwell-spec` (`src/pack.ts`).

## Start from the template

`Inkwell-Pack-Template` is a complete pack with one node, `hello/Hello@1` ("Hello, <name>!"), its template, a test and a release workflow.

1. Copy the template into a new GitHub repository.
2. In `manifest.json`, set `id` (lower-case letters, digits, `.`, `_`, `-`; it is the first part of every node id, `<id>/<Kind>@<major>`, and cannot change later), `version` (semver) and `compatible.tool`.
3. Replace `nodes/Hello.json` and `templates/Hello.as2` with your nodes.
4. Run the checks (below), write `CHANGELOG.md`, tag the release.

The id `core` is taken by the bundled core pack. Ask in the Packs Index before you pick an id another pack may use.

## Layout

```
manifest.json            id, version, compatible.tool, dependencies
nodes/<Kind>.json        one node definition per file; the file name is the kind
templates/<Kind>.as2     one AS2 template per node (editor-only nodes have none)
CHANGELOG.md             shown to users before they install or update
test/*.test.mjs          your tests (not shipped)
```

A node definition (`NodeDef`): `kind`, `major`, `title`, `category`, `pure`, `inputs` and `outputs` (pins: `name`, `type`, optional `default`), `fields` (JSON Schema per field), `as2Template` (path inside the pack), optional `requiresRuntime` (the node works only in a custom menu with Inkwell Runtime). Pin types: `Exec`, `Bool`, `Number`, `String`, `Array`, `Object`, and the component types `Text`, `Button`, `List`, `Image`, `Clip`.

## Templates

Read `docs/templates.md` in Inkwell-Core-Pack: placeholders (`{{in.x}}`, `{{out.x}}`, `{{next.x}}`, `{{field.x}}`...), pure nodes (one header line plus one expression), events, errors. The first line of every template is the header `// [{{node.id}}] <packId>/<Kind>@<major>`. The rules that bite most often:

- Skyrim runs Flash 8 AS2: there is no `Error` class and no `flash.filters`.
- Outputs coerce to their pin default; a template never throws past its event handler.
- Pure nodes have no side effects (the compiler caches them).
- No per-frame work: time comes from `getTimer()`, periodic work from `setInterval`.

## Check and test

```
yarn install     # once; the template links ../Inkwell-Core-Pack and ../Inkwell-Spec, checked out next to your pack
yarn validate    # schemas, file names, templates exist, placeholders match the pins
yarn test        # node --test: every template agrees with its node, plus your own render tests
```

`yarn validate` runs Inkwell-Core-Pack's `scripts/validate.mjs`; anyone can run it on any pack folder: `node <Inkwell-Core-Pack>/scripts/validate.mjs <packDir>`. The test renderer in `scripts/lib.mjs` (`render`, `checkTemplate`) is a stand-in for the editor's code generator; the editor's build is the real check, so try your nodes in a project before you release.

## Release

A release is one GitHub release asset named **`pack.zip`** on the tag **`v<version>`**, where `<version>` equals `manifest.json`'s `version`. The zip holds `manifest.json`, `nodes/`, `templates/` and `CHANGELOG.md` at its root (not inside a folder). The editor downloads `https://github.com/<owner>/<repo>/releases/download/v<version>/pack.zip`; it never uses the GitHub API.

The template's workflow (`.github/workflows/release.yml`) does this when you push a tag: it validates, tests, checks that the tag matches the manifest, zips and publishes the release with the asset's SHA-256 in the notes. By hand on Windows: `tar -a -cf pack.zip manifest.json nodes templates CHANGELOG.md`.

Never replace the asset of a published release: projects pin its SHA-256 in `packs.lock` and refuse a download with another hash. Fix a release by publishing a new version.

## Versions and breaking changes

- Semver for every release, one changelog entry per changed node.
- Node identity is `<packId>/<Kind>@<major>`. Changing pins, removing a node or changing what it does is breaking: bump the node's `major` and the pack's major version. Graphs that use the old major show its nodes as unknown until they are rebuilt with the new one. (Two majors of one kind side by side are not possible yet: the validator wants one file per kind, `nodes/<Kind>.json`.)
- A project that lacks your pack keeps your nodes as "Unknown Pack Node (Data Preserved)" with all their data.

## How users get your pack

- **By URL:** in the editor, Assets > Node packs > Add Pack, paste `owner/repo` or the repository URL. The dialog shows the repository, version, content hash (SHA-256), node count and your changelog before anything is installed.
- **From the Packs Index:** open a pull request to `Inkwell-Packs-Index` that adds `{ "id", "repo": "owner/name", "latest": "x.y.z", "description" }` to `index.json` (sorted by id). CI validates it. Bump `latest` with each release. Entries are never removed: a pack that should no longer be used gets `"deprecated": "<reason>"`, so existing projects still resolve their lockfiles.
- **Updates** happen only when a user asks (Check Updates); they see your changelog first.

## Trust

There is no signing in 0.5. Users see where a pack comes from and its hash; publish the SHA-256 (the workflow puts it in the release notes) so they can compare. Packs can only generate AS2 into the author's own menus, but that code runs in their game: keep templates small and readable.
