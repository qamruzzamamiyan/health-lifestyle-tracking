/**
 * Daily Routine > Skills + Timetable. Device-only; no network or default records.
 * Separate keys avoid mutating existing Daily Routine/food/regular-meal storage.
 */
export const SKILLS_KEY = "hlt_routine_skills_v1";
export const TIMETABLE_KEY = "hlt_routine_timetable_v1";
export const SESSION_CHECKS_KEY = "hlt_routine_timetable_checks_v1";
export const PLANNER_UPDATED_EVENT = "hlt:routine-planner-updated";
export const PLANNER_VERSION = 1;

const isObject = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const isString = (x, max = 500) => typeof x === "string" && x.length <= max;
const nonEmpty = (x, max = 180) => isString(x, max) && x.trim().length > 0;
const unique = (values) => new Set(values).size === values.length;
const statusSet = new Set(["planned", "active", "paused", "completed"]);
const repeatSet = new Set(["daily", "weekly", "once", "flexible"]);
const linkSet = new Set(["none", "task", "skill"]);

export function validPlannerDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [year, month, day] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() + 1 === month && dt.getUTCDate() === day;
}
export function localPlannerDate(now = new Date()) {
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}
export function makePlannerId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
export function emptyPlanner() {
  return { version: PLANNER_VERSION, skills: [], schedules: [], sessionChecksByDay: {} };
}
export function validatePlannerBackup(data) {
  if (!isObject(data) || data.version !== PLANNER_VERSION ||
      !Array.isArray(data.skills) || !Array.isArray(data.schedules) ||
      !isObject(data.sessionChecksByDay)) {
    throw new Error("Invalid or unsupported Skills/Timetable backup.");
  }
  const ids = [];
  for (const skill of data.skills) {
    if (!isObject(skill) || !nonEmpty(skill.id) || !nonEmpty(skill.title, 100) ||
        !isString(skill.description ?? "", 1000) || !statusSet.has(skill.status) ||
        !Array.isArray(skill.roadmaps) ||
        (skill.targetDate && !validPlannerDate(skill.targetDate))) {
      throw new Error("Invalid skill record.");
    }
    ids.push(skill.id);
    for (const roadmap of skill.roadmaps) {
      if (!isObject(roadmap) || !nonEmpty(roadmap.id) ||
          !nonEmpty(roadmap.title, 120) || !Array.isArray(roadmap.phases)) {
        throw new Error("Invalid skill roadmap.");
      }
      ids.push(roadmap.id);
      for (const phase of roadmap.phases) {
        if (!isObject(phase) || !nonEmpty(phase.id) || !nonEmpty(phase.title, 120) ||
            !Array.isArray(phase.steps)) throw new Error("Invalid roadmap phase.");
        ids.push(phase.id);
        for (const step of phase.steps) {
          if (!isObject(step) || !nonEmpty(step.id) || !nonEmpty(step.title, 220) ||
              typeof step.done !== "boolean" ||
              (step.completedAt !== null && step.completedAt !== undefined &&
               (typeof step.completedAt !== "string" || !Number.isFinite(Date.parse(step.completedAt))))) {
            throw new Error("Invalid permanent roadmap checklist step.");
          }
          ids.push(step.id);
        }
      }
    }
  }
  if (!unique(ids)) throw new Error("Duplicate Skills/Roadmap identifiers.");
  const scheduleIds = [];
  for (const schedule of data.schedules) {
    if (!isObject(schedule) || !nonEmpty(schedule.id) || !nonEmpty(schedule.title, 120) ||
        !repeatSet.has(schedule.repeat) || !linkSet.has(schedule.linkType) ||
        !isString(schedule.linkId ?? "", 180) || !isString(schedule.roadmapId ?? "", 180) ||
        !isString(schedule.notes ?? "", 1500) ||
        !/^\d{2}:\d{2}$/.test(schedule.start || "") ||
        !/^\d{2}:\d{2}$/.test(schedule.end || "") ||
        schedule.start >= schedule.end || !validClock(schedule.start) || !validClock(schedule.end) ||
        !Array.isArray(schedule.weekdays) ||
        !schedule.weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) ||
        !unique(schedule.weekdays) ||
        (schedule.repeat === "weekly" && !schedule.weekdays.length) ||
        (schedule.repeat === "once" && !validPlannerDate(schedule.date)) ||
        (schedule.date && !validPlannerDate(schedule.date))) {
      throw new Error("Invalid timetable schedule.");
    }
    scheduleIds.push(schedule.id);
  }
  if (!unique(scheduleIds)) throw new Error("Duplicate timetable schedule identifiers.");
  for (const [date, checked] of Object.entries(data.sessionChecksByDay)) {
    if (!validPlannerDate(date) || !isObject(checked) ||
        !Object.entries(checked).every(([id, value]) => nonEmpty(id) && typeof value === "boolean")) {
      throw new Error("Invalid date-wise timetable completion history.");
    }
  }
  return data;
}
function validClock(s) {
  const [h, m] = s.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}
