"use strict";
// Verbatim Rule Tagger: core logic. Pure functions, no DOM, no fetch.

// Minimal CSV parser handling quoted fields and embedded commas/newlines.
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r[0] && r[0].trim() !== ""));
}

// Parse records CSV: header row, id column, text column (by name or index).
function parseRecords(text, opts) {
  const o = opts || {};
  const rows = parseCSV(text);
  if (!rows.length) return { records: [], errors: ["CSV is empty"] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idIdx = o.idColumn != null ? o.idColumn : Math.max(0, header.findIndex((h) => ["id", "record id", "response id"].includes(h)));
  let textIdx = o.textColumn != null ? o.textColumn : header.findIndex((h) => ["text", "comment", "verbatim", "response", "feedback"].includes(h));
  if (textIdx < 0) textIdx = header.length - 1;
  const records = [];
  const errors = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const txt = (r[textIdx] || "").trim();
    if (!txt) { errors.push("Row " + (i + 1) + ": empty text, skipped"); continue; }
    records.push({ id: (r[idIdx] || String(i)).trim(), text: txt });
  }
  return { records, errors };
}

// Parse one rule line. Formats:
//   Label = any: fast, quick, speedy
//   Label = all: charged, twice
//   Label = not: refund        (matches when NONE of the keywords appear)
//   Label = any: a, b | not: c (combined: any of a/b and none of c)
//   Label = regex: /pattern/ims
function parseRule(line, lineNo) {
  const raw = String(line || "").trim();
  if (!raw || raw.startsWith("#")) return null;
  const eq = raw.indexOf("=");
  if (eq < 0) throw new Error("Line " + lineNo + ": missing '=' in rule");
  const label = raw.slice(0, eq).trim();
  if (!label) throw new Error("Line " + lineNo + ": empty label");
  let rest = raw.slice(eq + 1).trim();
  const rule = { label, any: [], all: [], not: [], regex: null, regexError: null, line: lineNo };
  if (/^regex\s*:/i.test(rest)) {
    const body = rest.replace(/^regex\s*:/i, "").trim();
    const m = body.match(/^\/(.+)\/([a-z]*)$/);
    try {
      if (m) rule.regex = new RegExp(m[1], m[2].includes("i") ? m[2] : m[2] + "i");
      else rule.regex = new RegExp(body, "i");
    } catch (e) {
      rule.regexError = "Line " + lineNo + ": invalid regex: " + e.message;
    }
    return rule;
  }
  const parts = rest.split("|").map((x) => x.trim()).filter(Boolean);
  for (const part of parts) {
    const m = part.match(/^(any|all|not)\s*:\s*(.*)$/i);
    if (!m) throw new Error("Line " + lineNo + ": expected any:, all: or not: in '" + part + "'");
    const words = m[2].split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
    rule[m[1].toLowerCase()] = words;
  }
  if (!rule.any.length && !rule.all.length && !rule.not.length) {
    throw new Error("Line " + lineNo + ": rule has no keywords");
  }
  return rule;
}

function parseRules(text) {
  const rules = [];
  const errors = [];
  String(text || "").split(/\r?\n/).forEach((line, i) => {
    try {
      const r = parseRule(line, i + 1);
      if (r) {
        if (r.regexError) errors.push(r.regexError);
        rules.push(r);
      }
    } catch (e) { errors.push(e.message); }
  });
  return { rules, errors };
}

// Match one record against one rule. Returns true/false.
function matchRule(rule, text) {
  const t = String(text || "").toLowerCase();
  if (rule.regex) return rule.regex.test(String(text || ""));
  if (rule.any.length && !rule.any.some((k) => t.includes(k))) return false;
  if (rule.all.length && !rule.all.every((k) => t.includes(k))) return false;
  if (rule.not.length && rule.not.some((k) => t.includes(k))) return false;
  if (!rule.any.length && !rule.all.length && rule.not.length) return true;
  return rule.any.length > 0 || rule.all.length > 0;
}

// Tag all records. Rules are evaluated in order; all matching labels apply
// (multi-label). Order is preserved so earlier rules read as higher precedence
// in the tags column.
function tagRecords(records, rules) {
  return records.map((rec) => {
    const tags = [];
    const matched = [];
    for (const rule of rules) {
      if (rule.regexError) continue;
      if (matchRule(rule, rec.text)) { tags.push(rule.label); matched.push(rule.label); }
    }
    return { id: rec.id, text: rec.text, tags, matched };
  });
}

function labelStats(tagged) {
  const total = tagged.length;
  const counts = {};
  tagged.forEach((r) => r.tags.forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
  return Object.keys(counts).sort().map((label) => ({
    label, count: counts[label],
    pct: total ? Math.round((counts[label] / total) * 1000) / 10 : 0
  }));
}

// Co-occurrence: for each pair of labels, how many records carry both.
function coOccurrence(tagged) {
  const pairs = {};
  tagged.forEach((r) => {
    const tags = Array.from(new Set(r.tags)).sort();
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const key = tags[i] + " + " + tags[j];
        pairs[key] = (pairs[key] || 0) + 1;
      }
    }
  });
  return Object.keys(pairs).sort().map((pair) => ({ pair, count: pairs[pair] }));
}

// Deterministic audit sample: seeded shuffle, take n. Same seed, same sample.
function seededRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function auditSample(tagged, n, seed) {
  const copy = tagged.slice();
  const rng = seededRng(seed == null ? 42 : seed);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
  }
  return copy.slice(0, Math.max(0, Math.min(n || 0, copy.length)));
}

function csvEscape(value) {
  const s = String(value == null ? "" : value);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function buildTaggedCSV(tagged) {
  const rows = [["id", "text", "tags"]];
  tagged.forEach((r) => rows.push([r.id, r.text, r.tags.join("; ")]));
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n") + "\n";
}

const api = { parseCSV, parseRecords, parseRule, parseRules, matchRule, tagRecords, labelStats, coOccurrence, auditSample, seededRng, buildTaggedCSV, csvEscape };
if (typeof module !== "undefined" && module.exports) { module.exports = api; }
if (typeof window !== "undefined") { window.VerbatimRuleTagger = api; }
