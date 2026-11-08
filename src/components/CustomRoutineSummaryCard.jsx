import { useEffect, useState } from "react";
import {
  ROUTINE_CHECKS_KEY,
  ROUTINE_TASKS_KEY,
  ROUTINE_UPDATED_EVENT,
  readTodayRoutineSummary,
} from "../utils/dailyRoutineData";

// Dashboard summary always reflects TODAY on the current device.
// Routine module itself still supports browsing any selected past date.
export default function CustomRoutineSummaryCard({ onOpen }) {
  const [summary, setSummary] = useState(() => readTodayRoutineSummary());

  useEffect(() => {
    const refresh = () => setSummary(readTodayRoutineSummary());
    const onStorage = (event) => {
      if (!event.key || event.key === ROUTINE_TASKS_KEY || event.key === ROUTINE_CHECKS_KEY) {
        refresh();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener(ROUTINE_UPDATED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    // Handles midnight if Dashboard stays open; no background job or storage write.
    const timer = window.setInterval(refresh, 30_000);
    refresh();
    return () => {
      window.removeEventListener(ROUTINE_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition hover:border-emerald-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500"
      aria-label="Open Daily Routine"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Daily Routine</h3>
          <p className="mt-1 text-xs text-slate-500">Today's custom tasks</p>
        </div>
        <span aria-hidden="true" className="text-xl text-slate-400">›</span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-700">Checklist progress</span>
        <span className="font-semibold text-emerald-700">{summary.done} / {summary.total}</span>
      </div>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label="Today's routine checklist progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={summary.percent}
      >
        <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-200" style={{ width: `${summary.percent}%` }}/>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        {summary.taskCount === 0
          ? "No tasks yet. Create your first custom task."
          : `${summary.completedTasks} of ${summary.taskCount} tasks completed today`}
      </p>
    </button>
  );
}
