/**
 * Parse AI-generated roadmaps/lists into one task with editable checklist items.
 * Deterministic, offline, no API calls. Output is a *draft*, not trusted AI inference.
 */
const BULLET_RE = /^\s*(?:[-*+•●▪◦‣–—]|☐|☑|✅|✔|✓|\d{1,3}[.)]|[a-zA-Z][.)])\s+(.*)$/u;
const TASK_PREFIX = /^\s*(?:\[(?:x|X|\s)\]\s*|(?:☐|☑|✅|✔|✓)\s*)/u;
const MARKDOWN_HEADER = /^\s*#{1,6}\s+(.+?)\s*#*\s*$/;
const SECTION_RE = /^(?:phase|week|day|module|unit|milestone|section|chapter|stage|part|topic|sprint)\s*(?:\d+|[ivx]+|[a-z])?(?:\s*[-:–—]\s*|\s+).+$/i;
const MAX_ITEMS = 250;
const MAX_CHARS = 160000;

const clean = (value) => String(value || "")
  .replace(/<[^>]{1,100}>/g, " ")
  .replace(/[*_`~]/g, "")
  .replace(/[\u200B-\u200D\uFEFF]/g, "")
  .replace(/\s+/g, " ").trim();

function isBullet(line) { return BULLET_RE.test(line); }
function stripBullet(line) {
  const match = line.match(BULLET_RE);
  const withoutMarker = match ? match[1] : line;
  return clean(withoutMarker.replace(TASK_PREFIX, ""));
}
function isSection(line) {
  const value = clean(line);
  if (!value || value.length > 110) return false;
  return SECTION_RE.test(value) || (value.endsWith(":") && value.length < 90);
}
function fileTitle(name) {
  return clean((name || "Imported Roadmap").replace(/\.[a-z0-9]{1,6}$/i, "")
    .replace(/[_-]+/g, " ")).slice(0, 100) || "Imported Roadmap";
}

/** @returns {{title:string,items:string[],warnings:string[]}} */
export function parseRoadmapText(rawText, fallbackFilename = "") {
  const source = String(rawText || "").slice(0, MAX_CHARS);
  const rows = source.replace(/\r\n?/g, "\n").split("\n");
  const meaningful = rows.map((r) => r.trim()).filter(Boolean);
  const warnings = [];
  if (String(rawText || "").length > MAX_CHARS) warnings.push("Long document: only the first 160,000 characters were analyzed.");
  if (!meaningful.length) return {title: fileTitle(fallbackFilename), items: [], warnings: ["No readable text found.", ...warnings]};

  const explicitHeading = meaningful.find((r) => MARKDOWN_HEADER.test(r));
  const first = meaningful[0] || "";
  let title = explicitHeading ? clean(explicitHeading.match(MARKDOWN_HEADER)[1]) : "";
  if (!title && !isBullet(first) && !isSection(first) && first.length <= 100 && !/[.!?]$/.test(first)) {
    title = clean(first.replace(/^\s*(?:Roadmap|Task|Title)\s*:\s*/i, ""));
  }
  if (!title) title = fileTitle(fallbackFilename);
  title = title.slice(0, 100);

  let section = "";
  const found = [];
  const seen = new Set();
  const hasBullets = rows.some(isBullet);
  let inCode = false;

  function append(value) {
    if (!value || found.length >= MAX_ITEMS) return;
    const normalized = clean(value).slice(0, 160);
    if (!normalized || normalized.toLowerCase() === title.toLowerCase()) return;
    const full = section && !normalized.toLowerCase().startsWith(section.toLowerCase())
      ? `${section} — ${normalized}`.slice(0, 180) : normalized;
    const key = full.toLocaleLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    found.push(full);
  }

  for (let i = 0; i < rows.length; i++) {
    const line = rows[i].trim();
    if (!line) continue;
    if (/^\s*(```|~~~)/.test(line)) { inCode = !inCode; continue; }
    if (inCode || /^\s*\|?\s*[-:]{3,}\s*\|/.test(line)) continue;
    if (/^\s*(?:https?:\/\/|```|>)/.test(line)) continue;
    if (/^\s*(?:note|disclaimer|resources?|references?|links?)\s*:/i.test(line)) continue;
    const header = line.match(MARKDOWN_HEADER);
    if (header) {
      const content = clean(header[1]);
      if (content !== title && content.length <= 100) section = content;
      continue;
    }
    if (isBullet(line)) { append(stripBullet(line)); continue; }
    if (isSection(line)) { section = clean(line.replace(/:$/, "")).slice(0, 65); continue; }
    if (clean(line) === title) continue;
    // Common AI/plain-text output: one short task per line, without bullets.
    // When explicit bullets exist, non-bulleted prose is skipped to reduce noise.
    if (!hasBullets && line.length <= 175 && !/[.!?].*[.!?]/.test(line)) append(line);
  }

  if (found.length >= MAX_ITEMS) warnings.push(`Import limited to ${MAX_ITEMS} items. Review your preview.`);
  if (!found.length) warnings.push("No obvious list items found. Paste a numbered/bulleted list, or edit the checklist preview manually.");
  return {title, items: found, warnings};
}

/** Structured JSON input common to task/roadmap exports. */
export function jsonRoadmapToText(json) {
  const lines = [];
  let visited = 0;
  function walk(node, depth = 0, heading = "") {
    if (visited++ > 1500 || depth > 12 || lines.length > 600) return;
    if (typeof node === "string") {
      if (node.trim()) lines.push(`- ${node.trim()}`);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1, heading);
      return;
    }
    if (!node || typeof node !== "object") return;
    const title = node.title || node.name || node.heading || node.phase || node.week || node.task || node.label;
    if (typeof title === "string" && title.trim()) {
      const trimmed = clean(title);
      if (depth === 0) lines.push(`# ${trimmed}`);
      else if (Object.keys(node).some((k) => /^(steps|tasks|items|checklist|subtasks|milestones|activities|phases|weeks)$/i.test(k))) {
        lines.push(`## ${trimmed}`);
      } else lines.push(`- ${trimmed}`);
    }
    let childListFound = false;
    for (const [k, value] of Object.entries(node)) {
      if (/^(steps|tasks|items|checklist|subtasks|milestones|activities|phases|weeks|modules|roadmap|plan)$/i.test(k) && value != null) {
        childListFound = true;
        walk(value, depth + 1, k);
      }
    }
    if (!childListFound && !title) {
      for (const [k, value] of Object.entries(node)) {
        if (typeof value === "string") lines.push(`- ${k}: ${value}`);
        else if (typeof value === "object" && value !== null) walk(value, depth + 1, k);
      }
    }
  }
  walk(json);
  return lines.join("\n");
}

