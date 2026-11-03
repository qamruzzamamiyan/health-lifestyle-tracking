
import { useState, useEffect } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ListChecks
} from "lucide-react";

// Default daily routine
export const defaultTasks = [
  { id: "breakfast", name: "Breakfast before 8:30 AM" },
  { id: "lunch", name: "Lunch (12:30 - 1:10 PM)" },
  { id: "snacks", name: "Evening Snack" },
  { id: "exercise", name: "Gym / Physical Activity" },
  { id: "dinner", name: "Dinner after 8 PM" },
  { id: "nutrition", name: "Complete Daily Food Log" }
];

function getToday() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function readStorage(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

export default function RoutineTracker({
  routineStart = ""
}) {
  const [date, setDate] = useState(getToday);
  const [newTask, setNewTask] = useState("");

  const [customTasks, setCustomTasks] = useState(() => {
    const saved = readStorage("hlt_custom_tasks_v1", []);
    return Array.isArray(saved) ? saved : [];
  });

  const [dailyCompleted, setDailyCompleted] = useState(() => {
    const saved = readStorage("hlt_daily_routine_v1", {});
    return saved && typeof saved === "object" &&
      !Array.isArray(saved) ? saved : {};
  });

  useEffect(() => {
    localStorage.setItem(
      "hlt_custom_tasks_v1",
      JSON.stringify(customTasks)
    );
  }, [customTasks]);

  useEffect(() => {
    localStorage.setItem(
      "hlt_daily_routine_v1",
      JSON.stringify(dailyCompleted)
    );
  }, [dailyCompleted]);

  const tasks = [...defaultTasks, ...customTasks];

  const completedIds = Array.isArray(dailyCompleted[date])
    ? dailyCompleted[date]
    : [];

  const completedCount = tasks.filter(task =>
    completedIds.includes(task.id)
  ).length;

  const progress = tasks.length
    ? Math.round((completedCount / tasks.length) * 100)
    : 0;

  function toggleTask(id) {
    setDailyCompleted(previous => {
      const current = Array.isArray(previous[date])
        ? previous[date]
        : [];

      const updated = current.includes(id)
        ? current.filter(taskId => taskId !== id)
        : [...current, id];

      return {
        ...previous,
        [date]: updated
      };
    });
  }

  function addTask(e) {
    e.preventDefault();

    const name = newTask.trim();
    if (!name) return;

    const task = {
      id: crypto.randomUUID(),
      name
    };

    setCustomTasks(previous => [...previous, task]);
    setNewTask("");
  }

  function deleteTask(id) {
    setCustomTasks(previous =>
      previous.filter(task => task.id !== id)
    );
  }

  return (
    <div className="space-y-6">

      {/* PAGE HEADER */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Daily Routine
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Track your daily tasks, habits and activities.
        </p>

{/* ROUTINE START TIME */}
{routineStart && (
  <p className="mt-2 text-sm font-medium text-blue-700">
    Planned Routine Start: {routineStart}
  </p>
)}

      </div>

      {/* DATE SELECTOR */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <CalendarDays
            size={20}
            className="text-emerald-600"
          />
          <h3 className="font-semibold">Select Date</h3>
        </div>

        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="mt-4 w-full rounded-xl border
            border-slate-200 p-3 outline-none
            focus:border-emerald-500 sm:w-auto"
        />
      </div>

      {/* PROGRESS CARD */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">
              Daily Progress
            </p>

            <h3 className="mt-2 text-3xl font-bold
              text-emerald-700">
              {progress}%
            </h3>
          </div>

          <div className="rounded-xl bg-emerald-50 p-3">
            <ListChecks
              size={28}
              className="text-emerald-600"
            />
          </div>
        </div>

        <div className="mt-5 h-3 overflow-hidden
          rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500
              transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="mt-3 text-sm text-slate-500">
          {completedCount} of {tasks.length} tasks completed
        </p>
      </div>

      {/* DAILY CHECKLIST */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">

        <h3 className="mb-5 text-lg font-bold">
          Daily Checklist
        </h3>

        <div className="space-y-3">
          {tasks.map(task => {
            const done = completedIds.includes(task.id);
            const isCustom = customTasks.some(
              custom => custom.id === task.id
            );

            return (
              <div
                key={task.id}
                className={`flex items-center justify-between
                  gap-3 rounded-xl border p-4 transition
                  ${done
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-slate-100 bg-slate-50"}`}
              >
                <button
                  type="button"
                  onClick={() => toggleTask(task.id)}
                  aria-pressed={done}
                  className="flex flex-1 items-center
                    gap-3 text-left"
                >
                  {done ? (
                    <CheckCircle2
                      size={23}
                      className="shrink-0 text-emerald-600"
                    />
                  ) : (
                    <Circle
                      size={23}
                      className="shrink-0 text-slate-400"
                    />
                  )}

                  <span className={`text-sm font-medium
                    ${done
                      ? "text-emerald-800 line-through"
                      : "text-slate-700"}`}>
                    {task.name}
                  </span>
                </button>

                {isCustom && (
                  <button
                    type="button"
                    onClick={() => deleteTask(task.id)}
                    aria-label={`Delete ${task.name}`}
                    className="rounded-lg p-2 text-red-500
                      hover:bg-red-50"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ADD CUSTOM TASK */}
      <form
        onSubmit={addTask}
        className="rounded-2xl bg-white p-6 shadow-sm"
      >
        <h3 className="text-lg font-bold">
          Add Custom Task
        </h3>

        <p className="mt-2 text-sm text-slate-500">
          Custom tasks will appear in your daily checklist.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">

          <input
            type="text"
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            placeholder="e.g. Study DSA for 1 hour"
            className="min-w-0 flex-1 rounded-xl border
              border-slate-200 p-3 text-sm outline-none
              focus:border-emerald-500"
          />

          <button
            type="submit"
            disabled={!newTask.trim()}
            className="flex items-center justify-center gap-2
              rounded-xl bg-emerald-600 px-5 py-3
              text-sm font-semibold text-white
              hover:bg-emerald-700 disabled:opacity-50"
          >
            <Plus size={18} />
            Add Task
          </button>
        </div>
      </form>

    </div>
  );
}
