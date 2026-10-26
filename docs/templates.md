# AS2 template format

One template per node: `templates/<Kind>.as2`, referenced by `as2Template` in `nodes/<Kind>.json`. The editor's codegen (Phase 5, `Inkwell-Editor`) renders them. `scripts/lib.mjs` has a deliberately minimal renderer that only exists to test templates against their pins; it is not the real one.

Target is Flash 8 AS2 as Skyrim's GFx runs it: no `Error` class, no `flash.filters`, `try/catch` works.

## File shape

Line 1 is always the header `// [{{node.id}}] core/<Kind>@<major>`. The rest is the body. Codegen keeps the header as a comment above the node's code and uses it for the source map. A node with no template (Comment, Reroute, Group) is editor-only and omits `as2Template`.

## Placeholders

Syntax `{{kind.name}}` (or `{{params}}`). Never write two `{` in a row anywhere else in a template.

| Placeholder | Becomes |
| --- | --- |
| `{{node.id}}` | the graph node id, as text (comments and strings only) |
| `{{node.uid}}` | the id made identifier-safe; use it to build unique locals and member names |
| `{{in.<pin>}}` | the expression feeding data input `<pin>`: an inlined pure expression, a temp name, or the pin default literal when unconnected |
| `{{out.<pin>}}` | the name codegen chose for data output `<pin>` (a local, or a function parameter in event and loop templates). Exec nodes declare it or receive it as a parameter |
| `{{field.<name>}}` | the node field rendered as an AS2 literal (strings quoted and escaped) |
| `{{raw.<name>}}` | the field verbatim, for enum or pattern-constrained fields only (operators, handler names) |
| `{{var.<field>}}` | the AS2 lvalue (`__g.v_<name>`) of the graph variable whose id is in that field |
| `{{next.<execOut>}}` | the statements that follow exec output `<execOut>` |
| `{{guarded.<execOut>}}` | the same statements wrapped in `try { ... } catch (e) { __g.fail("<entry node id>", e); }` |
| `{{params}}` | On Widget Call only: the typed parameter list built from `fields.params` |

Rules:
- Every exec output pin appears exactly once, as `next` or `guarded`, on its own line. Codegen re-indents the multi-line substitution to that line's indentation. An exec output with no wire renders as nothing.
- Every data input is used at least once; every data output of a non-pure node is produced (`{{out.x}}` appears).
- **A repeated `{{in.x}}` is allowed; codegen then hoists any non-atomic input expression into a temp** so it is evaluated once. Input expressions are always safe to embed without extra parentheses by the template (codegen parenthesizes non-atomic ones).
- Inputs arrive already coerced to the pin type (`pinCompat` in `inkwell-spec`) and, if unconnected, hold the pin default.
- **Outputs coerce inside the template** to the pin default: `Number(x) || 0`, `x == undefined ? "" : String(x)`. Codegen does not add a second coercion.
- The generated graph class is `dynamic`. Inside every handler and method codegen emits `var __g = this;` first, so templates always refer to the graph instance as `__g` (also inside closures, where `this` is something else). Per-node state lives on `__g` under `s_<uid>`, `t_<uid>`, `h_<uid>`.
- `__g` provides `fail(nodeId, e)` (logs the failing node id; accepts a string or a plain object with `node` and `message`) and `addInputHandler(action, fn)` (On Input). Both come from the generated base, not from templates.

## Pure nodes: inline or temp

