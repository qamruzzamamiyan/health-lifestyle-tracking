
import { useState, useEffect } from "react";
import { Scale, Target, Trash2, Plus } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";

// Format a local date as YYYY-MM-DD
function formatDate(d) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}

function getToday() {
  return formatDate(new Date());
}

// Monday is the first day of each tracking week
function getWeekStart(dateString) {
  const d = new Date(`${dateString}T12:00:00`);
  const daysFromMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysFromMonday);
  return formatDate(d);
}

function getWeekEnd(startString) {
  const d = new Date(`${startString}T12:00:00`);
  d.setDate(d.getDate() + 6);
  return formatDate(d);
}

export default function WeightTracker({
  entries,
  setEntries,
  target,
  setTarget,
   weighInDay = ""
}) {
  const [date, setDate] = useState(getToday);
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const weekStart = getWeekStart(date);

  const currentWeekEntry = entries.find(
    item => item.weekStart === weekStart
  );

  useEffect(() => {
    const record = entries.find(
      item => item.weekStart === weekStart
    );

    setWeight(record ? String(record.weight) : "");
    setNotes(record?.notes || "");
  }, [weekStart, entries]);

  const history = [...entries].sort(
    (a, b) => a.weekStart.localeCompare(b.weekStart)
  );

  const latest = history.at(-1);
  const previous = history.at(-2);

  const change = latest && previous
    ? Number((latest.weight - previous.weight).toFixed(2))
    : null;

  const targetNumber = Number(target);
  const validTarget =
    target !== "" &&
    Number.isFinite(targetNumber) &&
    targetNumber > 0 &&
    targetNumber <= 500;

  const chartData = history.map(item => ({
    week: item.weekStart,
    weight: item.weight
  }));

  function saveWeight(e) {
    e.preventDefault();

    const value = Number(weight);

    if (
      !date ||
      date > getToday() ||
      weight.trim() === "" ||
      !Number.isFinite(value) ||
      value <= 0 ||
      value > 500
    ) {
      setError("Enter a valid date and weight (0–500 kg).");
      return;
    }

    const record = {
      id: currentWeekEntry?.id || crypto.randomUUID(),
      weekStart,
      date,
      weight: value,
      notes: notes.trim()
    };

    setEntries(previousEntries => {
      const exists = previousEntries.some(
        item => item.weekStart === weekStart
      );

      return exists
        ? previousEntries.map(item =>
            item.weekStart === weekStart ? record : item
          )
        : [...previousEntries, record];
    });

    setError("");
    setMessage("Weekly weight saved successfully.");
  }

  function deleteEntry(id) {
    setEntries(previousEntries =>
      previousEntries.filter(item => item.id !== id)
    );
    setMessage("");
  }

  function editEntry(item) {
    setDate(item.date);
    setWeight(String(item.weight));
    setNotes(item.notes || "");
    setError("");
    setMessage("Update the details and click Save Weight.");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
          Weekly Weight Tracking
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Record your weight once per week and monitor progress.
        </p>

{/* WEEKLY WEIGH-IN PREFERENCE */}
{weighInDay && (
  <p className="mt-2 text-sm font-medium text-emerald-700">
    Preferred Weigh-In Day: {weighInDay}
  </p>
)}

      </div>

      {/* SUMMARY */}
      <div className="grid gap-4 sm:grid-cols-3">

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <Scale size={24} className="text-emerald-600" />
          <p className="mt-4 text-sm text-slate-500">
            Latest Weight
          </p>
          <h3 className="mt-2 text-2xl font-bold">
            {latest ? `${latest.weight} kg` : "Not added"}
          </h3>
          <p className="mt-2 text-xs text-slate-500">
            {latest?.date || "No measurements yet"}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <Target size={24} className="text-blue-600" />
          <p className="mt-4 text-sm text-slate-500">
            Target Weight
          </p>
          <h3 className="mt-2 text-2xl font-bold text-blue-700">
            {validTarget ? `${targetNumber} kg` : "Not set"}
          </h3>
          <p className="mt-2 text-xs text-slate-500">
            Your personal weight goal
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <Scale size={24} className="text-violet-600" />
          <p className="mt-4 text-sm text-slate-500">
            Change Since Previous Entry
          </p>
          <h3 className="mt-2 text-2xl font-bold text-violet-700">
            {change === null
              ? "—"
              : `${change > 0 ? "+" : ""}${change} kg`}
          </h3>
          <p className="mt-2 text-xs text-slate-500">
            Last two recorded weeks
          </p>
        </div>

      </div>

      {/* WEIGHT GOAL */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <Target size={20} className="text-emerald-600" />
          Set Weight Goal
        </h3>

        <label className="mt-4 block max-w-sm text-sm font-medium">
          Target Weight (kg)
          <input
            type="number"
            min="0.1"
            max="500"
            step="0.1"
            value={target}
            onChange={e => setTarget(e.target.value)}
            placeholder="e.g. 55"
            className={inputClass}
          />
        </label>

        {validTarget && latest && (
          <p className="mt-3 text-sm text-emerald-700">
            {targetNumber === latest.weight
              ? "Your recorded weight matches your target."
              : `${Math.abs(
                  targetNumber - latest.weight
                ).toFixed(1)} kg ${
                  targetNumber > latest.weight
                    ? "to gain"
                    : "above target"
                }`}
          </p>
        )}

        <p className="mt-3 text-xs text-slate-500">
          Your target is saved automatically.
        </p>
      </section>

      {/* WEIGHT ENTRY */}
      <form
        onSubmit={saveWeight}
        className="space-y-5 rounded-2xl bg-white p-6 shadow-sm"
      >
        <h3 className="text-lg font-bold">
          Record Weekly Weight
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Measurement Date
            <input
              type="date"
              required
              max={getToday()}
              value={date}
              onChange={e => {
                setDate(e.target.value);
                setMessage("");
              }}
              className={inputClass}
            />
          </label>

          <label className="block text-sm font-medium">
            Body Weight (kg)
            <input
              type="number"
              required
              min="0.1"
              max="500"
              step="0.01"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder="e.g. 50.5"
              className={inputClass}
            />
          </label>
        </div>

        <div className="rounded-xl bg-emerald-50 p-4 text-sm
          text-emerald-800">
          Tracking Week: {weekStart} to {getWeekEnd(weekStart)}
          <p className="mt-1 text-xs">
            {currentWeekEntry
              ? "This week already has an entry. Saving will update it."
              : "No measurement recorded for this week."}
          </p>
        </div>

        <label className="block text-sm font-medium">
          Notes (Optional)
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Morning, before breakfast"
            className={inputClass}
          />
        </label>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {message && (
          <p className="text-sm text-emerald-700">{message}</p>
        )}

        <button
          type="submit"
          className="flex items-center gap-2 rounded-xl
            bg-emerald-600 px-5 py-3 text-sm
            font-semibold text-white hover:bg-emerald-700"
        >
          <Plus size={18} />
          {currentWeekEntry ? "Update Weight" : "Save Weight"}
        </button>
      </form>

      {/* GRAPH */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold">
          Weekly Weight Progress
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Your weight history over recorded weeks
        </p>

        {chartData.length < 2 ? (
          <p className="mt-5 rounded-xl bg-slate-50 p-5
            text-sm text-slate-500">
            Add measurements for at least two different
            weeks to see your progress graph.
          </p>
        ) : (
          <div className="mt-6 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="#e2e8f0"
                />
                <XAxis
                  dataKey="week"
                  tickFormatter={v => v.slice(5)}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 11 }}
                  width={45}
                />
                <Tooltip
                  formatter={v => [`${v} kg`, "Weight"]}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  name="Weight"
                  stroke="#059669"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* HISTORY */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="mb-5 text-lg font-bold">
          Weekly Weight History
        </h3>

        {history.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-5
            text-sm text-slate-500">
            No weight records yet.
          </p>
        ) : (
          <div className="space-y-3">
            {[...history].reverse().map(item => (
              <div
                key={item.id}
                className="flex flex-wrap items-center
                  justify-between gap-3 rounded-xl
                  border border-slate-100 p-4"
              >
                <div>
                  <p className="font-semibold">
                    {item.weight} kg
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Measured: {item.date}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Week of {item.weekStart}
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
                    onClick={() => editEntry(item)}
                    className="rounded-lg bg-blue-50
                      px-3 py-2 text-sm text-blue-700"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteEntry(item.id)}
                    aria-label={`Delete weight for ${item.date}`}
                    className="rounded-lg bg-red-50
                      p-2 text-red-600"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        For consistency, weigh yourself on the same day
        each week, preferably in the morning under
        similar conditions.
      </p>
    </div>
  );
}
