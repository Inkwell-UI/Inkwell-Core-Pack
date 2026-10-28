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
| `{{args}}` | Call Widget and the function nodes: the data inputs built from `fields.params` (`extra.dynamicInputs`) or, for Function Exit, from the signature outputs (`extra.signatureInputs`), in order, as a comma-separated argument list; an unconnected input holds its type's default |
| `{{fn.<field>}}` | Call Function only: the full AS2 class name of the function graph whose id is in that field (`extra.callsFunction` names the field) |
| `{{exit.<field>}}` | Function Exit only: the name of the signature exit whose id is in that field, as an AS2 identifier |
| `{{exits}}` | Call Function only, alone on its line: one `<exit name>: function(<outputs as typed params>) { try { ... } catch ... }` per entry of `fields.exits` (`extra.dynamicExits`), comma-separated; each body is the guarded continuation of that exit |

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

No exec input. The template is a registration statement that codegen places in the graph class `init()`; the continuation goes inside the handler as `{{guarded.then}}`, so a handler failure is logged with the entry node id and never escapes. Data outputs (On Value Changed `value`, On Item Selected `index`/`item`) are locals declared at the top of the handler. On Widget Call: `fields.name` and `fields.params` (`[{name, type}]`, type String, Number or Bool) define the handler `__g.<name> = function(<params>) {...}` and, later, the Papyrus function. Its data output pins are the params (`extra.dynamicOutputs: "params"`), so the editor derives the pin list from the field. **Call Widget** (exec node, not an entry) is the other way round: `__g.<name>(<args>)` runs that handler of the same graph (`__g` is the graph instance, so a handler in another graph is out of reach). Its `params` field mirrors the handler's and its inputs are `extra.dynamicInputs: "params"`; a parameter named `name` or `params` would read the node's own field as its value, so avoid those two names. The call is guarded by `!= undefined` (a missing handler does nothing at runtime; the editor lint reports it).

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
- **On Update** (0.5): like a repeating On Timer (`setInterval` every `seconds`, registered in `__g.tm` for Stop Timer), plus the output `delta`, the seconds since the previous tick measured with `getTimer()` (`__g.s_<uid>` holds the last tick; the first `delta` counts from the registration). There is **no per-frame event on purpose**: in a custom menu `onEnterFrame` fires about 700 times a second while the game is paused (SPEC-CHANGES V13.4), so frames are neither a clock nor a sane rate. Animate with `delta` (or with Get Time differences), never by counting ticks.
- **Get Time** (0.5, pure, volatile): `getTimer() / 1000`, the seconds since the movie started. Only differences mean anything.
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

## Contract nodes (0.5, node field `contract`)

Nodes with the node field `contract: "<Menu>"` (before pack 0.5.3: `extra.contract`) (category Inventory, titles `Inventory: ...`) talk to the game engine of a **menu replacement** whose IR `target.contract` is that menu (SPEC-CHANGES W5); the editor's graph validation refuses them anywhere else (`contract-node-target`). They need no Inkwell Runtime (`requiresRuntime` is absent).
- **Glue.** The editor generates the replacement glue from the contract files (Editor `src/main/codegen/replacementGlue.ts`) and puts it at `_root.inkwellContract` before any graph starts. Templates use only its three members: `on(callbackName, fn)` registers `fn` for an engine callback (`fn` gets the callback's arguments; several handlers per name are fine), `send(callName, args:Array, respondTo?)` makes an engine call in the `gfx.io.GameDelegate` wire format (`ExternalInterface.call(name, uid, ...args)`), and the engine's `respond(uid, ...)` answer runs the handlers registered for `respondTo`; `select(index)` sets the item list's `selectedIndex` when `index >= 0` (the engine acts on it). `list` is the object `_root.GetInventoryItemList()` returns.
- **Events** are `extra.entry: true` with `extra.contractCallback` (the engine callback name) for readers; the continuation is `guarded`. Request Item Card answers through On Item Card (the `UpdateItemCardInfo` handlers), whether the card comes as the respond answer (seen in S-B) or as the callback.
- **Names** start with the menu (`Inventory: Play Sound`, kind `InventoryPlaySound`) so they never clash with the runtime nodes Play Sound and Close Menu, which go through the Inkwell bridge a replacement does not have.

## Functions (0.5.5)

A function is a graph of its own (Spec `scope: "function"`, `Graph.signature`), compiled to its own class. **Every call creates a new instance**: `new <FnClass>(__g.base, __g, exits).run(args)`, so timers (`__g.dl`), counters and local variables of two calls never meet. `exits` is an object with one closure per exit; Function Exit calls one of them with the output values, now or later (after a Delay, the exit fires when the body finishes). Inside the function `__g` is the instance, `__g.base` the caller's base clip, `__g.exits` the exits object. A function cannot read or write the caller's graph variables: state goes in as parameters and out as outputs; its own variables are locals of one call.
- **Function Entry** (`extra.entry`, `extra.functionEntry`, `extra.signatureOutputs: "inputs"`): one per function graph; codegen emits the continuation inside `run(<inputs>)`. Its data outputs are the signature inputs, named `<uid>_<input name>`.
- **Function Exit** (`extra.signatureInputs: "outputs"`): `__g.exits.<exit>(<outputs>)`. Field `exit` is the exit id. Outputs not wired hold their type's default.
- **Call Function** (`extra.callsFunction`, `dynamicInputs`, `dynamicOutputs`, `dynamicExits`): the signature copy in `inputs`, `outputs`, `exits` fields gives the pins; the data outputs are the parameters of every exit closure, so downstream nodes read them as `<uid>_<output name>`. Pin and exit names must be AS2 identifiers.
