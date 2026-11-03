import WorkoutSummaryCard from "./components/WorkoutSummaryCard";
import WeightTracker from "./components/WeightTracker";
import AnalyticsTracker from "./components/AnalyticsTracker";
import WorkoutTracker from "./components/WorkoutTracker";
import BackupManager from "./components/BackupManager";
import RoutineSummaryCard from "./components/RoutineSummaryCard";
import RoutineTracker from "./components/RoutineTracker";
import { useState, useEffect } from "react";


import NutritionTracker from "./components/NutritionTracker";
import SettingsPage, {
  DEFAULT_SETTINGS
} from "./components/SettingsPage";
import { Settings2 } from "lucide-react";



import {
  HeartPulse,
  LayoutDashboard,
  Utensils,
  ListChecks,
  Dumbbell,
  Scale,
  ChartColumn,
  Blocks,
  Menu,
  X,
  Flame,
  Beef,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  Target,
  Sparkles,
  Download ,
  ArrowLeft
} from "lucide-react";

const modules = [
  {
    id: "nutrition",
    title: "Diet & Nutrition",
    description: "Calories, protein, meals",
    icon: Utensils,
    color: "text-orange-600",
    bg: "bg-orange-50",
    features: [
      "Daily food logging",
      "Calorie and protein calculator",
      "Meal history"
    ]
  },
  {
    id: "routine",
    title: "Daily Routine",
    description: "Tasks, habits, checklist",
    icon: ListChecks,
    color: "text-blue-600",
    bg: "bg-blue-50",
    features: [
      "Daily task checklist",
      "Custom habits",
      "Routine completion history"
    ]
  },
  {
    id: "gym",
    title: "Gym & Fitness",
    description: "Exercises, sets, reps",
    icon: Dumbbell,
    color: "text-violet-600",
    bg: "bg-violet-50",
    features: [
      "Workout logging",
      "Sets, reps and weights",
      "Workout progress"
    ]
  },
  {
    id: "weight",
    title: "Weight Tracking",
    description: "Weight history, progress",
    icon: Scale,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    features: [
      "Body weight entries",
      "Weight history",
      "Goal tracking"
    ]
  },
  {
    id: "analytics",
    title: "Analytics",
    description: "Daily, weekly, monthly graphs",
    icon: ChartColumn,
    color: "text-pink-600",
    bg: "bg-pink-50",
    features: [
      "Nutrition analytics",
      "Routine completion trends",
      "Fitness and weight graphs"
    ]
  },
  {
    id: "future",
    title: "Future Modules",
    description: "Sleep, water, study & more",
    icon: Blocks,
    color: "text-cyan-600",
    bg: "bg-cyan-50",
    features: [
      "Sleep tracking",
      "Water intake",
      "Study hours and custom modules"
    ]
  },
  {
    id: "backup",
    title: "Backup & Export",
    description: "Save, restore and export your data",
    icon: Download,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    features: [
      "Full JSON backup",
      "CSV reports",
      "Restore saved records"
    ]
  },

{
  id: "settings",
  title: "Settings",
  description: "Personal goals and preferences",
  icon: Settings2,
  color: "text-slate-700",
  bg: "bg-slate-100",
  features: [
    "Nutrition goals",
    "Gym schedule",
    "Weekly weigh-in day",
    "Daily routine preferences"
  ]
}

];

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

