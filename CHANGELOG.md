# Changelog

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