export function csvRoadmapToText(csv) {
  // RFC4180-ish CSV/TSV reader for text-only imports; handles quoted commas/newlines.
  const delimiter = csv.slice(0, 200).includes("\t") ? "\t" : ",";
  const records = [];
  let current = "", row = [], quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (quoted && ch === '"' && csv[i + 1] === '"') { current += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === delimiter) { row.push(current); current = ""; }
    else if (!quoted && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && csv[i + 1] === "\n") i++;
      row.push(current); records.push(row); row = []; current = "";
    } else current += ch;
  }
  row.push(current); if (row.some((x) => x.trim())) records.push(row);
  const first = records[0]?.map((x) => x.trim().toLowerCase()) || [];
  const header = first.some((v) => /^(task|step|activity|item|title|description|checklist|phase|status)$/i.test(v));
  const usefulColumns = first.map((name, i) => ({name, i})).filter((x) => !/^(id|status|done|completed|date|start|end|duration|priority|owner)$/i.test(x.name));
  const keep = header ? usefulColumns.map((x) => x.i) : null;
  return records.slice(header ? 1 : 0, 251).map((cells) => {
    const chosen = (keep ? keep.map((i) => cells[i]) : cells)
      .map((x) => clean(x)).filter(Boolean);
    return chosen.length ? `- ${chosen.join(" — ")}` : "";
  }).filter(Boolean).join("\n");
}
