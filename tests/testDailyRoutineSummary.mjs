import test from "node:test";
import assert from "node:assert/strict";
import {
  ROUTINE_TASKS_KEY,
  ROUTINE_CHECKS_KEY,
  localRoutineDate,
  readDailyRoutineData,
  summarizeDailyRoutine,
  readTodayRoutineSummary,
} from "../src/utils/dailyRoutineData.js";

const tasks = [
  { id: "study", title: "Study DSA", items: [{ id: "arrays" }, { id: "recursion" }] },
  { id: "gym", title: "Gym", items: [{ id: "warmup" }] },
  { id: "empty", title: "Untitled new task", items: [] },
];
const checksByDay = {
  "2026-11-08": { arrays: true, recursion: true, warmup: true },
  "2026-11-09": { arrays: true },
};
function fakeStore(entries) {
  return { getItem: (k) => entries[k] ?? null };
}

test("no default tasks in fresh localStorage", () => {
  const s = readTodayRoutineSummary(fakeStore({}), new Date(2026, 10, 9));
  assert.deepEqual([s.done, s.total, s.taskCount, s.percent],[0,0,0,0]);
});
test("correct today's progress and empty tasks not completed", () => {
  const s = summarizeDailyRoutine("2026-11-09", { tasks, checksByDay });
  assert.deepEqual([s.done,s.total,s.completedTasks,s.taskCount,s.percent],[1,3,0,3,33]);
});
test("all items completed on previous day, without modifying it", () => {
  const snapshot = JSON.stringify(checksByDay);
  const s = summarizeDailyRoutine("2026-11-08", { tasks, checksByDay });
  assert.deepEqual([s.done,s.total,s.completedTasks,s.percent],[3,3,2,100]);
  assert.equal(JSON.stringify(checksByDay), snapshot);
});
test("new date starts unchecked while task definitions persist", () => {
  const s = summarizeDailyRoutine("2026-11-10", { tasks, checksByDay });
  assert.deepEqual([s.done,s.total,s.taskCount,s.completedTasks,s.percent],[0,3,3,0,0]);
});
test("local calendar date, not UTC ISO slicing", () => {
  assert.equal(localRoutineDate(new Date(2026, 10, 9, 0, 10)), "2026-11-09");
});
test("reads exact Step 21C storage keys and ignores broken entries", () => {
  const db = readDailyRoutineData(fakeStore({
    [ROUTINE_TASKS_KEY]: JSON.stringify(tasks),
    [ROUTINE_CHECKS_KEY]: JSON.stringify(checksByDay),
  }));
  const s = summarizeDailyRoutine("2026-11-09", db);
  assert.equal(s.done, 1);
  assert.equal(readDailyRoutineData(fakeStore({
    [ROUTINE_TASKS_KEY]: "not JSON",
    [ROUTINE_CHECKS_KEY]: "[]",
  })).tasks.length,0);
});
test("one task with no items does not become a completed task", () => {
  const s = summarizeDailyRoutine("2026-11-09", {tasks:[tasks[2]],checksByDay});
  assert.equal(s.completedTasks,0);
  assert.equal(s.percent,0);
});
test("newly imported items count as unchecked until selected on that date", () => {
  const extended = [{id: "study",items:[{id:"arrays"},{id:"recursion"},{id:"imported-new"}]}];
  const s = summarizeDailyRoutine("2026-11-09", {tasks:extended,checksByDay});
  assert.equal(s.done,1);
  assert.equal(s.total,3);
});
