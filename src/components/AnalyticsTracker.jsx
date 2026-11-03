
import { useMemo, useState } from "react";
import {
  ChartNoAxesCombined,
  RefreshCw,
  Flame,
  Beef,
  ListChecks,
  Dumbbell,
  Scale
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";
import { defaultTasks } from "./RoutineTracker";

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function loadData() {
  const foods = readStorage("hlt_food_entries_v1", []);
  const workouts = readStorage("hlt_workouts_v1", []);
  const weights = readStorage("hlt_weekly_weight_v1", []);
  const routine = readStorage("hlt_daily_routine_v1", {});
  const custom = readStorage("hlt_custom_tasks_v1", []);

  return {
    foods: Array.isArray(foods) ? foods : [],
    workouts: Array.isArray(workouts) ? workouts : [],
    weights: Array.isArray(weights) ? weights : [],
    routine: routine && typeof routine === "object" &&
      !Array.isArray(routine) ? routine : {},
    custom: Array.isArray(custom) ? custom : []
  };
}

function toISO(d) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}

function mondayOf(d) {
  const result = new Date(
    d.getFullYear(), d.getMonth(), d.getDate(), 12
  );

  result.setDate(
    result.getDate() - ((result.getDay() + 6) % 7)
  );

  return result;
}

function periodKey(date, range) {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) return null;

  if (range === "daily") return date;
  if (range === "monthly") return date.slice(0, 7);

  return toISO(mondayOf(new Date(`${date}T12:00:00`)));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function makePeriods(range) {
  const count =
    range === "daily" ? 7 :
    range === "weekly" ? 8 : 6;

  const today = new Date();

  return Array.from({ length: count }, (_, i) => {
    const offset = count - 1 - i;
    let d;

    if (range === "daily") {
      d = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - offset,
        12
      );
    } else if (range === "weekly") {
      d = mondayOf(today);
      d.setDate(d.getDate() - offset * 7);
    } else {
      d = new Date(
        today.getFullYear(),
        today.getMonth() - offset,
        1,
        12
      );
    }

    const key = range === "monthly"
      ? toISO(d).slice(0, 7)
      : toISO(d);

    const label = range === "monthly"
      ? d.toLocaleDateString("en-IN", {
          month: "short",
          year: "2-digit"
        })
      : d.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short"
        });

    return {
      key,
      label,
      calories: 0,
      protein: 0,
      foodDates: new Set(),
      exerciseCount: 0,
      volume: 0,
      routineSum: 0,
      routineDays: 0,
      weight: null
    };
  });
}

function calculateAnalytics(data, range) {
  const periods = makePeriods(range);

  const buckets = new Map(
    periods.map(period => [period.key, period])
  );

  // NUTRITION
  for (const food of data.foods) {
    const bucket = buckets.get(periodKey(food.date, range));
    if (!bucket) continue;

    bucket.calories += Number(food.calories) || 0;
    bucket.protein += Number(food.protein) || 0;
    bucket.foodDates.add(food.date);
  }

  // GYM
  for (const workout of data.workouts) {
    const bucket = buckets.get(
      periodKey(workout.date, range)
    );

    if (!bucket) continue;

    bucket.exerciseCount += 1;
    bucket.volume +=
      (Number(workout.sets) || 0) *
      (Number(workout.reps) || 0) *
      (Number(workout.weight) || 0);
  }

  // DAILY ROUTINE
  const taskIds = new Set(
    [...defaultTasks, ...data.custom].map(task => task.id)
  );

  for (const [date, completed] of Object.entries(data.routine)) {
    const bucket = buckets.get(periodKey(date, range));

    if (!bucket || !Array.isArray(completed)) continue;

    const validCompleted = completed.filter(
      id => taskIds.has(id)
    ).length;

    const percentage = taskIds.size
      ? (validCompleted / taskIds.size) * 100
      : 0;

    bucket.routineSum += percentage;
    bucket.routineDays += 1;
  }

  // WEEKLY WEIGHT
  const sortedWeights = [...data.weights].sort(
    (a, b) => (a.date || "").localeCompare(b.date || "")
  );

  for (const entry of sortedWeights) {
    const bucket = buckets.get(
      periodKey(entry.date, range)
    );

    const weight = Number(entry.weight);

    if (bucket && Number.isFinite(weight) && weight > 0) {
      bucket.weight = weight;
    }
  }

  return periods.map(period => {
    const foodDays = period.foodDates.size;

    return {
      key: period.key,
      label: period.label,
      foodDays,
      calories: foodDays
        ? round1(period.calories) : null,
      protein: foodDays
        ? round1(period.protein) : null,
      exerciseCount: period.exerciseCount,
      volume: period.exerciseCount
        ? round1(period.volume) : null,
      routineDays: period.routineDays,
      routineSum: period.routineSum,
      routine: period.routineDays
        ? round1(period.routineSum / period.routineDays)
        : null,
      weight: period.weight
    };
  });
}