`pure: true` means no side effects and no exec pins. The template body is exactly one AS2 expression on the line after the header, with a single data output named `value` (Reroute excepted, editor-only). Codegen:
- inlines it, wrapped in parentheses unless atomic, when the output feeds one consumer, or
- emits `var <temp> = <expr>;` before the first consumer when it feeds several, cached per dependency scope (once per event run, or once per loop iteration if it depends on `{{out.item}}` or `{{out.index}}` of a loop).
- A node with `extra.volatile: true` (Get Variable, Get Text, Get Alpha, Get Visible, Random) reads mutable state or a different value on every evaluation and is never cached: it is always inlined, so it sees writes made earlier in the same run (and two Random consumers get two numbers). Counter and Get Position are exec nodes, so their values are locals of the run, not pure reads.
- Pure nodes that need statements (Array Push, Sort By Field, Make Object, Set Field, Random, Join) wrap them in one function expression called as a method of an object literal, `({ f: function(a, b) { ... } }).f(<inputs>)` (not `(function(a, b) {...})(x, y)`: FFDec's AS2 compiler turns a direct call of a function expression into a call that returns `undefined`, seen in Ruffle). Array Push, Set Field and Sort By Field return a **new** array or object: the input is never changed.

## Events (entry nodes, `extra.entry: true`)

No exec input. The template is a registration statement that codegen places in the graph class `init()`; the continuation goes inside the handler as `{{guarded.then}}`, so a handler failure is logged with the entry node id and never escapes. Data outputs (On Value Changed `value`, On Item Selected `index`/`item`) are locals declared at the top of the handler. On Widget Call: `fields.name` and `fields.params` (`[{name, type}]`, type String, Number or Bool) define the handler `__g.<name> = function(<params>) {...}` and, later, the Papyrus function. Its data output pins are the params (`extra.dynamicOutputs: "params"`), so the editor derives the pin list from the field.

## Dynamic pin types

AS2 pins have static types in the definition. Where a pin's type depends on a field, the pin carries `typeFrom: "<field>"`: the field value is a pin type name (`kind`: component kind, `valueType`: Compare operand type) or, for Get/Set Variable, the id of a graph variable whose type is used. `type` is the fallback. Reroute uses `typeFrom: "connection"` (type follows the wire).

## Untyped items (Array and Object)

Pin types are static, and Array and Object items have no type. Instead of a new pin type, nodes that touch an item (Array Get, Array Push, Make Object, Get Field, Set Field, Select) carry the field `valueType` (`String`, `Number`, `Bool`, `Array`, `Object`) and the item pins use `typeFrom: "valueType"` (the same mechanism as Compare). Outputs coerce to that type's default inside the template (Array Get and Get Field: `Number(v) || 0`, `v == true || v == "true"`, an Array or Object check, else `""`), so a missing index or key gives `0`, `false`, `[]`, `{}` or `""`, never `undefined`. A wire into such a pin is checked with `pinCompat` against the chosen `valueType`. To read two types out of one object, use two Get Field nodes with different `valueType`s. Make Object has four key/value pairs (an empty key is skipped) of one `valueType`; add more fields of other types with Set Field.

## Control flow and asynchrony

Everything is synchronous except Delay and the timers.
- **Sequence**: its pins are emitted one after the other, `then0` to `then3`. If a branch contains a Delay, the next pin does not wait for it.
- **For Each**: Flash 8 has no block scope and `for` shares one set of locals, so the body is a closure that receives the element: `var body = function(item, index) {...}; for (...) body(arr[i], i);`. Each call gets its own scope, so a Delay inside the body captures its own `item`. `completed` runs right after the loop has started all iterations (it does not wait for delayed work in the body).
- **Delay** (retriggerable): the timer id lives in `__g.dl[<key>]`, the key being the node's `name` field or, when empty, its node id. Entering the same Delay node again **clears the pending timer and restarts it**, so only the last entry's continuation runs (the earlier ones are dropped). The continuation is `guarded` because it runs outside the original handler's `try/catch`. Consequences: a Delay inside a For Each body keeps only the last iteration's continuation (use Sequence or a Counter to fan out, or give the loop no Delay); two Delay nodes with the same `name` share one timer; Cancel Delay (`name` = that name or node id) clears it without running the continuation. Before 0.2 was released a Delay could not be cancelled and every entry ran its own continuation; this is the one semantic change of the more-nodes branch.
- **On Timer**: `__g.t_<uid> = setInterval(...)`, cleared by the handler itself when `repeat` is false. The id is also registered as `__g.tm[<key>]` (the optional `name` field or the node id) so that Stop Timer can clear it; behavior of the timer is unchanged.
- **Fade** (Components, kept as is; it is not re-expressed on Tween because Tween keeps its timers in a registry that Stop Tweens clears, and changing Fade's per-node restart behavior would be a semantic change): sets the target's `_alpha` to `from`, then a `setInterval` (33 ms) moves it linearly to `to` over `seconds` using `getTimer()` (frame-rate independent). `then` runs at once, `done` (guarded) when the fade has reached `to`; use `done` to chain Delay or a second Fade. The timer id is per node (`__g.t_<uid>`): running the same Fade node again restarts it, two Fade nodes on one target do not cancel each other. Alpha is 0..100.
- **Throw** (Debug): `throw {node, message}`; the handler's `try/catch` logs the node id and the handler stops there. For checking error handling in game.
- **Tween** (Animation): moves `alpha`, `x`, `y`, `scale` (both axes) or `rotation` of the target from `from` to `to` in `seconds` with `linear`, `easeIn` (k*k), `easeOut` or `easeInOut`, from a `setInterval` (33 ms) driven by `getTimer()`. It sets `from` at once; `then` runs immediately, `done` (guarded) when the value has reached `to`. Running tweens are records `{t: target, p: property, id}` in `__g.tw`; a new Tween on the same target and property replaces the running one (no `done` for the replaced one). **Stop Tweens** clears every Tween of the target (no `done`); it does not touch Fade.
- **Counter** (Variables): an integer-like count in `__g.ctr[<name>]` (nodes with the same `name` share it), `action` increment (adds `by`), reset (to 0) or get; the new value is the `value` output (a local of the run). **Toggle** flips a Bool graph variable and outputs the new value.
- **Assert** (Debug): when `condition` is false it throws `{node, message: "Assert failed: <message>"}` like Throw, otherwise `then` runs.
- **Do Once**: a flag on `__g`, no reset in 0.2.

`setInterval` and closures are expected to work in GFx but are not yet checked in game (PLAN-0.2 section 7).

## Errors

Handlers are wrapped by `guarded`. If a template has to fail on purpose it throws a string or a plain object, `throw {node: "{{node.id}}", message: "..."};`, never `Error`. Flash 8 mostly continues silently after runtime errors, so templates guard inputs (`|| 0`, `isFinite`, `== undefined`) instead of relying on exceptions.

## Tests

`yarn validate` loads the manifest and every node through the Spec schemas and runs the placeholder checks. `yarn test` also renders every template with fixture inputs and compares to `test/rendered.snap.as2` (`UPDATE=1 yarn test` rewrites it; review the diff). Compiling the output with FFDec is a Phase 5 integration test in the editor.

## Runtime nodes (0.3, `requiresRuntime: true`)

Nodes with `requiresRuntime` work only in a custom menu served by Inkwell Runtime (SPEC-CHANGES S7, S8); the lint `runtime-required` warns in a HUD widget. 0.3 adds On Mod Event, On Runtime Message, Send Mod Event, Call Runtime, Open Menu, Close Menu, Play Sound, Get Setting, Get Input Device and sets the flag on On Open, On Close, On Click, On Focus, On Blur, On Value Changed, On Item Selected and On Input.
- **Bridge.** Templates call `__g.bridge.<member>(...)` (S4.2). The menu flavour of the graph class has `bridge`; when the runtime is missing it is the stub object whose members are no-ops, so no template guards for it. Results are coerced (`== true`, `String(...)` with `undefined` to `""`). Never call `_root.inkwell` directly.
- **Runtime events** register through `__g.addModEventHandler(name, fn)` (`fn(strArg, numArg)`, exact name match) and `__g.addMessageHandler(name, fn)` (`fn(name, text, number, flag)`; empty `name` = any); the continuation is `guarded`.
- **Multiple outputs are exec nodes.** Get Selected (`index`, `item`, `found`) and Get Input Device (`device`, `gamepad`) have several data outputs, which a pure node cannot (one expression, one `value`). S8 lists them as pure; they are exec nodes (with `in` and `then`) until codegen supports multi-output pure nodes. Get Setting has one output and is pure.
- **List contract** (the basic list component, Editor Phase 5b, class `mods.<modId>.InkwellList`): `setItems(items:Array)`, `refresh()`, `getSelectedIndex():Number` (-1 none), `getItem(i):Object` (undefined when out of range), event `change` with `target.value` = highlighted index, event `itemClick` with `index` and `data`. On Value Changed / On Item Selected keep their 0.2 templates (O9: highlight versus activate is the component's job).
- **Saved variables (S5), done in the Editor (`docs/menus.md` there).** `{{var.x}}` is always `__g.v_<name>` and a template cannot see the variable's scope, so templates cannot switch to `getSaved`/`setSaved`. Set Variable and Toggle carry `extra.writesVariable: "variable"` (the field holding the variable id). The codegen does this (kept here as the contract): when a node has `extra.writesVariable` and the variable it names has scope `saved`, append `__g.bridge.setSaved("<name>", __g.v_<name>);` right after the node's assignment, before the `{{next}}` continuation (the whole filled body up to the `then` statements); and the menu graph `init()` emits `__g.v_<name> = __g.bridge.getSaved("<name>", <default>);` (type-checked, S5.4). Counter in this pack counts in named `__g.ctr` slots, not in a variable, so it needs nothing.
