
import { Dumbbell, ArrowRight } from "lucide-react";

const STORAGE_KEY = "hlt_workouts_v1";

function getToday() {
  const d = new Date();

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}

function getTodayWorkouts() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    if (!Array.isArray(saved)) return [];

    return saved.filter(
      item => item && item.date === getToday()
    );
  } catch {
    return [];
  }
}

export default function WorkoutSummaryCard({ onOpen }) {
  const workouts = getTodayWorkouts();

  const totalExercises = workouts.length;

  const totalSets = workouts.reduce(
    (sum, item) => sum + Number(item.sets || 0),
    0
  );

  const totalVolume = workouts.reduce(
    (sum, item) =>
      sum +
      Number(item.sets || 0) *
      Number(item.reps || 0) *
      Number(item.weight || 0),
    0
  );

  return (
    <section className="rounded-2xl border
      border-slate-100 bg-white p-6 shadow-sm">

      <div className="flex flex-wrap items-center
        justify-between gap-4">

        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-50 p-3">
            <Dumbbell
              size={24}
              className="text-violet-600"
            />
          </div>

          <div>
            <h3 className="font-bold text-slate-900">
              Today's Workout
            </h3>

            <p className="text-sm text-slate-500">
              Your daily gym activity
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="flex items-center gap-2
            rounded-xl bg-violet-50 px-4 py-2
            text-sm font-semibold text-violet-700
            hover:bg-violet-100"
        >
          Open Gym
          <ArrowRight size={17} />
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">

        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">
            Exercises
          </p>
          <h4 className="mt-2 text-2xl font-bold
            text-violet-700">
            {totalExercises}
          </h4>
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">
            Total Sets
          </p>
          <h4 className="mt-2 text-2xl font-bold
            text-blue-700">
            {totalSets}
          </h4>
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">
            Volume (kg)
          </p>
          <h4 className="mt-2 break-words text-xl
            font-bold text-emerald-700">
            {totalVolume.toLocaleString()}
          </h4>
        </div>

      </div>

      <p className="mt-4 text-xs text-slate-500">
        {totalExercises > 0
          ? "Your workout records are saved for today."
          : "No workout logged today. Start by adding an exercise."}
      </p>
    </section>
  );
}
