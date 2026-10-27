#!/usr/bin/env node
// Validates a pack folder (default: this repo): `node scripts/validate.mjs [packDir]`, or `inkwell-pack-validate [packDir]` from a pack
// that has this package as a dev dependency (docs/packs.md). Schemas, template files exist, placeholders match pins.
import fs from "node:fs";
import path from "node:path";
import { loadPack, checkTemplate, root } from "./lib.mjs";

const dir = path.resolve(process.argv[2] ?? root);
let bad = 0;
const fail = (m) => { bad++; console.error("FAIL " + m); };
let pack;
try {
  pack = loadPack(dir);
} catch (e) {
  console.error(`FAIL ${dir}: ${e.message}`); // a schema error lists the Zod issues
  process.exit(1);
}
const { manifest, nodes } = pack;
const seen = new Set();
for (const n of nodes) {
  if (n.file !== `${n.def.kind}.json`) fail(`${n.file}: file name must be <kind>.json`);
  if (seen.has(n.id)) fail(`${n.id}: duplicate`);
  seen.add(n.id);
  const editorOnly = n.def.extra?.editorOnly;
  if (n.def.as2Template && !n.text) fail(`${n.id}: as2Template ${n.def.as2Template} does not exist`);
  if (n.def.as2Template && !path.resolve(dir, n.def.as2Template).startsWith(dir + path.sep)) fail(`${n.id}: as2Template leaves the pack folder`);
  if (!n.def.as2Template && !editorOnly) fail(`${n.id}: no as2Template (only editor-only nodes may omit it)`);
  if (n.def.as2Template && editorOnly) fail(`${n.id}: editor-only nodes have no template`);
  if (n.text) for (const e of checkTemplate(n.def, n.text, manifest.id)) fail(`${n.id}: ${e}`);
}
const used = new Set(nodes.flatMap((n) => (n.def.as2Template ? [path.resolve(dir, n.def.as2Template)] : [])));
const tdir = path.join(dir, "templates");
for (const f of fs.existsSync(tdir) ? fs.readdirSync(tdir) : []) if (!used.has(path.join(tdir, f))) fail(`templates/${f}: no node definition uses it`);
console.log(`${manifest.id}@${manifest.version}: ${nodes.length} nodes, ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
