import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUTINE_TASKS_KEY, ROUTINE_CHECKS_KEY, readDailyRoutineForBackup,
  restoreDailyRoutineFromBackup, validateDailyRoutineBackup,
} from '../src/utils/dailyRoutineBackup.js';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    getAll: () => Object.fromEntries(values),
  };
}
const sample = () => ({
  version: 1,
  tasks: [{id:'task-1',title:'DSA Roadmap',items:[{id:'item-1',title:'Solve LeetCode'}]}],
  checksByDay:{'2026-11-08':{'item-1':true},'2026-11-09':{}},
});

test('empty device has zero defaults', () => {
  assert.deepEqual(readDailyRoutineForBackup(storage()), {version:1,tasks:[],checksByDay:{}});
});
test('round-trips task/checklist and day history', () => {
  const s = storage();
  restoreDailyRoutineFromBackup(sample(),s);
  assert.deepEqual(readDailyRoutineForBackup(s),sample());
});
test('does not change other module storage keys', () => {
  const s=storage({hlt_food_entries_v1:'existing nutrition',hlt_regular_meals_v1:'keep'});
  restoreDailyRoutineFromBackup(sample(),s);
  assert.equal(s.getItem('hlt_food_entries_v1'),'existing nutrition');
  assert.equal(s.getItem('hlt_regular_meals_v1'),'keep');
});
test('invalid task shapes are rejected before writing', () => {
  const s=storage({ [ROUTINE_TASKS_KEY]:'[]' });
  assert.throws(() => restoreDailyRoutineFromBackup({...sample(),tasks:[{id:'a',title:'bad',items:null}]},s));
  assert.equal(s.getItem(ROUTINE_TASKS_KEY),'[]');
});
test('invalid date key rejected', () => {
  assert.throws(() => validateDailyRoutineBackup({...sample(),checksByDay:{'2026-02-30':{}}}));
});
test('invalid checkbox value rejected', () => {
  assert.throws(() => validateDailyRoutineBackup({...sample(),checksByDay:{'2026-11-09':{'item-1':'yes'}}}));
});
test('same ID repeated rejected', () => {
  const s=sample();s.tasks[0].items.push({id:'item-1',title:'duplicate'});
  assert.throws(() => validateDailyRoutineBackup(s));
});
test('existing malformed JSON does not silently export empty data', () => {
  const s=storage({[ROUTINE_TASKS_KEY]:'{bad'});
  assert.throws(() => readDailyRoutineForBackup(s),/not valid JSON/);
});
test('failed second write restores both routine keys', () => {
  const original=sample();
  const s=storage({[ROUTINE_TASKS_KEY]:'[]',[ROUTINE_CHECKS_KEY]:'{}'});
  const save=s.setItem;
  let failed=false;
  s.setItem=(key,value)=>{
    if (key===ROUTINE_CHECKS_KEY && !failed) {failed=true; throw new Error('QuotaExceeded');}
    save(key,value);
  };
  assert.throws(() => restoreDailyRoutineFromBackup(original,s), /original routine data restored/);
  assert.equal(s.getItem(ROUTINE_TASKS_KEY),'[]');
  assert.equal(s.getItem(ROUTINE_CHECKS_KEY),'{}');
});
test('incomplete backup rejected rather than wiping routine', () => {
  assert.throws(()=>validateDailyRoutineBackup({version:1,tasks:[]}));
});
