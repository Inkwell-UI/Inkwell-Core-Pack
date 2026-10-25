import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadPack, render, checkTemplate, root } from "../scripts/lib.mjs";

const withTpl = loadPack().nodes.filter((n) => n.text);

test("every template agrees with its pins and fields", () => {
  for (const n of withTpl) assert.deepEqual(checkTemplate(n.def, n.text), [], n.id);
});

test("rendered templates match the snapshot (UPDATE=1 rewrites it)", () => {
  const got = withTpl.map((n) => `===== ${n.id}${n.def.pure ? " (pure)" : ""}\n${render(n.def, n.text).trimEnd()}\n`).join("\n");
  assert.ok(!/\{\{/.test(got), "unreplaced placeholder");
  const snap = path.join(root, "test", "rendered.snap.as2");
  if (process.env.UPDATE || !fs.existsSync(snap)) fs.writeFileSync(snap, got);
  assert.equal(got, fs.readFileSync(snap, "utf8").replace(/\r\n/g, "\n"));
});
