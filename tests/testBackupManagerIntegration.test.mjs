import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readDailyRoutineForBackup,
  validateDailyRoutineBackup,
  ROUTINE_TASKS_KEY,
  ROUTINE_CHECKS_KEY
} from '../src/utils/dailyRoutineBackup.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const code = readFileSync(join(root, 'src/components/BackupManager.jsx'), 'utf8');
const storage = new Map();
const mockStorage = {
  getItem: key => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};

const routine = {
  version: 1,
  tasks: [
    { id: 'task1', title: 'Study DSA', items: [{ id: 'i1', title: 'Solve a problem' }] }
  ],
  checksByDay: { '2026-11-09': { i1: true } }
};

test('Daily Routine export uses tested local-only helper', () => {
  assert.match(code, /dailyRoutine:\s*readDailyRoutineForBackup\(\)/);
  assert.match(code, /from\s+["']\.\.\/utils\/dailyRoutineBackup["']/);
});

test('new section is validated before restore', () => {
  assert.match(code, /if\s*\(d\.dailyRoutine\s*!==\s*undefined\)\s*\{\s*validateDailyRoutineBackup\(d\.dailyRoutine\)/);
});

test('older backup without new section leaves routine keys untouched', () => {
  assert.match(code, /\.\.\.\(data\.dailyRoutine\s*!==\s*undefined\s*\?/);
  assert.match(code, /ROUTINE_TASKS_KEY\]:\s*JSON\.stringify\(data\.dailyRoutine\.tasks\)/);
  assert.match(code, /ROUTINE_CHECKS_KEY\]:\s*JSON\.stringify\(data\.dailyRoutine\.checksByDay\)/);
});

test('rollback snapshots all overwritten keys, including new routine keys', () => {
  assert.match(code, /for\s*\(const key of Object\.keys\(nextValues\)\)/);
  assert.match(code, /previousValues\[key\]\s*=\s*localStorage\.getItem\(key\)/);
});

test('Daily Routine CSV uses nested checklist and daily checkbox status', () => {
  assert.match(code, /"Checklist Item",\s*"Completed"/);
  assert.match(code, /data\.dailyRoutine/);
  assert.doesNotMatch(code, /defaultTasks/);
});

test('helper preserves task definitions and date-specific completion', () => {
  storage.set(ROUTINE_TASKS_KEY, JSON.stringify(routine.tasks));
  storage.set(ROUTINE_CHECKS_KEY, JSON.stringify(routine.checksByDay));
  assert.deepEqual(readDailyRoutineForBackup(mockStorage), routine);
});

test('helper rejects corrupt routine backups', () => {
  assert.throws(() => validateDailyRoutineBackup({
    ...routine,
    checksByDay: { '2026-11-09': { i1: 'yes' } }
  }), /invalid checkbox value/i);
});
