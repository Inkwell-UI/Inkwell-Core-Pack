// Pack loading plus the minimal template renderer used by tests. The real renderer lives in the editor (codegen, Phase 5);
// this one only checks that templates and pins agree. Format: docs/templates.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PackManifest, NodeDef } from "@inkwell-ui/spec";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Loads manifest and every node definition through the Spec schemas. Throws on the first schema error. */
export function loadPack(dir = root) {
  const manifest = PackManifest.parse(JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")));
  const nodes = fs.readdirSync(path.join(dir, "nodes")).filter((f) => f.endsWith(".json")).sort().map((file) => {
    let def;
    try { def = NodeDef.parse(JSON.parse(fs.readFileSync(path.join(dir, "nodes", file), "utf8"))); } catch (e) { throw new Error(`nodes/${file}: ${e.message}`); }
    const template = def.as2Template ? path.join(dir, def.as2Template) : undefined;
    const text = template && fs.existsSync(template) ? fs.readFileSync(template, "utf8").replace(/\r\n/g, "\n") : undefined;
    return { file, def, id: `${manifest.id}/${def.kind}@${def.major}`, template, text };
  });
  return { manifest, nodes };
}

const PH = /\{\{(\w+)(?:\.(\w+))?\}\}/g;
const AS2_TYPE = { String: "String", Number: "Number", Bool: "Boolean", Array: "Array", Object: "Object" };

export const placeholders = (text) => [...text.matchAll(PH)].map((m) => ({ kind: m[1], name: m[2] }));

/** Dynamic output pins (On Widget Call params) come from the field named by def.extra.dynamicOutputs. */
const dynOut = (def, fields) => (def.extra?.dynamicOutputs ? fields[def.extra.dynamicOutputs] ?? [] : []);

/** Dynamic input pins (Call Widget args) come from the field named by def.extra.dynamicInputs. */
const dynIn = (def, fields) => (def.extra?.dynamicInputs ? fields[def.extra.dynamicInputs] ?? [] : []);

/** A function signature for fixtures: Function Entry / Exit take their pins from the graph's signature, not from a field. */
export const FIXTURE_SIGNATURE = {
  inputs: [{ id: "i1", name: "title", type: "String" }],
  outputs: [{ id: "o1", name: "count", type: "Number" }],
  exits: [{ id: "x1", name: "Done" }, { id: "x2", name: "Failed" }],
};

/** Data inputs of Function Exit come from the signature list named by def.extra.signatureInputs. */
const sigIn = (def) => (def.extra?.signatureInputs ? FIXTURE_SIGNATURE[def.extra.signatureInputs] ?? [] : []);

export function fixtureFields(def) {
  const f = {};
  for (const [k, s] of Object.entries(def.fields)) f[k] = s.default ?? s.enum?.[0] ?? (s.type === "number" || s.type === "integer" ? 0 : s.type === "boolean" ? false : "");
  if (def.kind === "OnWidgetCall" || def.kind === "CallWidget") f.params = [{ name: "title", type: "String" }, { name: "hold", type: "Number" }];
  if (def.kind === "CallFunction") Object.assign(f, { function: "Greet", ...structuredClone(FIXTURE_SIGNATURE) });
  if (def.kind === "FunctionExit") f.exit = "x1";
  return f;
}

/** Renders with fixture inputs: inputs become IN_<pin>, outputs become n1_<pin>, continuations become marker comments. */
export function render(def, text, fields = fixtureFields(def)) {
  const uid = "n1";
  const body = text.split("\n").map((line) => {
    const exitsLine = line.match(/^(\s*)\{\{exits\}\}\s*$/);
    if (exitsLine) {
      const ind = exitsLine[1];
      const outs = dynOut(def, fields).map((p) => `${uid}_${p.name}:${AS2_TYPE[p.type]}`).join(", ");
      return (fields[def.extra.dynamicExits] ?? []).map((x) => [
        `${ind}${x.name}: function(${outs}) {`,
        `${ind}    try {`,
        `${ind}        /* next:${x.name} */`,
        `${ind}    } catch (e) {`,
        `${ind}        __g.fail("n0", e);`,
        `${ind}    }`,
        `${ind}}`
      ].join("\n")).join(",\n");
    }
    const own = line.match(/^(\s*)\{\{(next|guarded)\.(\w+)\}\}\s*$/);
    if (!own) return line;
    const [, ind, k, name] = own;
    const marker = `/* next:${name} */`;
    return k === "next" ? `${ind}${marker}` : `${ind}try {\n${ind}    ${marker}\n${ind}} catch (e) {\n${ind}    __g.fail("n0", e);\n${ind}}`;
  }).join("\n");
  return body.replace(PH, (_, k, name) => {
    switch (k) {
      case "node": return name === "id" ? "n1" : uid;
      case "in": return `IN_${name}`;
      case "out": return `${uid}_${name}`;
      case "field": return JSON.stringify(fields[name]);
      case "raw": return String(fields[name]);
      case "var": return `__g.v_${fields[name] || "x"}`;
      case "params": return dynOut(def, fields).map((p) => `${uid}_${p.name}:${AS2_TYPE[p.type]}`).join(", ");
      case "args": return [...dynIn(def, fields), ...sigIn(def)].map((p) => `IN_${p.name}`).join(", ");
      case "fn": return `mods.Test.Fn_${fields[name]}`;
      case "exit": return (FIXTURE_SIGNATURE.exits.find((x) => x.id === fields[name]) ?? FIXTURE_SIGNATURE.exits[0]).name;
      default: throw new Error(`unknown placeholder {{${k}${name ? "." + name : ""}}}`);
    }
  });
}

/** Static checks that a template agrees with its definition. Returns a list of problems. */
export function checkTemplate(def, text, packId = "core") {
  const errs = [];
  const fields = fixtureFields(def);
  const ph = placeholders(text);
  const pins = (list, exec) => list.filter((p) => (p.type === "Exec") === exec).map((p) => p.name);
  const dyn = dynOut(def, fields).map((p) => p.name);
  const count = (k, n) => ph.filter((p) => p.kind === k && p.name === n).length;
  const first = text.split("\n")[0];
  if (first !== `// [{{node.id}}] ${packId}/${def.kind}@${def.major}`) errs.push(`first line must be the header '// [{{node.id}}] ${packId}/<Kind>@<major>'`);
  for (const p of ph) {
    const bad = (m) => errs.push(`{{${p.kind}${p.name ? "." + p.name : ""}}}: ${m}`);
    if (p.kind === "in" && !pins(def.inputs, false).includes(p.name)) bad("no such data input");
    else if (p.kind === "out" && !pins(def.outputs, false).includes(p.name) && !dyn.includes(p.name)) bad("no such data output");
    else if ((p.kind === "next" || p.kind === "guarded") && !pins(def.outputs, true).includes(p.name)) bad("no such exec output");
    else if (["field", "raw", "var"].includes(p.kind) && !(p.name in def.fields)) bad("no such field");
    else if (p.kind === "params" && !def.extra?.dynamicOutputs) bad("needs extra.dynamicOutputs");
    else if (p.kind === "args" && !def.extra?.dynamicInputs && !def.extra?.signatureInputs) bad("needs extra.dynamicInputs or extra.signatureInputs");
    else if (p.kind === "fn" && (def.extra?.callsFunction !== p.name || !(p.name in def.fields))) bad("needs extra.callsFunction naming this field");
    else if (p.kind === "exit" && (!def.extra?.signatureInputs || !(p.name in def.fields))) bad("needs extra.signatureInputs and the field");
    else if (p.kind === "exits" && !def.extra?.dynamicExits) bad("needs extra.dynamicExits");
    else if (!["node", "in", "out", "next", "guarded", "field", "raw", "var", "params", "args", "fn", "exit", "exits"].includes(p.kind)) bad("unknown placeholder kind");
  }
  if (def.extra?.dynamicExits) {
    if (ph.filter((p) => p.kind === "exits").length !== 1) errs.push("{{exits}} must be placed exactly once");
    if (!text.split("\n").some((l) => /^\s*\{\{exits\}\}\s*$/.test(l))) errs.push("{{exits}} must be alone on its line");
  }
  for (const n of pins(def.inputs, false)) if (!count("in", n)) errs.push(`data input '${n}' is never used`);
  for (const n of pins(def.outputs, true)) if (count("next", n) + count("guarded", n) !== 1) errs.push(`exec output '${n}' must be placed exactly once`);
  if (def.pure) {
    if (ph.some((p) => ["out", "next", "guarded"].includes(p.kind))) errs.push("pure template is one expression: no {{out}}, {{next}} or {{guarded}}");
    if (text.trimEnd().split("\n").length !== 2) errs.push("pure template must be a header plus a single expression line");
  } else {
    for (const n of pins(def.outputs, false)) if (!count("out", n)) errs.push(`data output '${n}' is never produced`);
  }
  if (/\bnew\s+Error\b|\bError\s*\(|flash\.filters/.test(text)) errs.push("Error class and flash.filters do not exist in Skyrim's GFx");
  return errs;
}