function getStorage(storage) {
  if (storage) return storage;
  if (typeof window === "undefined") throw new Error("Browser storage is unavailable.");
  return window.localStorage;
}
function parseStored(storage, key, fallback) {
  const raw = storage.getItem(key);
  if (raw === null) return fallback;
  try { return JSON.parse(raw); }
  catch { throw new Error(`Saved data in ${key} is unreadable; export a backup before editing.`); }
}
/** Strict reads prevent a damaged local record from silently being overwritten with []. */
export function readPlannerForBackup(storage) {
  const store = getStorage(storage);
  return validatePlannerBackup({
    version: PLANNER_VERSION,
    skills: parseStored(store, SKILLS_KEY, []),
    schedules: parseStored(store, TIMETABLE_KEY, []),
    sessionChecksByDay: parseStored(store, SESSION_CHECKS_KEY, {}),
  });
}
function savePlannerPart(field, key, value, storage) {
  const store = getStorage(storage);
  const prior = readPlannerForBackup(store);
  validatePlannerBackup({ ...prior, [field]: value });
  store.setItem(key, JSON.stringify(value));
  if (typeof window !== "undefined" && store === window.localStorage) {
    window.dispatchEvent(new Event(PLANNER_UPDATED_EVENT));
  }
}
export const savePlannerSkills = (value, storage) => savePlannerPart("skills", SKILLS_KEY, value, storage);
export const savePlannerSchedules = (value, storage) => savePlannerPart("schedules", TIMETABLE_KEY, value, storage);
export const savePlannerSessionChecks = (value, storage) => savePlannerPart("sessionChecksByDay", SESSION_CHECKS_KEY, value, storage);

export function roadmapProgress(roadmap) {
  const steps = (roadmap?.phases || []).flatMap((p) => p.steps || []);
  const total = steps.length;
  const done = steps.filter((s) => s.done).length;
  return { total, done, percent: total ? Math.round(100 * done / total) : 0 };
}
export function skillProgress(skill) {
  const values = (skill?.roadmaps || []).map(roadmapProgress);
  const total = values.reduce((n, p) => n + p.total, 0);
  const done = values.reduce((n, p) => n + p.done, 0);
  return { total, done, percent: total ? Math.round(100 * done / total) : 0 };
}
export function scheduledOnDate(schedule, date) {
  if (!validPlannerDate(date)) return false;
  if (schedule.repeat === "daily") return true;
  if (schedule.repeat === "once") return schedule.date === date;
  if (schedule.repeat === "weekly") return schedule.weekdays.includes(new Date(`${date}T12:00:00`).getDay());
  return false; // flexible sessions are listed separately, not counted as scheduled
}
export function summarizePlannerOnDate(date, planner) {
  const skills = planner.skills || [];
  const roadmapTotals = skills.reduce((a, skill) => {
    const p = skillProgress(skill);
    return {done: a.done + p.done, total: a.total + p.total};
  }, { done: 0, total: 0 });
  const todaySessions = (planner.schedules || []).filter((s) => scheduledOnDate(s, date));
  const doneSessions = todaySessions.filter((s) => Boolean(planner.sessionChecksByDay?.[date]?.[s.id]));
  return {
    skills: skills.length,
    activeSkills: skills.filter((s) => s.status === "active").length,
    roadmapDone: roadmapTotals.done,
    roadmapTotal: roadmapTotals.total,
    roadmapPercent: roadmapTotals.total ? Math.round(100 * roadmapTotals.done / roadmapTotals.total) : 0,
    sessionDone: doneSessions.length,
    sessionTotal: todaySessions.length,
    todaySessions: todaySessions.slice().sort((a,b) => a.start.localeCompare(b.start)),
  };
}