const [appSettings, setAppSettings] = useState(() => {
  try {
    const saved = JSON.parse(
      localStorage.getItem("hlt_settings_v1") || "{}"
    );

    return saved &&
      typeof saved === "object" &&
      !Array.isArray(saved)
        ? { ...DEFAULT_SETTINGS, ...saved }
        : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
});


const [foodEntries, setFoodEntries] = useState(() => {
  try {
    const saved = JSON.parse(
      localStorage.getItem("hlt_food_entries_v1") || "[]"
    );
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
});

useEffect(() => {
  try {
    localStorage.setItem(
      "hlt_food_entries_v1",
      JSON.stringify(foodEntries)
    );
  } catch (error) {
    console.error("Could not save food entries:", error);
  }
}, [foodEntries]);

const now = new Date();
const today = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0")
].join("-");

const todayEntries = foodEntries.filter(
  entry => entry.date === today
);

const caloriesToday = todayEntries.reduce(
  (sum, entry) => sum + entry.calories, 0
);

const proteinToday = todayEntries.reduce(
  (sum, entry) => sum + entry.protein, 0
);

const [weightEntries, setWeightEntries] = useState(() => {
  try {
    const saved = JSON.parse(
      localStorage.getItem("hlt_weekly_weight_v1") || "[]"
    );
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
});

const [weightTarget, setWeightTarget] = useState(() => {
  try {
    return localStorage.getItem("hlt_weight_target_v1") ?? "";
  } catch {
    return "";
  }
});

useEffect(() => {
  try {
    localStorage.setItem(
      "hlt_weekly_weight_v1",
      JSON.stringify(weightEntries)
    );
  } catch (error) {
    console.error("Weight storage error:", error);
  }
}, [weightEntries]);

useEffect(() => {
  try {
    localStorage.setItem(
      "hlt_weight_target_v1",
      weightTarget
    );
  } catch (error) {
    console.error("Target storage error:", error);
  }
}, [weightTarget]);

const latestWeight = [...weightEntries]
  .filter(item => item.date <= today)
  .sort((a, b) => a.date.localeCompare(b.date))
  .at(-1);



  const navigate = (page) => {
    setActivePage(page);
    setMenuOpen(false);
  };

  const activeModule = modules.find(
    (module) => module.id === activePage
  );

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-800">

      {menuOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
        />
      )}

      <div className="flex min-h-screen">

        {/* SIDEBAR */}
        
<aside
  className={`fixed inset-y-0 left-0 z-50
    flex w-[min(18rem,88vw)] flex-col
    overflow-y-auto overscroll-contain
    border-r border-slate-200 bg-white p-5
    transition-transform duration-200
    lg:sticky lg:top-0 lg:h-screen
    lg:w-72 lg:translate-x-0
    ${menuOpen
      ? "translate-x-0"
      : "-translate-x-full"}`}
>


          <div className="mb-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-600 p-2.5 text-white">
                <HeartPulse size={25} />
              </div>

              <div>
                <h1 className="text-sm font-bold text-slate-900">
                  Health & Lifestyle
                </h1>
                <p className="text-xs text-slate-500">
                  Tracking
                </p>
              </div>
            </div>

            <button
              onClick={() => setMenuOpen(false)}
              className="lg:hidden"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          <p className="mb-3 px-3 text-xs font-semibold
                        uppercase tracking-wider text-slate-400">
            Workspace
          </p>

          <nav className="flex-1 space-y-1">

            <button
              onClick={() => navigate("dashboard")}
              className={`flex w-full items-center gap-3 rounded-xl
                px-4 py-3 text-left text-sm font-medium transition
                ${activePage === "dashboard"
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-600 hover:bg-slate-50"}`}
            >
              <LayoutDashboard size={19} />
              Dashboard
            </button>

            {modules.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl
                    px-4 py-3 text-left text-sm font-medium transition
                    ${activePage === item.id
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <Icon size={19} />
                  {item.title}
                </button>
              );
            })}

          </nav>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-emerald-800">
              <Sparkles size={17} />
              <span className="text-sm font-semibold">
                Personal Workspace
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-emerald-700">
              Build healthy habits and track your progress
              in one place.
            </p>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="min-w-0 flex-1">

          {/* TOP HEADER */}
          
<header
  className="sticky top-0 z-30
    flex min-h-20 items-center justify-between
    gap-3 border-b border-slate-200
    bg-white/95 px-4 py-3
    backdrop-blur sm:px-8"
>


            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <button
                onClick={() => setMenuOpen(true)}
                className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
                aria-label="Open menu"
              >
                <Menu size={23} />
              </button>

