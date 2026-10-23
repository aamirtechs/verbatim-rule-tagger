"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../src/logic.js");

const COMMENTS = [
  { id: "1", text: "Delivery was fast but the box arrived damaged" },
  { id: "2", text: "I was charged twice for the same order, need a refund" },
  { id: "3", text: "Support agent was quick and helpful" },
  { id: "4", text: "Charged twice and still no delivery" },
  { id: "5", text: "Everything was fine, no complaints" }
];

test("parseRecords reads id and text columns by header name", () => {
  const { records, errors } = L.parseRecords("id,comment\n1,\"Fast, friendly service\"\n2,Slow delivery\n");
  assert.equal(records.length, 2);
  assert.equal(records[0].text, "Fast, friendly service");
  assert.equal(errors.length, 0);
});

test("parseRule parses any, all and not keyword groups", () => {
  const r = L.parseRule("Billing = all: charged, twice | not: refund", 1);
  assert.deepEqual(r.all, ["charged", "twice"]);
  assert.deepEqual(r.not, ["refund"]);
  const r2 = L.parseRule("Speed = any: fast, quick", 2);
  assert.deepEqual(r2.any, ["fast", "quick"]);
});

test("parseRules reports a malformed line instead of throwing", () => {
  const { rules, errors } = L.parseRules("Good = any: fast\nno equals sign here");
  assert.equal(rules.length, 1);
  assert.equal(errors.length, 1);
});

test("invalid regex is reported as a rule error", () => {
  const { rules, errors } = L.parseRules("Broken = regex: /([a-z/");
  assert.equal(rules.length, 1);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes("invalid regex"));
});

test("tagRecords applies multi-label matching with not exclusions", () => {
  const { rules } = L.parseRules([
    "Speed = any: fast, quick",
    "Double charge = all: charged, twice",
    "Billing = any: charged | not: refund"
  ].join("\n"));
  const tagged = L.tagRecords(COMMENTS, rules);
  assert.deepEqual(tagged[0].tags, ["Speed"]);
  assert.deepEqual(tagged[1].tags, ["Double charge"]); // refund blocks Billing
  assert.deepEqual(tagged[3].tags, ["Double charge", "Billing"]);
  assert.deepEqual(tagged[4].tags, []);
});

test("regex rules match text", () => {
  const { rules } = L.parseRules("Order ref = regex: /order\\s+#?\\d+/i");
  const tagged = L.tagRecords([{ id: "9", text: "About my order #4521 please" }], rules);
  assert.deepEqual(tagged[0].tags, ["Order ref"]);
});

test("labelStats computes counts and percentages", () => {
  const tagged = [
    { id: "1", text: "", tags: ["A"] },
    { id: "2", text: "", tags: ["A", "B"] },
    { id: "3", text: "", tags: [] },
    { id: "4", text: "", tags: ["B"] }
  ];
  const stats = L.labelStats(tagged);
  assert.deepEqual(stats, [
    { label: "A", count: 2, pct: 50 },
    { label: "B", count: 2, pct: 50 }
  ]);
});

test("coOccurrence counts label pairs", () => {
  const tagged = [
    { id: "1", text: "", tags: ["A", "B"] },
    { id: "2", text: "", tags: ["A", "B", "C"] },
    { id: "3", text: "", tags: ["A"] }
  ];
  const co = L.coOccurrence(tagged);
  assert.deepEqual(co.find((x) => x.pair === "A + B"), { pair: "A + B", count: 2 });
  assert.deepEqual(co.find((x) => x.pair === "B + C"), { pair: "B + C", count: 1 });
});

test("auditSample is deterministic for a given seed", () => {
  const tagged = L.tagRecords(COMMENTS, []);
  const a = L.auditSample(tagged, 3, 7).map((r) => r.id);
  const b = L.auditSample(tagged, 3, 7).map((r) => r.id);
  assert.deepEqual(a, b);
  assert.equal(a.length, 3);
});

test("buildTaggedCSV quotes text containing commas", () => {
  const csv = L.buildTaggedCSV([{ id: "1", text: "Fast, friendly", tags: ["Speed"] }]);
  assert.ok(csv.includes('"Fast, friendly"'));
  assert.ok(csv.startsWith("id,text,tags"));
});
