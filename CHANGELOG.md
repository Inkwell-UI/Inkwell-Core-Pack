# Changelog

## 0.2.0 (unreleased)

First content: 48 node definitions at major 1 (vertical slice Log, On Widget Call, Set Text, Branch; Events, Flow, Variables, Logic/math/text, Components, editor-only). Runtime events, Data, List, Animation and Game bridge nodes arrive in 0.3.

Added after the first graph widget: Fade (Components; setInterval alpha helper, `then` and `done` outputs) and Throw (Debug; throws `{node, message}`), 50 nodes.

More nodes (branch feat/more-nodes, 88 nodes; Data and Animation pulled forward from 0.3, they need no runtime):
- Data (pure): Array Length, Array Get, Array Push, Array Sort By Field, Make Object, Get Field, Set Field. Push, Sort and Set Field return a new array or object. Items are untyped: Array Get, Array Push, Make Object, Get Field, Set Field and Select have a `valueType` field (String, Number, Bool, Array, Object), their item pins use `typeFrom: "valueType"` and the outputs coerce to that type's default.
- Animation: Tween (alpha, x, y, scale, rotation; linear, easeIn, easeOut, easeInOut; `then` at once, `done` when finished) and Stop Tweens. Fade is unchanged.
- Logic, text and math (pure): Text Length, Substring, Replace, To Upper, To Lower, Split, Join, Round, Floor, Ceil, Abs, Min, Max, Random (volatile, never cached), Select, and the explicit Add, Subtract, Multiply, Divide, Modulo (Arithmetic stays as it was; Divide and Modulo return 0 for a non-finite result like Arithmetic).
- Variables: Toggle (flips a Bool variable), Counter (increment, reset, get; named, shared).
- Components: Get Position (exec, outputs x and y), Get Alpha and Get Visible (pure, volatile), Set Rotation.
- Flow: Cancel Delay, Stop Timer. Debug: Assert (throws `{node, message}` when the condition is false).
- **Changed, Delay@1: retriggerable.** A second entry into the same Delay node clears the pending timer and restarts it, so only the last entry's continuation runs (before, every entry ran). New optional field `name` (timers of the same name share one). A Delay in a For Each body therefore keeps only the last iteration's continuation. Template state is now `__g.dl[<name or node id>]`.
- On Timer@1: new optional `name` field and the timer id is also registered in `__g.tm` for Stop Timer; the timer itself behaves as before.
