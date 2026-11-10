import { useEffect, useState } from "react";
import {
  PLANNER_UPDATED_EVENT, SKILLS_KEY, TIMETABLE_KEY, SESSION_CHECKS_KEY,
  localPlannerDate, readPlannerForBackup, summarizePlannerOnDate,
} from "../utils/routinePlannerData";

function readSummary() {
  try {
    return { summary: summarizePlannerOnDate(localPlannerDate(), readPlannerForBackup()), error: "" };
  } catch (err) {
    return { summary: null, error: err.message || "Cannot load planner data." };
  }
}

export default function PlannerDashboardCard({ onOpen }) {
  const [current, setCurrent] = useState(readSummary);
  useEffect(() => {
    const refresh = () => setCurrent(readSummary());
    const onStorage = (e) => {
      if (!e.key || [SKILLS_KEY, TIMETABLE_KEY, SESSION_CHECKS_KEY].includes(e.key)) refresh();
    };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener(PLANNER_UPDATED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener(PLANNER_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);
  const s = current.summary;
  return (
    <button type="button" onClick={onOpen}
      className="w-full rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition hover:border-emerald-200 hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Skills & Timetable</h3>
          <p className="mt-1 text-xs text-slate-500">Inside Daily Routine · Saved on this device</p>
        </div>
        <span className="text-xl text-slate-400" aria-hidden="true">›</span>
      </div>
      {current.error ? <p role="alert" className="mt-3 text-sm text-rose-700">{current.error}</p> : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Active skills</p>
              <p className="text-xl font-semibold text-slate-900">{s.activeSkills} / {s.skills}</p>
              <p className="mt-1 text-xs text-slate-500">Roadmap {s.roadmapDone}/{s.roadmapTotal} steps</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3">
              <p className="text-xs text-emerald-800">Today's sessions</p>
              <p className="text-xl font-semibold text-emerald-900">{s.sessionDone} / {s.sessionTotal}</p>
              <p className="mt-1 text-xs text-emerald-800">Completed / scheduled</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar"
            aria-label="Permanent skill roadmap completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.roadmapPercent}>
            <div className="h-full rounded-full bg-emerald-500" style={{width:`${s.roadmapPercent}%`}} />
          </div>
          <p className="mt-2 text-xs text-slate-500">Skill roadmap: {s.roadmapPercent}% completed (permanent progress)</p>
        </>
      )}
    </button>
  );
}
