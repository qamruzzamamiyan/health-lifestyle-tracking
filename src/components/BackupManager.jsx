import { DEFAULT_SETTINGS } from "./SettingsPage";
// STEP22_PLANNER_BACKUP
import {
  readPlannerForBackup, validatePlannerBackup,
  SKILLS_KEY, TIMETABLE_KEY, SESSION_CHECKS_KEY,
} from "../utils/routinePlannerData";
import { useState } from "react";
import {
  DatabaseBackup,
  Download,
  FileSpreadsheet,
  Upload,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";

import {
  readDailyRoutineForBackup,
  validateDailyRoutineBackup,
  ROUTINE_TASKS_KEY,
  ROUTINE_CHECKS_KEY
} from "../utils/dailyRoutineBackup";

// Existing app storage keys
const KEYS = {
  foods: "hlt_food_entries_v1",
  customTasks: "hlt_custom_tasks_v1",
  routine: "hlt_daily_routine_v1",
  workouts: "hlt_workouts_v1",
  weights: "hlt_weekly_weight_v1",
  weightTarget: "hlt_weight_target_v1",
  settings: "hlt_settings_v1"
};

function readJSON(key, fallback) {
  const raw = localStorage.getItem(key);
  return raw === null ? fallback : JSON.parse(raw);
}


function getAllData() {
  return {
    foods: readJSON(KEYS.foods, []),

    customTasks: readJSON(
      KEYS.customTasks, []
    ),

    routine: readJSON(
      KEYS.routine, {}
    ),

    workouts: readJSON(
      KEYS.workouts, []
    ),

    weights: readJSON(
      KEYS.weights, []
    ),

    weightTarget:
      localStorage.getItem(KEYS.weightTarget) ?? "",

    settings: readJSON(
      KEYS.settings,
      DEFAULT_SETTINGS
    ),

    dailyRoutine: readDailyRoutineForBackup(),
    planner: readPlannerForBackup()
  };
}


function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateStamp() {
  const d = new Date();

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}

// Protect CSV files from formulas entered as text
function csvCell(value) {
  let text = String(value ?? "");

  if (/^\s*[=+\-@]/.test(text)) {
    text = "'" + text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCSV(filename, headers, rows) {
  const content = [
    headers,
    ...rows
  ].map(row => row.map(csvCell).join(",")).join("\r\n");

  downloadFile(
    filename,
    "\uFEFF" + content,
    "text/csv;charset=utf-8"
  );
}

function isObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function validDate(value) {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validNumber(value) {
  return typeof value === "number" &&
    Number.isFinite(value);
}

// Validate the backup before changing existing data
function validateBackup(backup) {
  if (
    !isObject(backup) ||
    backup.app !== "health-lifestyle-tracking" ||
    backup.version !== 1 ||
    !isObject(backup.data)
  ) {
    throw new Error("Invalid or unsupported backup file.");
  }

  const d = backup.data;

  if (
    !Array.isArray(d.foods) ||
    !d.foods.every(x =>
      isObject(x) &&
      typeof x.id === "string" &&
      validDate(x.date) &&
      typeof x.name === "string" &&
      validNumber(x.calories) &&
      validNumber(x.protein)
    )
  ) {
    throw new Error("Invalid nutrition records.");
  }

  if (
    !Array.isArray(d.customTasks) ||
    !d.customTasks.every(x =>
      isObject(x) &&
      typeof x.id === "string" &&
      typeof x.name === "string"
    )
  ) {
    throw new Error("Invalid custom tasks.");
  }

  if (
    !isObject(d.routine) ||
    !Object.entries(d.routine).every(
      ([date, ids]) =>
        validDate(date) &&
        Array.isArray(ids) &&
        ids.every(id => typeof id === "string")
    )
  ) {
    throw new Error("Invalid daily routine records.");
  }

  if (
    !Array.isArray(d.workouts) ||
    !d.workouts.every(x =>
      isObject(x) &&
      typeof x.id === "string" &&
      validDate(x.date) &&
      typeof x.exercise === "string" &&
      validNumber(x.sets) &&
      validNumber(x.reps) &&
      validNumber(x.weight)
    )
  ) {
    throw new Error("Invalid workout records.");
  }

  if (
    !Array.isArray(d.weights) ||
    !d.weights.every(x =>
      isObject(x) &&
      typeof x.id === "string" &&
      validDate(x.date) &&
      validDate(x.weekStart) &&
      validNumber(x.weight)
    )
  ) {
    throw new Error("Invalid weekly weight records.");
  }

  if (typeof d.weightTarget !== "string") {
    throw new Error("Invalid weight target.");
  }

// SETTINGS VALIDATION
if (d.settings !== undefined) {
  const s = d.settings;

  if (
    !isObject(s) ||

    !Number.isFinite(s.calorieGoal) ||
    s.calorieGoal < 500 ||
    s.calorieGoal > 10000 ||

    !Number.isFinite(s.proteinMin) ||
    !Number.isFinite(s.proteinMax) ||
    s.proteinMin < 0 ||
    s.proteinMax < s.proteinMin ||
    s.proteinMax > 500 ||

    !Array.isArray(s.gymDays) ||
    !s.gymDays.every(
      day => typeof day === "string"
    ) ||

    typeof s.gymStart !== "string" ||
    typeof s.gymEnd !== "string" ||
    typeof s.weighInDay !== "string" ||
    typeof s.routineStart !== "string"
  ) {
    throw new Error(
      "Invalid settings records."
    );
  }
}


  // New section is optional to preserve older version-1 backups.
  // Validate ALL sections before writing any localStorage keys.
  if (d.dailyRoutine !== undefined) {
    validateDailyRoutineBackup(d.dailyRoutine);
  }
  // Optional: backups created before Step22 never overwrite current skills/schedule.
  if (d.planner !== undefined) validatePlannerBackup(d.planner);

  return d;
}

export default function BackupManager() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function resetMessages() {
    setMessage("");
    setError("");
  }

  function exportJSON() {
    resetMessages();

    try {
      const backup = {
        app: "health-lifestyle-tracking",
        version: 1,
        exportedAt: new Date().toISOString(),
        data: getAllData()
      };

      // Validate the generated backup too
      validateBackup(backup);

      downloadFile(
        `health-lifestyle-backup-${dateStamp()}.json`,
        JSON.stringify(backup, null, 2),
        "application/json"
      );

      setMessage("Full backup download started.");
    } catch (err) {
      setError(`Backup failed: ${err.message}`);
    }
  }

  function exportCSV(type) {
    resetMessages();

    try {
      const data = getAllData();
      let headers = [];
      let rows = [];

      if (type === "nutrition") {
        headers = [
          "Date", "Meal", "Food", "Quantity",
          "Unit", "Calories (kcal)", "Protein (g)"
        ];

        rows = data.foods.map(x => [
          x.date, x.meal, x.name, x.quantity,
          x.unit, x.calories, x.protein
        ]);
      }

      if (type === "gym") {
        headers = [
          "Date", "Exercise", "Sets", "Reps",
          "Weight (kg)", "Volume (kg)", "Notes"
        ];

        rows = data.workouts.map(x => [
          x.date,
          x.exercise,
          x.sets,
          x.reps,
          x.weight,
          x.sets * x.reps * x.weight,
          x.notes
        ]);
      }

      if (type === "weight") {
        headers = [
          "Date", "Week Start", "Weight (kg)", "Notes"
        ];

        rows = data.weights.map(x => [
          x.date, x.weekStart, x.weight, x.notes
        ]);
      }

      if (type === "routine") {
        // New Daily Routine, not the old RoutineTracker's default tasks.
        headers = ["Date", "Task", "Checklist Item", "Completed"];
        const { tasks, checksByDay } = data.dailyRoutine;
        const dates = Object.keys(checksByDay).sort();

        rows = dates.length > 0
          ? dates.flatMap(date =>
              tasks.flatMap(task =>
                task.items.map(item => {
                  const dailyChecks = checksByDay[date];
                  const checked = Object.prototype.hasOwnProperty.call(
                    dailyChecks, item.id
                  );
                  return [
                    date,
                    task.title,
                    item.title,
                    checked ? (dailyChecks[item.id] ? "Yes" : "No") : "Not recorded"
                  ];
                })
              )
            )
          : tasks.flatMap(task =>
              task.items.map(item => [
                "", task.title, item.title, "Not recorded"
              ])
            );
      }

      downloadCSV(
        `health-lifestyle-${type}-${dateStamp()}.csv`,
        headers,
        rows
      );

      setMessage(`${type} CSV download started.`);
    } catch (err) {
      setError(`CSV export failed: ${err.message}`);
    }
  }

  async function restoreBackup() {
    resetMessages();

    if (!selectedFile || !acknowledged) return;

    setBusy(true);

    try {
      const content = await selectedFile.text();
      const backup = JSON.parse(content);
      const data = validateBackup(backup);

      const confirmed = window.confirm(
        "This will replace your current Health & Lifestyle " +
        "Tracking records. Have you saved your current backup?"
      );

      if (!confirmed) return;

      const nextValues = {
        [KEYS.foods]: JSON.stringify(data.foods),
        [KEYS.customTasks]: JSON.stringify(data.customTasks),
        [KEYS.routine]: JSON.stringify(data.routine),
        [KEYS.workouts]: JSON.stringify(data.workouts),
        [KEYS.weights]: JSON.stringify(data.weights),
        [KEYS.weightTarget]: data.weightTarget,
        // Add planner keys to the SAME rollback transaction as all other modules.
        ...(data.planner !== undefined ? {
          [SKILLS_KEY]: JSON.stringify(data.planner.skills),
          [TIMETABLE_KEY]: JSON.stringify(data.planner.schedules),
          [SESSION_CHECKS_KEY]: JSON.stringify(data.planner.sessionChecksByDay),
        } : {}),
        // Older backups have no dailyRoutine section: keep current tasks unchanged.
        ...(data.dailyRoutine !== undefined ? {
          [ROUTINE_TASKS_KEY]: JSON.stringify(data.dailyRoutine.tasks),
          [ROUTINE_CHECKS_KEY]: JSON.stringify(data.dailyRoutine.checksByDay)
        } : {}),
        ...(data.settings !== undefined
  ? {
      [KEYS.settings]: JSON.stringify(
        data.settings
      )
    }
  : {})
      };

      const previousValues = {};

      // Snapshot ALL keys to be replaced, including new Daily Routine keys.
      for (const key of Object.keys(nextValues)) {
        previousValues[key] = localStorage.getItem(key);
      }

      try {
        for (const [key, value] of Object.entries(nextValues)) {
          localStorage.setItem(key, value);
        }
      } catch (writeError) {
        // Restore previous values if writing fails
        for (const [key, value] of Object.entries(previousValues)) {
          try {
            if (value === null) {
              localStorage.removeItem(key);
            } else {
              localStorage.setItem(key, value);
            }
          } catch (rollbackError) {
            console.error("Rollback failed:", rollbackError);
          }
        }

        throw writeError;
      }

      // Reload so all React components read restored data
      window.location.reload();

    } catch (err) {
      setError(
        `Restore failed: ${err.message}. Check your backup file.`
      );
    } finally {
      setBusy(false);
    }
  }

  const csvOptions = [
    { id: "nutrition", title: "Nutrition CSV" },
    { id: "routine", title: "Daily Routine CSV" },
    { id: "gym", title: "Gym & Fitness CSV" },
    { id: "weight", title: "Weekly Weight CSV" }
  ];

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div>
        <div className="flex items-center gap-3">
          <DatabaseBackup
            size={28}
            className="text-emerald-600"
          />

          <h2 className="text-2xl font-bold text-slate-900">
            Backup & Export
          </h2>
        </div>

        <p className="mt-2 text-sm text-slate-500">
          Manage your personal tracking records and backups.
        </p>
      </div>

      {/* PRIVACY */}
      <div className="flex items-start gap-3 rounded-2xl
        border border-emerald-100 bg-emerald-50 p-5">

        <ShieldCheck
          size={23}
          className="shrink-0 text-emerald-700"
        />

        <div>
          <h3 className="font-semibold text-emerald-900">
            Local Data Storage
          </h3>

          <p className="mt-1 text-sm leading-6 text-emerald-800">
            Your tracking data is currently stored in
            this browser. Export it regularly to keep
            your own backup.
          </p>
        </div>
      </div>

      {/* FULL BACKUP */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold">
          Full Data Backup
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Download your nutrition, gym and weekly weight data,
          including your custom Daily Routine tasks, checklists,
          date-wise history and weight target, as one JSON file.
        </p>

        <button
          type="button"
          onClick={exportJSON}
          className="mt-5 flex items-center gap-2
            rounded-xl bg-emerald-600 px-5 py-3
            text-sm font-semibold text-white
            hover:bg-emerald-700"
        >
          <Download size={18} />
          Download Full Backup
        </button>
      </section>

      {/* CSV EXPORT */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <FileSpreadsheet
            size={21}
            className="text-blue-600"
          />
          Export CSV Reports
        </h3>

        <p className="mt-2 text-sm text-slate-500">
          Download records as CSV files for spreadsheets.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {csvOptions.map(option => (
            <button
              key={option.id}
              type="button"
              onClick={() => exportCSV(option.id)}
              className="flex items-center justify-between
                gap-3 rounded-xl border border-slate-200
                p-4 text-left text-sm font-medium
                text-slate-700 hover:border-emerald-400
                hover:bg-emerald-50"
            >
              {option.title}
              <Download size={18} />
            </button>
          ))}
        </div>
      </section>

      {/* RESTORE */}
      <section className="space-y-5 rounded-2xl
        bg-white p-6 shadow-sm">

        <h3 className="flex items-center gap-2 text-lg font-bold">
          <Upload size={21} className="text-violet-600" />
          Restore Full Backup
        </h3>

        <div className="flex items-start gap-2 rounded-xl
          bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={19} className="shrink-0" />
          <p>
            Restoring a file will replace current tracking data.
            Download a full backup before proceeding.
          </p>
        </div>

        <label className="block text-sm font-medium">
          Select JSON Backup File
          <input
            type="file"
            accept=".json,application/json"
            onChange={e => {
              setSelectedFile(e.target.files?.[0] || null);
              setAcknowledged(false);
              resetMessages();
            }}
            className="mt-3 block w-full rounded-xl
              border border-slate-200 p-3 text-sm"
          />
        </label>

        <label className="flex items-start gap-3 text-sm
          text-slate-700">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={e => setAcknowledged(e.target.checked)}
            className="mt-1 accent-emerald-600"
          />
          I understand that restore will replace my
          current saved tracking records.
        </label>

        <button
          type="button"
          disabled={!selectedFile || !acknowledged || busy}
          onClick={restoreBackup}
          className="flex items-center gap-2 rounded-xl
            bg-violet-600 px-5 py-3 text-sm font-semibold
            text-white hover:bg-violet-700
            disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload size={18} />
          {busy ? "Restoring..." : "Restore Backup"}
        </button>
      </section>

      {message && (
        <p className="rounded-xl bg-emerald-50 p-4
          text-sm text-emerald-700">
          {message}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4
          text-sm text-red-700">
          {error}
        </p>
      )}

      <p className="text-xs leading-5 text-slate-500">
        JSON is used for full recovery. CSV files are
        for viewing and reporting. Keep backup files
        private because they contain personal records.
      </p>
    </div>
  );
}
