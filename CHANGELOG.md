# Changelog

## Unreleased

**Set Image** (`core/SetImage@1`, template only): the target is hidden until the picture has loaded (`MovieClipLoader`, shown again in `onLoadInit`), so the empty slot no longer shows before the image arrives. Side effects: the target is always made visible after a successful load, and a failed load leaves it hidden. `MovieClipLoader` is used by the editor's image loader already but is unverified in game.

**On Load, On Open, On Close chain** (templates only): several nodes of the same event in one graph all run, in node order; before, the last one replaced the others. Needs the editor that no longer reports `graph-duplicate-handler` for them.

**Set Focus Link, Clear Focus Links** (Components, `core/SetFocusLink@1`, `core/ClearFocusLinks@1`, pack 0.5.6): set or remove where one pad direction (up, down, left, right) goes from an element, so elements made at run time with Create Component join the focus graph. The menu class checks the link on the focused clip before its compiled table; only menus that have a focus graph move focus by the pad (limit: no static graph, no `moveFocus`). Needs the editor that checks `inkwellFocus` in `moveFocus`.

**Inspector text** (new definition key `extra.inspector`, optional; pins, fields and templates are unchanged): `description` (one line under the node's name), `labels` (field or unwired pin name to the label shown), `options` (field name to option value to the label shown). Only the Inspector uses them, never the canvas node; a field without a label shows its name as words (`valueType` becomes "Value type"). Every node now has a `description` (one plain line, from what its template does; Compare also has labels and options). Compare has the first set: "Compare as", "Operator", "First value", "Second value" and "is equal to (==)" style option names.

**Breaking: the math and Inventory nodes left core** (148 nodes become 108). The 25 math nodes (Abs, Acos, Asin, Atan, Atan2, Ceil, Clamp, Cos, Degrees To Radians, Exp, Floor, Lerp, Ln, Log Base, Max, Min, Modulo, Power, Radians To Degrees, Random, Round, Sign, Sin, Sqrt, Tan) are now `mathutils/<Kind>@1` (`Inkwell-UI/Inkwell-MathUtils-Pack`, 0.1.0, which also adds 12 new ones) and the 15 `Inventory:` contract nodes are now `inventory/<Kind>@1` (`Inkwell-UI/Inkwell-Inventory-Pack`, 0.1.0). Pins, fields and templates are unchanged: a graph that used `core/Clamp@1` works again after its nodes are renamed to `mathutils/Clamp@1` (add the pack, then rename the kind in the graph file). Until then the nodes show as Unknown Pack Node (Data Preserved). Add, Subtract, Multiply, Divide, Arithmetic and Compare stay in core.

**Clear Child Components** (Components, `core/ClearChildComponents@1`): removes every instance Create Component added under the `parent` layer, then re-lays out the (now empty) auto-layout parent. Figma-designed children stay. Needs the editor that emits `stackMethods` for this node.

**To String** (`core/ToString@1`): an Object or Array gives its contents instead of `[object Object]`, like `{name: "Bob", tags: [1, 2]}` (strings inside are quoted, nesting stops at depth 7 with `...`; a plain string at the top level stays unquoted). The key order is the runtime's for-in order. Other types are unchanged.

**Make Object** (`core/MakeObject@1`): new field `pairs` (1 to 16, default 4, so existing nodes and wires are unchanged) sets how many key/value pairs it has; the pins `key0`, `value0`, `key1`... follow. The pins come from the new definition key `extra.repeatInputs` (`{count: "<field>", pins: [...]}`, `docs/templates.md`); the template builds the object from `arguments`. An editor older than this shows only the field.

**To String** (`core/ToString@1`): new field `valueType` (default `Number`, so existing graphs are unchanged); the `value` input takes that type (`typeFrom`), so an Object item of For Each or Array Get (a line of text, say) can be wired in. The template is unchanged.

**Parse Int** (Logic, `core/ParseInt@1`, pure): `parseInt(text, radix)`; `radix` defaults to 10. It reads the leading digits and ignores the rest (`"12px"` gives 12, where To Number gives 0), and gives 0 when there are none.

**On Hover** and **On Hover End** (Events, `core/OnHover@1`, `core/OnHoverEnd@1`, `requiresRuntime`): fire when the mouse enters or leaves the target (`onRollOver` / `onRollOut`), independent of focus.

**Get Localized Text** (Components, `core/GetLocalizedText@1`, pure): the translation of a `$KEY` (`key` pin) in the player's language, like Set Text does for a `$KEY`. In a widget (no runtime translator) it gives the key itself. An unwired `$KEY` is a row of the Localization table.

**Tween** (`core/Tween@1`): new `property` values `localX`, `localY` and `localRotation`. `from` and `to` are offsets added to the target's `_x`, `_y` or `_rotation` as it is when the tween starts (so 0 to 100 moves the clip 100 px from where it is). Existing values are unchanged.

## 0.5.5 (143 nodes, 140 with a template)

**On Timer** (`core/OnTimer@1`): clears its previous timer before arming, so running the graph start twice no longer stacks timers that each fire the handler. A tick that arrives before half the period has passed by `getTimer()` is ignored, so a runtime whose setInterval fires early or in bursts cannot run the handler many times in a row.

**Scroll To** and **Get Scroll Position** (Components, `core/ScrollTo@1`, `core/GetScroll@1`): move or read the scroll offset of a frame that scrolls in Figma (Prototype > Overflow behaviour). Scroll To takes `x` and `y` in design px from the start (kept between 0 and the end of the content, only on the axes the frame scrolls); Get Scroll Position gives `x`, `y` and the largest offsets `maxX`, `maxY`. On a layer that does not scroll they do nothing and read 0. Needs an editor that compiles scrolling frames (Spec: IR `overflow`).

**For** (Flow, `core/For@1`): runs `body` once for every index from `first` to `last` (both included, default 0 to 9 = ten runs), with the index as an output, then `completed`. At most 10000 runs. The body is a function per iteration like For Each, so a Delay inside the body keeps its own index.

**Create Component** and **Remove Component** (Components, `core/CreateComponent@1`, `core/RemoveComponent@1`): add and remove a component instance under a layer at runtime. Create Component has a `component` field, a `parent` layer, a `name`, a `props` Object and the new clip as `instance`; new template placeholders `{{comp.x}}` and `{{symbol.x}}`. Needs an editor with component support; older editors show the nodes as unknown pack nodes.

**Get Prop** (Variables, `core/GetProp@1`, pure): reads a prop of the component the graph belongs to. Field `prop` holds the prop id; `propType` and `propName` are copies of the prop's type and name that the editor keeps up to date (the `value` pin takes its type from `propType`, `typeFrom: "propType"`); the template is `__g.props["<name>"]`, so a Create Component `props` Object is keyed by prop name. Only valid in a component graph (Spec `scope: "blueprint"`, `Graph.props`); an editor older than this treats it as an unknown pack node.

Functions (category Functions): **Function Entry** (`core/FunctionEntry@1`), **Function Exit** (`core/FunctionExit@1`) and **Call Function** (`core/CallFunction@1`). A function is its own graph file (Spec: `scope: "function"` with a `signature`, no version bump). Entry and Exit take their pins from the graph's own signature (Entry: the inputs as data outputs; Exit: the outputs as data inputs, plus the `exit` field holding an exit id). Call Function keeps a copy of the signature in its fields (`function`, `inputs`, `outputs`, `exits`) and the editor keeps that copy up to date; it has one exec output per exit and one data output per signature output. New template placeholders `{{exits}}`, `{{fn.<field>}}`, `{{exit.<field>}}` and a wider `{{args}}`: `docs/templates.md`, Functions. Needs an editor that knows functions; older editors show the three nodes as unknown pack nodes and keep their data.

## 0.5.4 (134 nodes, 131 with a template)

Raw AS2 (Debug, `core/RawAS2@1`): exec in, `then` out, one multi-line `code` field written into the graph class verbatim (`{{raw.code}}`; the field pattern accepts any text). It is the home for hand-written ActionScript that has no node of its own (the AS2 importer puts unmatched statements here); the code runs inside the event handler's `try/catch`, so a throw is logged with the entry node id. A syntax error fails the build.

## 0.5.3 (133 nodes, 130 with a template)

The 15 Inventory nodes name their contract in the top-level node field **`contract`** (`"InventoryMenu"`, Spec `NodeDef.contract`, frozen with Spec v1) instead of `extra.contract`. `compatible.tool` is now `^0.5.0` (the editor evaluates it: 0.5.x). Nothing else changes. Editors older than this pack read only `extra.contract` and then no longer restrict these nodes to a menu replacement; this editor reads both.

## 0.5.2 (133 nodes, 130 with a template)

More Inventory contract nodes (Phase 5): Inventory: On Key (`name` field (the key; the handler name the graph checks for duplicates): Up, Down, Left, Right, Enter, Tab, Escape or a letter; fed by the Key listener of the generated replacement glue; keyboard only), Inventory: On Attempt Equip (engine callback `AttemptEquip`, output `slot`) and Inventory: Update Item 3D (`show`).

## 0.5.1 (130 nodes, 127 with a template)

Inventory contract nodes (category Inventory, `extra.contract: "InventoryMenu"`; only usable in a menu replacement whose target contract is `InventoryMenu`, SPEC-CHANGES W5; no Inkwell Runtime needed). They call the replacement glue the editor generates at `_root.inkwellContract` (`docs/templates.md`, Contract nodes).
- Events (engine callbacks): Inventory: On Set Categories (`categories`: `{text, flag, dontHide}` per category), On Invalidate List (`items` = the list's `entryList`, `count`), On Player Info (`info`), On Restore Indices (`indices`), On Drop Item, On Item Card (`info`; the answer to Request Item Card).
- Actions (engine calls): Inventory: Item Select (`index`, `slot`; -1 = keep the current selection / no slot), Item Drop (`index`, `amount` 1), Save Indices (`indices`), Close Menu (`tween`: CloseTweenMenu first), Play Sound (`sound`, default `UIMenuFocus`), Request Item Card (`index`).

## 0.5.0 (118 nodes, 115 with a template)

Get Time (Logic, `core/GetTime@1`, pure and volatile): the seconds since the movie started, from `getTimer()` (milliseconds / 1000). Volatile, so it is never cached: two reads in one run can differ. Use differences of two readings for durations (a clock: store the start time in a variable, subtract it later).

On Update (Events, `core/OnUpdate@1`): a rate-limited event that runs every `seconds` (field, default 0.1, minimum 0.05) from `setInterval`; the output `delta` is the measured time since the previous update in seconds (from `getTimer()`, so a late tick reports its real gap). It is deliberately **not per frame**: in a custom menu `onEnterFrame` fires about 700 times a second while the game is paused (SPEC-CHANGES V13.4), so a frame event would burn the CPU and a frame count is no clock. Optional `name` field: Stop Timer with that name (or the node id) stops the updates, like On Timer.

## 0.4.0 (116 nodes, 113 with a template)

Timer nodes carry editor metadata so the editor can show their progress (preview and Dev Mode): `extra.timer` (the input or field holding the seconds) on Delay, Tween, Fade and On Timer, `extra.timerKey` (the field that names the timer) on Delay and On Timer, `extra.timerRepeat` (the Bool field that makes it tick again) on On Timer, `extra.cancelsTimer` (the field naming the timer to cancel) on Cancel Delay and Stop Timer. Templates and behavior are unchanged.

Call Widget (Events, `core/CallWidget@1`): runs the On Widget Call node of the same graph with the given `name`, so one handler can be reused from other events. Fields `name` and `params` (`[{name, type}]`, copy of the handler's parameters); `params` becomes data inputs (`extra.dynamicInputs`), template placeholder `{{args}}`. Exec in, `then` out; the handler runs synchronously and returns nothing. The editor lints a missing handler, differing parameter types and a call that leads back into its own handler (`graph-widget-call`).

Format Number gains the field `digits` (listed above `decimals`, 0..6, default 0): it pads the whole-number part with leading zeros, so 9.3 with `decimals` 0 and `digits` 2 gives `09` (clocks, `mm:ss`). The default changes nothing; a negative number keeps its sign in front of the padding.

Math nodes (pure, Logic; a non-finite result is 0 like Divide): Sin, Cos, Tan, Asin, Acos, Atan, Atan2 (y, x), Sqrt, Power, Exp, Ln, Log Base (value, base), Degrees To Radians, Radians To Degrees, Sign. Angles are in radians.

## 0.3.0 (100 nodes, 97 with a template)

Runtime nodes (all `requiresRuntime: true`; they work only in a custom menu served by Inkwell Runtime, `compatible.runtimeApi` `>=0.3.0`):
- Events: On Mod Event (`name` field; outputs `strArg`, `numArg`) and On Runtime Message (`name` field, empty = any; outputs `name`, `text`, `number`, `flag`). The existing menu events On Open, On Close, On Click, On Focus, On Blur, On Value Changed, On Item Selected and On Input now carry `requiresRuntime` (17 nodes have `requiresRuntime: true`; the three List nodes say false).
- Game bridge: Send Mod Event, Call Runtime, Open Menu, Close Menu, Play Sound, Get Setting (pure, returns a String), Get Input Device (exec node: S8 says pure, but the template format allows one output on a pure node; documented in `docs/templates.md`).
- List: Set Items, Get Selected (exec node, same reason), Refresh; the list component itself is generated by the Editor (`mods.<modId>.InkwellList`).
- Set Variable and Toggle carry `extra.writesVariable`; the Editor emits `getSaved`/`setSaved` for variables of scope `saved` (nothing changes in the templates).

## 0.2.0

First content: 48 node definitions at major 1 (vertical slice Log, On Widget Call, Set Text, Branch; Events, Flow, Variables, Logic/math/text, Components, editor-only). Runtime events, Data, List, Animation and Game bridge nodes arrive in 0.3.

Added after the first graph widget: Fade (Components; setInterval alpha helper, `then` and `done` outputs) and Throw (Debug; throws `{node, message}`), 50 nodes.

More nodes (88 nodes at that point; Data and Animation pulled forward from 0.3, they need no runtime):
- Data (pure): Array Length, Array Get, Array Push, Array Sort By Field, Make Object, Get Field, Set Field. Push, Sort and Set Field return a new array or object. Items are untyped: Array Get, Array Push, Make Object, Get Field, Set Field and Select have a `valueType` field (String, Number, Bool, Array, Object), their item pins use `typeFrom: "valueType"` and the outputs coerce to that type's default.
- Animation: Tween (alpha, x, y, scale, rotation; linear, easeIn, easeOut, easeInOut; `then` at once, `done` when finished) and Stop Tweens. Fade is unchanged.
- Logic, text and math (pure): Text Length, Substring, Replace, To Upper, To Lower, Split, Join, Round, Floor, Ceil, Abs, Min, Max, Random (volatile, never cached), Select, and the explicit Add, Subtract, Multiply, Divide, Modulo (Arithmetic stays as it was; Divide and Modulo return 0 for a non-finite result like Arithmetic).
- Variables: Toggle (flips a Bool variable), Counter (increment, reset, get; named, shared).
- Components: Get Position (exec, outputs x and y), Get Alpha and Get Visible (pure, volatile), Set Rotation.
- Flow: Cancel Delay, Stop Timer. Debug: Assert (throws `{node, message}` when the condition is false).
- **Changed, Delay@1: retriggerable.** A second entry into the same Delay node clears the pending timer and restarts it, so only the last entry's continuation runs (before, every entry ran). New optional field `name` (timers of the same name share one). A Delay in a For Each body therefore keeps only the last iteration's continuation. Template state is now `__g.dl[<name or node id>]`.
- On Timer@1: new optional `name` field and the timer id is also registered in `__g.tm` for Stop Timer; the timer itself behaves as before.
