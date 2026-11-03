
import { useState } from "react";
import {
  Settings2,
  Flame,
  Beef,
  Dumbbell,
  Scale,
  ListChecks,
  Save,
  RotateCcw
} from "lucide-react";

const STORAGE_KEY = "hlt_settings_v1";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

export const DEFAULT_SETTINGS = {
  calorieGoal: 2150,
  proteinMin: 60,
  proteinMax: 80,
  gymDays: [],
  gymStart: "18:30",
  gymEnd: "19:30",
  weighInDay: "",
  routineStart: ""
};

function loadSettings() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "{}"
    );

    if (!saved || typeof saved !== "object" ||
        Array.isArray(saved)) {
      return DEFAULT_SETTINGS;
    }

    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      gymDays: Array.isArray(saved.gymDays)
        ? saved.gymDays.filter(day => DAYS.includes(day))
        : []
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function createForm(settings) {
  return {
    ...settings,
    calorieGoal: String(settings.calorieGoal),
    proteinMin: String(settings.proteinMin),
    proteinMax: String(settings.proteinMax)
  };
}

export default function SettingsPage({ onSave }) {
  const [form, setForm] = useState(() =>
    createForm(loadSettings())
  );

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateField(field, value) {
    setForm(previous => ({
      ...previous,
      [field]: value
    }));
    setMessage("");
    setError("");
  }

  function toggleGymDay(day) {
    const updated = form.gymDays.includes(day)
      ? form.gymDays.filter(item => item !== day)
      : [...form.gymDays, day];

    updateField("gymDays", updated);
  }

  function saveSettings(e) {
    e.preventDefault();

    const calorieGoal = Number(form.calorieGoal);
    const proteinMin = Number(form.proteinMin);
    const proteinMax = Number(form.proteinMax);

    if (
      !Number.isFinite(calorieGoal) ||
      calorieGoal < 500 ||
      calorieGoal > 10000 ||
      !Number.isFinite(proteinMin) ||
      !Number.isFinite(proteinMax) ||
      proteinMin < 0 ||
      proteinMax < proteinMin ||
      proteinMax > 500
    ) {
      setError("Please enter valid calorie and protein goals.");
      return;
    }

    if (form.gymStart >= form.gymEnd) {
      setError("Gym end time must be after start time.");
      return;
    }

    const settings = {
      ...form,
      calorieGoal,
      proteinMin,
      proteinMax
    };

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(settings)
      );
      onSave?.(settings);
      setError("");
      setMessage("Settings saved successfully!");
    } catch {
      setError("Could not save settings to browser storage.");
    }
  }

  function resetForm() {
    setForm(createForm(DEFAULT_SETTINGS));
    setMessage("Default values loaded. Click Save Settings to apply.");
    setError("");
  }

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-200 " +
    "bg-white p-3 text-sm outline-none " +
    "focus:border-emerald-500";

  return (
    <div className="space-y-6">

      {/* PAGE HEADER */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-emerald-50 p-3">
          <Settings2 className="text-emerald-600" size={26} />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Personal Settings
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Customize your health and lifestyle goals.
          </p>
        </div>
      </div>

      <form onSubmit={saveSettings} className="space-y-6">

        {/* NUTRITION SETTINGS */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Flame className="text-orange-600" size={21} />
            Nutrition Goals
          </h3>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-medium">
              Daily Calories (kcal)
              <input
                type="number"
                min="500"
                max="10000"
                required
                value={form.calorieGoal}
                onChange={e =>
                  updateField("calorieGoal", e.target.value)
                }
                className={inputClass}
              />
            </label>

            <label className="block text-sm font-medium">
              Minimum Protein (g)
              <input
                type="number"
                min="0"
                max="500"
                required
                value={form.proteinMin}
                onChange={e =>
                  updateField("proteinMin", e.target.value)
                }
                className={inputClass}
              />
            </label>

            <label className="block text-sm font-medium">
              Maximum Protein (g)
              <input
                type="number"
                min="0"
                max="500"
                required
                value={form.proteinMax}
                onChange={e =>
                  updateField("proteinMax", e.target.value)
                }
                className={inputClass}
              />
            </label>
          </div>
        </section>

        {/* GYM SETTINGS */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Dumbbell className="text-violet-600" size={21} />
            Gym Schedule
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Select your planned workout days.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {DAYS.map(day => {
              const selected = form.gymDays.includes(day);

              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleGymDay(day)}
                  className={`rounded-xl px-4 py-2.5
                    text-sm font-medium transition
                    ${selected
                      ? "bg-violet-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Gym Start Time
              <input
                type="time"
                required
                value={form.gymStart}
                onChange={e =>
                  updateField("gymStart", e.target.value)
                }
                className={inputClass}
              />
            </label>

            <label className="block text-sm font-medium">
              Gym End Time
              <input
                type="time"
                required
                value={form.gymEnd}
                onChange={e =>
                  updateField("gymEnd", e.target.value)
                }
                className={inputClass}
              />
            </label>
          </div>
        </section>

        {/* WEEKLY WEIGHT */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Scale className="text-emerald-600" size={21} />
            Weekly Weight Tracking
          </h3>

          <label className="mt-5 block max-w-sm text-sm font-medium">
            Preferred Weigh-In Day
            <select
              value={form.weighInDay}
              onChange={e =>
                updateField("weighInDay", e.target.value)
              }
              className={inputClass}
            >
              <option value="">Not selected</option>
              {DAYS.map(day => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </label>

          <p className="mt-3 text-xs text-slate-500">
            Your weight will still be recorded once per
            calendar week.
          </p>
        </section>

        {/* ROUTINE PREFERENCES */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <ListChecks className="text-blue-600" size={21} />
            Daily Routine Preferences
          </h3>

          <label className="mt-5 block max-w-sm text-sm font-medium">
            Planned Daily Routine Start Time
            <input
              type="time"
              value={form.routineStart}
              onChange={e =>
                updateField("routineStart", e.target.value)
              }
              className={inputClass}
            />
          </label>

          <p className="mt-3 text-xs text-slate-500">
            You can continue adding custom habits in
            the Daily Routine module.
          </p>
        </section>

        {/* ACTIONS */}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="flex items-center gap-2 rounded-xl
              bg-emerald-600 px-6 py-3 text-sm font-semibold
              text-white hover:bg-emerald-700"
          >
            <Save size={18} />
            Save Settings
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="flex items-center gap-2 rounded-xl
              bg-slate-100 px-5 py-3 text-sm
              font-medium text-slate-700"
          >
            <RotateCcw size={17} />
            Reset Form
          </button>
        </div>

        {message && (
          <p role="status" className="rounded-xl bg-emerald-50
            p-4 text-sm text-emerald-800">
            {message}
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50
            p-4 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
