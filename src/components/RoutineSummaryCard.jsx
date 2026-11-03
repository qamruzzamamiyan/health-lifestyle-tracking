
import { ListChecks, ArrowRight } from "lucide-react";
import { defaultTasks } from "./RoutineTracker";

function getToday() {
  const d = new Date();

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}

function readStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

export default function RoutineSummaryCard({ onOpen }) {
  const customData = readStorage("hlt_custom_tasks_v1", []);
  const routineData = readStorage("hlt_daily_routine_v1", {});

  const customTasks = Array.isArray(customData)
    ? customData
    : [];

  const allTasks = [...defaultTasks, ...customTasks];

  const today = getToday();

  const completedIds = Array.isArray(routineData?.[today])
    ? routineData[today]
    : [];

  const completedCount = allTasks.filter(task =>
    completedIds.includes(task.id)
  ).length;

  const progress = allTasks.length
    ? Math.round((completedCount / allTasks.length) * 100)
    : 0;

  return (
    <section className="rounded-2xl border border-slate-100
      bg-white p-6 shadow-sm">

      <div className="flex flex-wrap items-center
        justify-between gap-4">

        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-3">
            <ListChecks
              size={24}
              className="text-blue-600"
            />
          </div>

          <div>
            <h3 className="font-bold text-slate-900">
              Daily Routine
            </h3>

            <p className="text-sm text-slate-500">
              Today's task completion
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="flex items-center gap-2
            rounded-xl bg-emerald-50 px-4 py-2
            text-sm font-semibold text-emerald-700
            hover:bg-emerald-100"
        >
          Open Routine
          <ArrowRight size={17} />
        </button>
      </div>

      <div className="mt-6 flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold text-emerald-700">
            {progress}%
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {completedCount} of {allTasks.length} tasks completed
          </p>
        </div>

        <span className="text-sm font-medium text-slate-500">
          {progress === 100
            ? "All tasks completed!"
            : "Keep going!"}
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="Daily routine completion"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-5 h-3 overflow-hidden
          rounded-full bg-slate-100"
      >
        <div
          className="h-full rounded-full bg-emerald-500
            transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </section>
  );
}
