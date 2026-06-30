import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const rulesCode = fs.readFileSync(new URL("../src/rules.js", import.meta.url), "utf8");
const context = {
  window: {}
};

vm.createContext(context);
vm.runInContext(rulesCode, context);

const text = [
  "The renewal fee is $4,800 and payment is due by Friday.",
  "A late fee of $250 applies.",
  "Please sign the approval today.",
  "The implementation owner is TBD.",
  "Following up, can you review this today?"
].join(" ");

const signals = context.window.inboxSignalRules.findSignals(text);
const summary = context.window.inboxSignalRules.summarizeSignals(text, signals);

assert(signals.some((signal) => signal.label === "Money" && signal.text === "$4,800"));
assert(signals.some((signal) => signal.label === "Penalty" && signal.text === "late fee"));
assert(signals.some((signal) => signal.label === "Required action" && /please sign/i.test(signal.text)));
assert(signals.some((signal) => signal.label === "Follow up request" && /following up|can you/i.test(signal.text)));
assert.equal(summary.summary, "Money due: $4,800 by Friday");
assert(summary.actions.some((item) => /Calendar or confirm Friday/.test(item)));

console.log("Local rule smoke test passed");