{/* BACK TO DASHBOARD BUTTON */}
{activePage !== "dashboard" && (
  <button
    type="button"
    onClick={() => navigate("dashboard")}
    aria-label="Back to Dashboard"
    title="Back to Dashboard"
    className="flex shrink-0 items-center justify-center
      rounded-xl border border-slate-200 bg-white
      p-2.5 text-slate-700 transition
      hover:border-emerald-300 hover:bg-emerald-50
      hover:text-emerald-700"
  >
    <ArrowLeft size={20} />
  </button>
)}


              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {activeModule?.title || "Dashboard"}
                </h2>
                <p className="text-xs text-slate-500">
                  Your Personal Daily Life Dashboard
                </p>
              </div>
            </div>

            <span className="rounded-full bg-emerald-50
              px-3 py-1.5 text-xs font-semibold text-emerald-700">
              Phase 1
            </span>
          </header>

          <div className="mx-auto max-w-7xl space-y-6 p-4 sm:space-y-8 sm:p-6 lg:p-8">

            {activePage === "dashboard" ? (
              <>
                {/* WELCOME SECTION */}
                <div className="rounded-3xl bg-gradient-to-r
                  from-emerald-600 to-teal-500 p-7 text-white
                  sm:p-9">

                  <p className="text-sm text-emerald-100">
                    Welcome to your workspace
                  </p>

                  <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                    Your health. Your lifestyle.
                  </h2>

                  <p className="mt-3 max-w-xl text-sm
                    leading-6 text-emerald-50">
                    Track nutrition, daily routines, fitness,
                    body weight and everything that matters
                    to your personal growth.
                  </p>
                </div>

                {/* SUMMARY CARDS */}
                <div className="grid gap-5 md:grid-cols-3">

                  <div className="rounded-2xl border border-slate-100
                    bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-500">
                        Daily Calories
                      </p>
                      <Flame className="text-orange-500" size={22} />
                    </div>
                    <h3 className="mt-4 text-2xl font-bold">
                      {Math.round(caloriesToday)} kcal
                    </h3>
                    <p className="mt-2 text-xs text-slate-500">
                        Daily target: {appSettings.calorieGoal.toLocaleString("en-IN")} kcal
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-100
                    bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-500">
                        Daily Protein
                      </p>
                      <Beef className="text-blue-500" size={22} />
                    </div>
                    <h3 className="mt-4 text-2xl font-bold">
                       {Math.round(proteinToday * 10) / 10} g
                    </h3>
                    <p className="mt-2 text-xs text-slate-500">
                       Daily target: {appSettings.proteinMin}–{appSettings.proteinMax} g
                    </p>
                  </div>

                  
{/* BODY WEIGHT CARD */}
<div className="rounded-2xl border border-slate-100
  bg-white p-6 shadow-sm">

  <div className="flex items-center justify-between">
    <p className="text-sm text-slate-500">
      Body Weight
    </p>
    <Scale className="text-violet-500" size={22} />
  </div>

  <h3 className="mt-4 text-2xl font-bold">
    {latestWeight
      ? `${latestWeight.weight} kg`
      : "Not added"}
  </h3>

  <p className="mt-2 text-xs text-slate-500">
    {latestWeight
      ? `Last measured: ${latestWeight.date}`
      : "Add your first weekly weight"}
  </p>

</div>


                </div>

{/* DAILY ROUTINE SUMMARY */}
<RoutineSummaryCard
  onOpen={() => navigate("routine")}
/>

{/* GYM WORKOUT SUMMARY */}
<WorkoutSummaryCard
  onOpen={() => navigate("gym")}
/>



                {/* MODULES */}
                <section>
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">
                        Your Tracking Modules
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Everything organized in one place
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">

                    
{modules
  .filter((item) =>
    !["settings", "analytics", "backup"].includes(item.id)
  )
  .map((item) => {
    const Icon = item.icon;


                      return (
                        <button
                          key={item.id}
                          onClick={() => navigate(item.id)}
                          className="group rounded-2xl border
                            border-slate-100 bg-white p-6 text-left
                            shadow-sm transition hover:-translate-y-1
                            hover:shadow-lg"
                        >
                          <div className={`mb-5 inline-flex rounded-xl
                            p-3 ${item.bg} ${item.color}`}>
                            <Icon size={25} />
                          </div>

                          <h3 className="text-lg font-bold text-slate-900">
                            {item.title}
                          </h3>

                          <p className="mt-2 text-sm text-slate-500">
                            {item.description}
                          </p>

                          <div className="mt-6 flex items-center
                            justify-between border-t border-slate-100
                            pt-4 text-sm font-semibold text-emerald-700">
                            Open Module
                            <ArrowRight
                              size={18}
                              className="transition group-hover:translate-x-1"
                            />
                          </div>
                        </button>
                      );
                    })}

                  </div>
                </section>

                {/* GETTING STARTED */}
                <div className="rounded-2xl border border-emerald-100
                  bg-white p-6">
                  <div className="flex items-center gap-3">
                    <Target className="text-emerald-600" size={24} />
                    <h3 className="font-bold">
                      Getting Started
                    </h3>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Your dashboard layout is ready. Next, we will
                    connect the modules to real tracking features
                    and save your daily records.
                  </p>
                </div>
              </>
                        
        ) : activePage === "nutrition" ? (
          <NutritionTracker
            entries={foodEntries}
            setEntries={setFoodEntries}
            calorieGoal={appSettings.calorieGoal}
    proteinMin={appSettings.proteinMin}
    proteinMax={appSettings.proteinMax}
          />
          ) : activePage === "routine" ? (
  <RoutineTracker routineStart={appSettings.routineStart} />
  ) : activePage === "gym" ? (
  <WorkoutTracker gymDays={appSettings.gymDays}
    gymStart={appSettings.gymStart}
    gymEnd={appSettings.gymEnd} />
  ) : activePage === "weight" ? (
  <WeightTracker
    entries={weightEntries}
    setEntries={setWeightEntries}
    target={weightTarget}
    setTarget={setWeightTarget}
    weighInDay={appSettings.weighInDay}
  />
  ) : activePage === "analytics" ? (
  <AnalyticsTracker />
  ) : activePage === "backup" ? (
  <BackupManager />
  ) : activePage === "settings" ? (
  <SettingsPage onSave={setAppSettings} />
        
            ) : (
              /* MODULE DETAIL PAGE */
              <section className="space-y-6">

                <button
                  onClick={() => navigate("dashboard")}
                  className="flex items-center gap-2 text-sm
                    font-medium text-emerald-700 hover:underline"
                >
                  Dashboard
                  <ChevronRight size={16} />
                  {activeModule.title}
                </button>

                <div className="rounded-3xl border border-slate-100
                  bg-white p-7 shadow-sm sm:p-9">

                  <div className={`mb-6 inline-flex rounded-2xl
                    p-4 ${activeModule.bg} ${activeModule.color}`}>
                    <activeModule.icon size={30} />
                  </div>

                  <h2 className="text-2xl font-bold text-slate-900">
                    {activeModule.title}
                  </h2>

                  <p className="mt-2 text-slate-500">
                    {activeModule.description}
                  </p>

                  <div className="mt-8 border-t border-slate-100 pt-6">
                    <h3 className="mb-4 font-semibold">
                      Features planned for this module
                    </h3>

                    <div className="space-y-4">
                      {activeModule.features.map((feature) => (
                        <div
                          key={feature}
                          className="flex items-center gap-3"
                        >
                          <CheckCircle2
                            size={19}
                            className="text-emerald-500"
                          />
                          <span className="text-sm text-slate-600">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 rounded-xl bg-emerald-50 p-4">
                    <p className="text-sm text-emerald-800">
                      Module layout ready. Functional tracking
                      will be added in the next development steps.
                    </p>
                  </div>

                </div>

              </section>
            )}

          </div>
        </main>

      </div>
    </div>
  );
}

export default App;
