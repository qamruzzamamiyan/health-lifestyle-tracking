
import { useState, useEffect } from "react";
import {
  Dumbbell,
  Plus,
  Pencil,
  Trash2,
  CalendarDays
} from "lucide-react";

const STORAGE_KEY = "hlt_workouts_v1";

const suggestedExercises = [
  "Push-up",
  "Pull-up",
  "Squat",
  "Bench Press",
  "Deadlift",
  "Shoulder Press",
  "Biceps Curl",
  "Triceps Extension",
  "Lat Pulldown",
  "Leg Press",
  "Plank"
];

const emptyForm = {
  exercise: "",
  sets: "3",
  reps: "10",
  weight: "0",
  notes: ""
};

function getToday() {
  const d = new Date();

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}

function loadWorkouts() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export default function WorkoutTracker({
  gymDays = [],
  gymStart = "18:30",
  gymEnd = "19:30"
}) {
  const [date, setDate] = useState(getToday);
  const [workouts, setWorkouts] = useState(loadWorkouts);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(workouts)
      );
    } catch (err) {
      console.error("Workout storage error:", err);
    }
  }, [workouts]);

  const dailyWorkouts = workouts
    .filter(item => item.date === date)
    .sort((a, b) => a.createdAt - b.createdAt);

  const totalExercises = dailyWorkouts.length;

  const totalSets = dailyWorkouts.reduce(
    (sum, item) => sum + item.sets,
    0
  );

  const totalVolume = dailyWorkouts.reduce(
    (sum, item) =>
      sum + item.sets * item.reps * item.weight,
    0
  );

  function updateField(field, value) {
    setForm(previous => ({
      ...previous,
      [field]: value
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
  }

  function saveWorkout(e) {
    e.preventDefault();

    const sets = Number(form.sets);
    const reps = Number(form.reps);
    const weight = Number(form.weight);

    if (
      !form.exercise.trim() ||
      !Number.isInteger(sets) ||
      !Number.isInteger(reps) ||
      sets <= 0 ||
      reps <= 0 ||
      form.weight.trim() === "" ||
      !Number.isFinite(weight) ||
      weight < 0
    ) {
      setError("Please enter valid workout details.");
      return;
    }

    const existing = workouts.find(
      item => item.id === editingId
    );

    const workout = {
      id: editingId || crypto.randomUUID(),
      date,
      exercise: form.exercise.trim(),
      sets,
      reps,
      weight,
      notes: form.notes.trim(),
      createdAt: existing?.createdAt || Date.now()
    };

    setWorkouts(previous =>
      editingId
        ? previous.map(item =>
            item.id === editingId ? workout : item
          )
        : [...previous, workout]
    );

    resetForm();
  }

  function editWorkout(item) {
    setEditingId(item.id);

    setForm({
      exercise: item.exercise,
      sets: String(item.sets),
      reps: String(item.reps),
      weight: String(item.weight),
      notes: item.notes || ""
    });

    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteWorkout(id) {
    setWorkouts(previous =>
      previous.filter(item => item.id !== id)
    );

    if (editingId === id) resetForm();
  }

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-200 " +
    "bg-white p-3 text-sm outline-none " +
    "focus:border-emerald-500";

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Gym & Fitness
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Track exercises, sets, reps and weights.
        </p>

{/* PERSONAL GYM SCHEDULE */}
<p className="mt-2 text-sm text-violet-700">
  Planned Gym Days: {gymDays.length > 0
    ? gymDays.join(", ")
    : "Not selected"}
</p>

<p className="mt-1 text-sm text-violet-700">
  Gym Timing: {gymStart} – {gymEnd}
</p>

      </div>

      {/* DATE SELECTOR */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <CalendarDays
            size={20}
            className="text-emerald-600"
          />
          <h3 className="font-semibold">Workout Date</h3>
        </div>

        <input
          type="date"
          value={date}
          onChange={e => {
            setDate(e.target.value);
            resetForm();
          }}
          className={inputClass}
        />
      </div>

      {/* WORKOUT SUMMARY */}
      <div className="grid gap-4 sm:grid-cols-3">

        {[
          {
            label: "Exercises Logged",
            value: totalExercises,
            color: "text-violet-600"
          },
          {
            label: "Total Sets",
            value: totalSets,
            color: "text-blue-600"
          },
          {
            label: "Lifting Volume",
            value: `${totalVolume.toLocaleString()} kg`,
            color: "text-emerald-600"
          }
        ].map(item => (
          <div
            key={item.label}
            className="rounded-2xl bg-white p-6 shadow-sm"
          >
            <p className="text-sm text-slate-500">
              {item.label}
            </p>

            <h3 className={`mt-3 text-2xl font-bold ${item.color}`}>
              {item.value}
            </h3>
          </div>
        ))}

      </div>

      {/* ADD WORKOUT FORM */}
      <form
        onSubmit={saveWorkout}
        className="space-y-5 rounded-2xl bg-white p-6 shadow-sm"
      >

        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-50 p-3">
            <Dumbbell
              size={23}
              className="text-violet-600"
            />
          </div>

          <h3 className="text-lg font-bold">
            {editingId ? "Edit Exercise" : "Add Exercise"}
          </h3>
        </div>

        <label className="block text-sm font-medium">
          Exercise Name

          <input
            list="exercise-suggestions"
            required
            value={form.exercise}
            onChange={e =>
              updateField("exercise", e.target.value)
            }
            placeholder="e.g. Bench Press"
            className={inputClass}
          />

          <datalist id="exercise-suggestions">
            {suggestedExercises.map(name => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>

        <div className="grid gap-4 sm:grid-cols-3">

          <label className="block text-sm font-medium">
            Sets
            <input
              type="number"
              min="1"
              step="1"
              required
              value={form.sets}
              onChange={e =>
                updateField("sets", e.target.value)
              }
              className={inputClass}
            />
          </label>

          <label className="block text-sm font-medium">
            Reps per Set
            <input
              type="number"
              min="1"
              step="1"
              required
              value={form.reps}
              onChange={e =>
                updateField("reps", e.target.value)
              }
              className={inputClass}
            />
          </label>

          <label className="block text-sm font-medium">
            Weight (kg)
            <input
              type="number"
              min="0"
              step="any"
              required
              value={form.weight}
              onChange={e =>
                updateField("weight", e.target.value)
              }
              className={inputClass}
            />
          </label>

        </div>

        <label className="block text-sm font-medium">
          Workout Notes (Optional)

          <textarea
            value={form.notes}
            onChange={e =>
              updateField("notes", e.target.value)
            }
            placeholder="e.g. Good form, increase weight next time"
            rows="3"
            className={inputClass}
          />
        </label>

        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">

          <button
            type="submit"
            className="flex items-center gap-2 rounded-xl
              bg-emerald-600 px-5 py-3
              text-sm font-semibold text-white
              hover:bg-emerald-700"
          >
            <Plus size={18} />
            {editingId ? "Update Exercise" : "Save Exercise"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl bg-slate-100
                px-5 py-3 text-sm"
            >
              Cancel Edit
            </button>
          )}
        </div>

      </form>

      {/* WORKOUT HISTORY */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="mb-5 text-lg font-bold">
          Workout History — {date}
        </h3>

        {dailyWorkouts.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-5
            text-sm text-slate-500">
            No workouts logged for this date.
          </p>
        ) : (
          <div className="space-y-3">

            {dailyWorkouts.map(item => (
              <div
                key={item.id}
                className="flex flex-wrap items-start
                  justify-between gap-4 rounded-xl
                  border border-slate-100 p-4"
              >

                <div>
                  <h4 className="font-semibold text-slate-900">
                    {item.exercise}
                  </h4>

                  <p className="mt-2 text-sm text-slate-500">
                    {item.sets} Sets × {item.reps} Reps
                    {" • "}{item.weight} kg
                  </p>

                  <p className="mt-1 text-xs text-emerald-700">
                    Volume: {(
                      item.sets * item.reps * item.weight
                    ).toLocaleString()} kg
                  </p>

                  {item.notes && (
                    <p className="mt-2 text-xs text-slate-500">
                      {item.notes}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">

                  <button
                    type="button"
                    onClick={() => editWorkout(item)}
                    aria-label={`Edit ${item.exercise}`}
                    className="rounded-lg bg-blue-50
                      p-2 text-blue-600"
                  >
                    <Pencil size={17} />
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteWorkout(item.id)}
                    aria-label={`Delete ${item.exercise}`}
                    className="rounded-lg bg-red-50
                      p-2 text-red-600"
                  >
                    <Trash2 size={17} />
                  </button>

                </div>

              </div>
            ))}

          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        Lifting volume = sets × reps × external weight.
        For bodyweight exercises entered as 0 kg,
        volume will show 0; this does not mean no effort.
        This version assumes the same reps and weight
        for every set.
      </p>

    </div>
  );
}
