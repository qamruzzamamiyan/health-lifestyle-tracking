/**
 * Step 21E: Backup/restore adapter for custom Daily Routine.
 * Does not make network requests. Does not alter other module storage keys.
 * Integrate into the existing app-wide Backup & Restore UI after inspecting it.
 */
export const ROUTINE_TASKS_KEY = "hlt_daily_routine_tasks_v1";
export const ROUTINE_CHECKS_KEY = "hlt_daily_routine_checks_v1";
export const ROUTINE_UPDATED_EVENT = "hlt:daily-routine-updated";
export const ROUTINE_BACKUP_VERSION = 1;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const checked = new Date(Date.UTC(y, m - 1, d));
  return checked.getUTCFullYear() === y && checked.getUTCMonth() + 1 === m && checked.getUTCDate() === d;
}

export function validateDailyRoutineBackup(data) {
  if (!isRecord(data)) throw new Error("Daily Routine backup must be an object.");
  if (data.version !== ROUTINE_BACKUP_VERSION) {
    throw new Error("Unsupported Daily Routine backup version.");
  }
  if (!Array.isArray(data.tasks)) throw new Error("Daily Routine tasks must be an array.");
  if (!isRecord(data.checksByDay)) throw new Error("Daily Routine history must be an object.");

  const taskIds = new Set();
  const itemIds = new Set();
  for (const task of data.tasks) {
    if (!isRecord(task) || typeof task.id !== "string" || !task.id ||
        typeof task.title !== "string" || !task.title.trim() || !Array.isArray(task.items)) {
      throw new Error("Daily Routine contains a malformed task.");
    }
    if (taskIds.has(task.id)) throw new Error("Duplicate task ID in Daily Routine backup.");
    taskIds.add(task.id);
    for (const item of task.items) {
      if (!isRecord(item) || typeof item.id !== "string" || !item.id ||
          typeof item.title !== "string" || !item.title.trim()) {
        throw new Error("Daily Routine contains a malformed checklist item.");
      }
      if (itemIds.has(item.id)) throw new Error("Duplicate checklist ID in Daily Routine backup.");
      itemIds.add(item.id);
    }
  }
  for (const [day, checks] of Object.entries(data.checksByDay)) {
    if (!validDateKey(day) || !isRecord(checks)) {
      throw new Error("Daily Routine has invalid date-wise completion history.");
    }
    for (const [itemId, checked] of Object.entries(checks)) {
      if (!itemId || typeof checked !== "boolean") {
        throw new Error("Daily Routine history contains an invalid checkbox value.");
      }
    }
  }
  return data;
}

/** Read current device storage as a self-contained versioned backup section. */
export function readDailyRoutineForBackup(storage = globalThis.localStorage) {
  const tasksRaw = storage.getItem(ROUTINE_TASKS_KEY);
  const checksRaw = storage.getItem(ROUTINE_CHECKS_KEY);
  let tasks, checksByDay;
  try {
    tasks = tasksRaw === null ? [] : JSON.parse(tasksRaw);
    checksByDay = checksRaw === null ? {} : JSON.parse(checksRaw);
  } catch {
    throw new Error("Daily Routine data is not valid JSON. No backup created.");
  }
  return validateDailyRoutineBackup({ version: ROUTINE_BACKUP_VERSION, tasks, checksByDay });
}

/**
 * Restore only routine keys. UI must obtain explicit user confirmation first.
 * Pass the `dailyRoutine` section of the existing app-wide backup, not the entire file.
 * Older app backups with no dailyRoutine section should NOT call this function.
 * After a successful full restore, reload the app so React state rehydrates.
 */
export function restoreDailyRoutineFromBackup(data, storage = globalThis.localStorage) {
  const valid = validateDailyRoutineBackup(data);
  const nextTasks = JSON.stringify(valid.tasks);
  const nextChecks = JSON.stringify(valid.checksByDay);
  const oldTasks = storage.getItem(ROUTINE_TASKS_KEY);
  const oldChecks = storage.getItem(ROUTINE_CHECKS_KEY);
  try {
    storage.setItem(ROUTINE_TASKS_KEY, nextTasks);
    storage.setItem(ROUTINE_CHECKS_KEY, nextChecks);
  } catch (err) {
    let rollbackFailed = false;
    try {
      if (oldTasks === null) storage.removeItem(ROUTINE_TASKS_KEY);
      else storage.setItem(ROUTINE_TASKS_KEY, oldTasks);
      if (oldChecks === null) storage.removeItem(ROUTINE_CHECKS_KEY);
      else storage.setItem(ROUTINE_CHECKS_KEY, oldChecks);
    } catch { rollbackFailed = true; }
    throw new Error(rollbackFailed
      ? "Routine restore failed and rollback was incomplete. Do not reload; back up current device data."
      : `Routine restore failed; original routine data restored. ${err?.message || ""}`);
  }
  // 'storage' event doesn't fire in the tab that writes localStorage.
  // The host Backup & Restore UI should reload after restoring *all* modules.
  if (typeof window !== "undefined" && storage === window.localStorage) {
    window.dispatchEvent(new Event(ROUTINE_UPDATED_EVENT));
  }
  return { tasks: valid.tasks.length, dates: Object.keys(valid.checksByDay).length };
}
