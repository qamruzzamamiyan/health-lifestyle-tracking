// Shared, read-only access for the custom Daily Routine module.
// These keys intentionally match DailyRoutineTasks.jsx from Step 21A/21C.
export const ROUTINE_TASKS_KEY = "hlt_daily_routine_tasks_v1";
export const ROUTINE_CHECKS_KEY = "hlt_daily_routine_checks_v1";
export const ROUTINE_UPDATED_EVENT = "hlt:daily-routine-updated";

export function localRoutineDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function safeReadJSON(storage, key, fallback) {
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function readDailyRoutineData(storage) {
  let store = storage;
  if (store === undefined) {
    try { store = typeof window !== "undefined" ? window.localStorage : null; }
    catch { store = null; }
  }
  const storedTasks = safeReadJSON(store, ROUTINE_TASKS_KEY, []);
  const storedChecks = safeReadJSON(store, ROUTINE_CHECKS_KEY, {});
  return {
    tasks: Array.isArray(storedTasks) ? storedTasks : [],
    checksByDay: storedChecks && typeof storedChecks === "object" && !Array.isArray(storedChecks)
      ? storedChecks : {},
  };
}

// An empty task is not complete; checklist items count toward progress.
// Completion history is keyed by local date, so a new date starts unchecked
// automatically without deleting yesterday's checks.
export function summarizeDailyRoutine(date, data) {
  const snapshot = data || readDailyRoutineData();
  const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
  const dayChecks = snapshot.checksByDay?.[date];
  const checked = dayChecks && typeof dayChecks === "object" && !Array.isArray(dayChecks)
    ? dayChecks : {};
  let total = 0;
  let done = 0;
  let completedTasks = 0;
  for (const task of tasks) {
    const items = Array.isArray(task?.items) ? task.items : [];
    total += items.length;
    const taskDone = items.filter((item) =>
      item?.id != null && Boolean(checked[item.id])
    ).length;
    done += taskDone;
    if (items.length > 0 && taskDone === items.length) completedTasks++;
  }
  return {
    date,
    total,
    done,
    taskCount: tasks.length,
    completedTasks,
    percent: total ? Math.round(100 * done / total) : 0,
  };
}

export function readTodayRoutineSummary(storage, now = new Date()) {
  return summarizeDailyRoutine(localRoutineDate(now), readDailyRoutineData(storage));
}
