import test from "node:test";
import assert from "node:assert/strict";
import {parseRoadmapText, csvRoadmapToText, jsonRoadmapToText} from "../src/utils/roadmapParser.js";

test("AI markdown headings and task bullets become a checklist", () => {
  const r = parseRoadmapText(`# DSA Roadmap\n## Phase 1: Foundations\n- [ ] Arrays\n- [x] Strings\n## Phase 2: Practice\n1. Solve LeetCode\n2. Revise recursion`);
  assert.equal(r.title, "DSA Roadmap");
  assert.deepEqual(r.items,["Phase 1: Foundations — Arrays","Phase 1: Foundations — Strings","Phase 2: Practice — Solve LeetCode","Phase 2: Practice — Revise recursion"]);
});
test("No default tasks if content is empty", () => assert.deepEqual(parseRoadmapText("   ").items, []));
test("Unbulleted AI simple lists become checklist items", () => {
  const r=parseRoadmapText("Learning Plan\nLearn arrays\nPractice linked lists\nRead about recursion");
  assert.equal(r.title,"Learning Plan");
  assert.deepEqual(r.items,["Learn arrays","Practice linked lists","Read about recursion"]);
});
test("Duplicate bullet text is dropped within a section", () => {
  const r=parseRoadmapText("# Daily Plan\n- Practice arrays\n- Practice arrays");
  assert.deepEqual(r.items,["Practice arrays"]);
});
test("Markdown fenced code ignored", () => {
  const r=parseRoadmapText("# Plan\n- Setup\n```bash\nnpm install\n```\n- Test");
  assert.deepEqual(r.items,["Setup","Test"]);
});
test("CSV quoted commas preserved", () => {
  const t=csvRoadmapToText('Task,Description,Status\n"Build app, phase 1",Start frontend,Todo\nWrite tests,Verify app,Done');
  const r=parseRoadmapText(`# Project Roadmap\n${t}`);
  assert.equal(r.items.length,2);
  assert.match(r.items[0],/Build app, phase 1/);
  assert.doesNotMatch(r.items[0], /Todo/);
});
test("JSON arrays become checklist entries", () => {
  const t=jsonRoadmapToText({title:"Python Plan",phases:[{title:"Basics",tasks:["Syntax","Functions"]},{title:"Data",steps:["Pandas"]}]});
  const r=parseRoadmapText(t);
  assert.equal(r.title,"Python Plan");
  assert.ok(r.items.some((x)=>x.includes("Syntax")));
  assert.ok(r.items.some((x)=>x.includes("Pandas")));
});
test("Checklist labels survive common emoji markers", () => {
  const r=parseRoadmapText("# Learning\n☐ Watch tutorial\n✅ Finish assessment");
  assert.equal(r.items.length,2);
});
