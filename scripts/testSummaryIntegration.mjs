import assert from "node:assert/strict";
import fs from "node:fs";

const content = fs.readFileSync(new URL("../src/content.js", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

assert(content.includes('const summaryClass = "grhSummaryCell";'));
assert(content.includes("function addRowSummary"));
assert(content.includes("window.inboxSignalRules.summarizeSignals"));
assert(content.includes("row.appendChild(cell);"));
assert(content.includes("document.createElement(row.tagName === \"TR\" ? \"td\" : \"div\")"));
assert(content.includes('element.closest("." + summaryClass)'));
assert(content.includes('document.querySelectorAll("." + summaryClass)'));

assert(styles.includes(".grhSummaryCell"));
assert(styles.includes("width: 260px;"));
assert(styles.includes(".grhSummaryLine"));
assert(styles.includes(".grhActionList"));

console.log("Summary integration guard passed");