function MetricChart({
  title,
  description,
  data,
  dataKey,
  unit,
  color,
  type = "bar"
}) {
  const hasData = data.some(
    item => item[dataKey] !== null &&
      item[dataKey] !== undefined
  );

  const axes = (
    <>
      <CartesianGrid
        strokeDasharray="4 4"
        stroke="#e2e8f0"
        vertical={false}
      />
      <XAxis
        dataKey="label"
        tick={{ fontSize: 11 }}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        width={45}
        tick={{ fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        domain={dataKey === "routine"
          ? [0, 100] : ["auto", "auto"]}
      />
      <Tooltip
        formatter={value => [
          `${Number(value).toLocaleString("en-IN", {
            maximumFractionDigits: 1
          })}${unit}`,
          title
        ]}
      />
    </>
  );

  return (
    <section className="min-w-0 rounded-2xl
      bg-white p-5 shadow-sm sm:p-6">

      <h3 className="font-bold text-slate-900">
        {title}
      </h3>

      <p className="mt-1 text-xs text-slate-500">
        {description}
      </p>

      {!hasData ? (
        <div className="mt-5 flex h-56 items-center
          justify-center rounded-xl bg-slate-50 p-5">
          <p className="text-center text-sm text-slate-500">
            No recorded data for this period.
          </p>
        </div>
      ) : (
        <div className="mt-6 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {type === "line" ? (
              <LineChart data={data}>
                {axes}
                <Line
                  type="monotone"
                  dataKey={dataKey}
                  name={title}
                  stroke={color}
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
              </LineChart>
            ) : (
              <BarChart data={data}>
                {axes}
                <Bar
                  dataKey={dataKey}
                  name={title}
                  fill={color}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={42}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

export default function AnalyticsTracker() {
  const [range, setRange] = useState("daily");
  const [savedData, setSavedData] = useState(loadData);

  const chartData = useMemo(
    () => calculateAnalytics(savedData, range),
    [savedData, range]
  );

  const sum = key => chartData.reduce(
    (total, item) => total + (Number(item[key]) || 0),
    0
  );

  const loggedFoodDays = sum("foodDays");
  const recordedRoutineDays = sum("routineDays");

  const avgCalories = loggedFoodDays
    ? Math.round(sum("calories") / loggedFoodDays)
    : null;

  const avgProtein = loggedFoodDays
    ? round1(sum("protein") / loggedFoodDays)
    : null;

  const avgRoutine = recordedRoutineDays
    ? Math.round(sum("routineSum") / recordedRoutineDays)
    : null;

  const exerciseCount = sum("exerciseCount");

  const latestWeight = [...savedData.weights]
    .filter(item =>
      item.date &&
      item.date <= toISO(new Date())
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);

  const summaryCards = [
    {
      label: "Average Calories",
      value: avgCalories === null
        ? "—" : `${avgCalories} kcal`,
      icon: Flame,
      color: "text-orange-600",
      bg: "bg-orange-50"
    },
    {
      label: "Average Protein",
      value: avgProtein === null
        ? "—" : `${avgProtein} g`,
      icon: Beef,
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    {
      label: "Routine Completion",
      value: avgRoutine === null
        ? "—" : `${avgRoutine}%`,
      icon: ListChecks,
      color: "text-emerald-600",
      bg: "bg-emerald-50"
    },
    {
      label: "Exercise Entries",
      value: exerciseCount,
      icon: Dumbbell,
      color: "text-violet-600",
      bg: "bg-violet-50"
    },
    {
      label: "Latest Weight",
      value: latestWeight
        ? `${latestWeight.weight} kg` : "—",
      icon: Scale,
      color: "text-pink-600",
      bg: "bg-pink-50"
    }
  ];

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex flex-wrap items-center
        justify-between gap-4">

        <div>
          <div className="flex items-center gap-2">
            <ChartNoAxesCombined
              className="text-emerald-600"
              size={26}
            />
            <h2 className="text-2xl font-bold text-slate-900">
              Analytics
            </h2>
          </div>

          <p className="mt-2 text-sm text-slate-500">
            Your nutrition, fitness and lifestyle trends.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setSavedData(loadData())}
          className="flex items-center gap-2 rounded-xl
            border border-slate-200 bg-white
            px-4 py-2.5 text-sm font-medium
            hover:bg-slate-50"
        >
          <RefreshCw size={17} />
          Refresh Data
        </button>
      </div>

      {/* TIME FILTERS */}
      <div className="flex flex-wrap gap-2
        rounded-2xl bg-white p-4 shadow-sm">

        {[
          { id: "daily", name: "Daily", detail: "7 days" },
          { id: "weekly", name: "Weekly", detail: "8 weeks" },
          { id: "monthly", name: "Monthly", detail: "6 months" }
        ].map(option => (
          <button
            type="button"
            key={option.id}
            onClick={() => setRange(option.id)}
            className={`rounded-xl px-4 py-2.5
              text-sm font-semibold transition
              ${range === option.id
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {option.name}
            <span className="ml-2 text-xs opacity-75">
              {option.detail}
            </span>
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      <div className="grid grid-cols-2 gap-4
        md:grid-cols-3 xl:grid-cols-5">

        {summaryCards.map(item => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="min-w-0 rounded-2xl
                bg-white p-5 shadow-sm"
            >
              <div className={`inline-flex rounded-xl
                p-2.5 ${item.bg}`}>
                <Icon className={item.color} size={21} />
              </div>

              <p className="mt-4 text-xs text-slate-500">
                {item.label}
              </p>

              <h3 className="mt-2 break-words
                text-xl font-bold text-slate-900">
                {item.value}
              </h3>
            </div>
          );
        })}
      </div>

      {/* ANALYTICS GRAPHS */}
      <div className="grid gap-5 xl:grid-cols-2">

        <MetricChart
          title="Calorie Intake"
          description="Total calories per selected period"
          data={chartData}
          dataKey="calories"
          unit=" kcal"
          color="#059669"
        />

        <MetricChart
          title="Protein Intake"
          description="Total protein per selected period"
          data={chartData}
          dataKey="protein"
          unit=" g"
          color="#2563eb"
        />

        <MetricChart
          title="Daily Routine Completion"
          description="Average completion on recorded days"
          data={chartData}
          dataKey="routine"
          unit="%"
          color="#0d9488"
          type="line"
        />

        <MetricChart
          title="Gym Lifting Volume"
          description="Total logged lifting volume"
          data={chartData}
          dataKey="volume"
          unit=" kg"
          color="#7c3aed"
        />

        <MetricChart
          title="Body Weight Progress"
          description="Recorded weekly body weight"
          data={chartData}
          dataKey="weight"
          unit=" kg"
          color="#db2777"
          type="line"
        />

      </div>

      <div className="rounded-xl bg-slate-100 p-4
        text-xs leading-6 text-slate-600">
        Nutrition averages use only days with food entries.
        Routine averages use days with saved checklist activity.
        A missing record is not treated as a zero measurement.
        Weight measurements remain weekly.
        Historical routine percentages use your current task list.
      </div>

    </div>
  );
}
