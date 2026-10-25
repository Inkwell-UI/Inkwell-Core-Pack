import fs from "node:fs";
import { loadPack, checkTemplate } from "./lib.mjs";

let bad = 0;
const fail = (m) => { bad++; console.error("FAIL " + m); };
const { manifest, nodes } = loadPack(); // throws with the Zod issue list on a schema error
const seen = new Set();
for (const n of nodes) {
  if (n.file !== `${n.def.kind}.json`) fail(`${n.file}: file name must be <kind>.json`);
  if (seen.has(n.id)) fail(`${n.id}: duplicate`);
  seen.add(n.id);
  const editorOnly = n.def.extra?.editorOnly;
  if (n.def.as2Template && !n.text) fail(`${n.id}: as2Template ${n.def.as2Template} does not exist`);
  if (!n.def.as2Template && !editorOnly) fail(`${n.id}: no as2Template (only editor-only nodes may omit it)`);
  if (n.def.as2Template && editorOnly) fail(`${n.id}: editor-only nodes have no template`);
  if (n.text) for (const e of checkTemplate(n.def, n.text)) fail(`${n.id}: ${e}`);
}
for (const f of fs.readdirSync("templates")) if (!seen.has(`${manifest.id}/${f.replace(/\.as2$/, "")}@1`)) fail(`templates/${f}: no node definition uses it`);
console.log(`${manifest.id}@${manifest.version}: ${nodes.length} nodes, ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
