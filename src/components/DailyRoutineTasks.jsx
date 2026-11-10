import { useEffect, useMemo, useRef, useState } from "react";
import { parseRoadmapText } from "../utils/roadmapParser";
import { roadmapFileAccept } from "../utils/readRoadmapFile";
import SkillsPanel from "./SkillsPanel";
import TimetablePanel from "./TimetablePanel";
import { ROUTINE_UPDATED_EVENT } from "../utils/dailyRoutineData";

// Keep the same keys as Step 21A, so existing custom tasks and daily checks remain.
// No API calls, backend sync, or built-in sample/default tasks.
const TASKS_KEY = "hlt_daily_routine_tasks_v1";
const CHECKS_KEY = "hlt_daily_routine_checks_v1";

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readLocalJSON(key, fallback) {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm " +
  "text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
const buttonClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium " +
  "text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-emerald-500";

function formatDate(date) {
  // Noon avoids a timezone boundary when parsing YYYY-MM-DD.
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
}

export default function DailyRoutineTasks() {
  const [tasks, setTasks] = useState(() => {
    const saved = readLocalJSON(TASKS_KEY, []);
    return Array.isArray(saved) ? saved : [];
  });
  const [checksByDay, setChecksByDay] = useState(() => {
    const saved = readLocalJSON(CHECKS_KEY, {});
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  });
  const [selectedDate, setSelectedDate] = useState(getLocalDate);
  const lastLocalDate = useRef(getLocalDate());
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [activeTab, setActiveTab] = useState("tasks");
  const [linkedSkillId, setLinkedSkillId] = useState(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importSource, setImportSource] = useState("");
  const [importFilename, setImportFilename] = useState("");
  const [importTitle, setImportTitle] = useState("");
  const [importItemsText, setImportItemsText] = useState("");
  const [importWarnings, setImportWarnings] = useState([]);
  const [importTarget, setImportTarget] = useState("new");
  const [importError, setImportError] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importSuccess, setImportSuccess] = useState("");
  const importFileRef = useRef(null);


  // Persist only to this browser/PWA installation; keep old routine data separate.
  useEffect(() => {
    try {
      window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
      window.localStorage.setItem(CHECKS_KEY, JSON.stringify(checksByDay));
      window.dispatchEvent(new Event(ROUTINE_UPDATED_EVENT));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [tasks, checksByDay]);

  // Move the date picker to the new day only if the user was viewing "today".
  // Looking at a past date must not jump unexpectedly at midnight.
  useEffect(() => {
    const updateToday = () => {
      const current = getLocalDate();
      if (lastLocalDate.current !== current) {
        const previousToday = lastLocalDate.current;
        lastLocalDate.current = current;
        setSelectedDate((date) => date === previousToday ? current : date);
      }
    };
    const intervalId = window.setInterval(updateToday, 30_000);
    document.addEventListener("visibilitychange", updateToday);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", updateToday);
    };
  }, []);

  const checksForDate = checksByDay[selectedDate] || {};
  const activeTask = tasks.find((task) => task.id === activeTaskId) || null;

  const summary = useMemo(() => {
    let total = 0;
    let done = 0;
    let completedTasks = 0;
    for (const task of tasks) {
      const items = Array.isArray(task.items) ? task.items : [];
      total += items.length;
      const taskDone = items.filter((item) => Boolean(checksForDate[item.id])).length;
      done += taskDone;
      if (items.length > 0 && taskDone === items.length) completedTasks += 1;
    }
    return { total, done, completedTasks, percent: total ? Math.round(done / total * 100) : 0 };
  }, [tasks, checksForDate]);

  function previewRoadmap(text, filename = "") {
    const draft = parseRoadmapText(text, filename);
    setImportTitle(draft.title);
    setImportItemsText(draft.items.join("\n"));
    setImportWarnings(draft.warnings);
    setImportError("");
    setImportSuccess("");
  }

  async function onImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportBusy(true);
    setImportError("");
    setImportSuccess("");
    try {
      const { readRoadmapFile } = await import("../utils/readRoadmapFile");
      const text = await readRoadmapFile(file);
      setImportSource(text);
      setImportFilename(file.name);
      previewRoadmap(text, file.name);
    } catch (err) {
      setImportError(err?.message || "Could not read file. Try copying and pasting the list.");
    } finally {
      setImportBusy(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  }

  function saveImportedRoadmap(event) {
    event.preventDefault();
    const titles = importItemsText.split(/\r?\n/)
      .map((line) => line.replace(/^\s*[-*•]\s+/, "").trim())
      .filter(Boolean).slice(0, 250);
    const distinct = [...new Set(titles.map((s) => s.slice(0, 180)))];
    const taskTitle = importTitle.trim().slice(0, 100);
    if (!distinct.length) {
      setImportError("Add at least one checklist item in the preview."); return;
    }
    if (importTarget === "new" && !taskTitle) {
      setImportError("Enter a task name."); return;
    }
    const importedItems = distinct.map((title) => ({id: makeId(), title}));
    const existing = tasks.find((task) => task.id === importTarget);
    if (importTarget !== "new" && !existing) {
      setImportError("Destination task was not found. Choose another task."); return;
    }
    if (existing) {
      // Append only; never overwrite existing checklist items or their checked history.
      setTasks((previous) => previous.map((task) => task.id === existing.id ? {
        ...task, items: [...(task.items || []), ...importedItems]
      } : task));
    } else {
      setTasks((previous) => [...previous, {id: makeId(), title: taskTitle, items: importedItems}]);
    }
    setShowImport(false);
    setImportSource("");
    setImportFilename("");
    setImportTitle("");
    setImportItemsText("");
    setImportWarnings([]);
    setImportError("");
    setImportSuccess(`${importedItems.length} checklist items added to ${existing?.title || taskTitle}.`);
    setImportTarget("new");
  }

  function addTask(event) {
    event.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;
    setTasks((previous) => [...previous, { id: makeId(), title, items: [] }]);
    setNewTaskTitle("");
    setShowAddTask(false);
  }

  function editTask(task) {
    const edited = window.prompt("Edit task name", task.title);
    if (edited === null || !edited.trim()) return;
    setTasks((previous) => previous.map((entry) =>
      entry.id === task.id ? { ...entry, title: edited.trim() } : entry
    ));
  }

  function removeCheckHistory(itemIds) {
    const ids = new Set(itemIds);
    setChecksByDay((previous) => {
      const next = {};
      for (const [date, entries] of Object.entries(previous)) {
        if (!entries || typeof entries !== "object") continue;
        const kept = Object.fromEntries(Object.entries(entries).filter(([id]) => !ids.has(id)));
        if (Object.keys(kept).length) next[date] = kept;
      }
      return next;
    });
  }

  function deleteTask(task) {
    if (!window.confirm(`Delete "${task.title}" and all its checklist items?`)) return;
    setTasks((previous) => previous.filter((entry) => entry.id !== task.id));
    removeCheckHistory((task.items || []).map((item) => item.id));
    setActiveTaskId(null);
    setNewChecklistTitle("");
  }

  function addChecklistItem(event) {
    event.preventDefault();
    if (!activeTask) return;
    const title = newChecklistTitle.trim();
    if (!title) return;
    setTasks((previous) => previous.map((task) => task.id === activeTask.id ? {
      ...task,
      items: [...(task.items || []), { id: makeId(), title }]
    } : task));
    setNewChecklistTitle("");
  }

  function editChecklistItem(taskId, item) {
    const edited = window.prompt("Edit checklist item", item.title);
    if (edited === null || !edited.trim()) return;
    setTasks((previous) => previous.map((task) => task.id === taskId ? {
      ...task,
      items: (task.items || []).map((entry) =>
        entry.id === item.id ? { ...entry, title: edited.trim() } : entry
      )
    } : task));
  }

  function deleteChecklistItem(taskId, item) {
    if (!window.confirm(`Delete checklist item "${item.title}"?`)) return;
    setTasks((previous) => previous.map((task) => task.id === taskId ? {
      ...task,
      items: (task.items || []).filter((entry) => entry.id !== item.id)
    } : task));
    removeCheckHistory([item.id]);
  }

  function toggleChecklistItem(itemId) {
    setChecksByDay((previous) => {
      const dayChecks = { ...(previous[selectedDate] || {}) };
      if (dayChecks[itemId]) delete dayChecks[itemId];
      else dayChecks[itemId] = true;
      return { ...previous, [selectedDate]: dayChecks };
    });
  }

  return (
    <section className="space-y-5 pb-8 text-slate-900">
      <header>
        <h2 className="text-2xl font-bold">Daily Routine</h2>
        <p className="mt-1 text-sm text-slate-500">Custom tasks · Device-only storage</p>
      </header>

      {storageError && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Device storage unavailable or full. Recent changes might not be saved.
        </p>
      )}

      {/* STEP22_NAVIGATION: Keep original Tasks tree intact. */}
      <nav aria-label="Daily Routine sections" className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-2">
        {[["tasks","Tasks"],["skills","Skills"],["timetable","Timetable"]].map(([id,label]) => (
          <button key={id} type="button" onClick={() => setActiveTab(id)}
            aria-current={activeTab === id ? "page" : undefined}
            className={`rounded-xl px-2 py-3 text-sm font-semibold transition ${activeTab === id
              ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{label}</button>
        ))}
      </nav>
      {activeTab === "skills" ? (
        <SkillsPanel focusSkillId={linkedSkillId} onFocusHandled={() => setLinkedSkillId(null)} />
      ) : activeTab === "timetable" ? (
        <TimetablePanel selectedDate={selectedDate} onSelectedDateChange={setSelectedDate}
          tasks={tasks}
          onOpenLinked={(type,id) => {
            if (type === "task") { setActiveTaskId(id); setActiveTab("tasks"); }
            if (type === "skill") { setLinkedSkillId(id); setActiveTab("skills"); }
          }} />
      ) : (
        <>
      {/* The date selector remains at the top, like the original routine page. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <label htmlFor="hlt-routine-date" className="block text-sm font-semibold">Select Date</label>
        <input
          id="hlt-routine-date"
          type="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value || getLocalDate())}
          className={`${inputClass} mt-2`}
        />
        <p className="mt-2 text-xs text-slate-500">{formatDate(selectedDate)}</p>
      </div>

      {/* This progress represents the selected date, not always today. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">
            {selectedDate === getLocalDate() ? "Today's Progress" : "Selected Date Progress"}
          </h3>
          <span className="text-sm font-semibold text-emerald-700">
            {summary.done} / {summary.total} items
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Daily checklist progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={summary.percent}
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-200"
            style={{ width: `${summary.percent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {summary.completedTasks} of {tasks.length} tasks completed on this date.
        </p>
      </div>

      {/* Only task cards are visible on the main page. Checklist items are in the detail view. */}
      {!activeTask ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold">My Tasks</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonClass}
                onClick={() => { setShowImport((open) => !open); setImportError(""); }}
              >
                {showImport ? "Close Import" : "Import Roadmap / Task"}
              </button>
              <button
                type="button"
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                onClick={() => setShowAddTask((open) => !open)}
              >
                {showAddTask ? "Cancel" : "+ Add Task"}
              </button>
            </div>
          </div>

          {importSuccess && (
            <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {importSuccess}
            </p>
          )}

          {showImport && (
            <div className="space-y-4 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
              <div>
                <h4 className="text-lg font-bold">Import an AI Roadmap or Task List</h4>
                <p className="mt-1 text-sm text-slate-500">
                  Paste an AI response, or upload a document. Everything is processed in this browser;
                  imported checklist items stay on this device only.
                </p>
              </div>
              <div>
                <label htmlFor="hlt-roadmap-text" className="block text-sm font-medium">Paste AI response or list</label>
                <textarea
                  id="hlt-roadmap-text"
                  rows={6}
                  value={importSource}
                  onChange={(event) => { setImportSource(event.target.value); setImportFilename(""); }}
                  placeholder={"# DSA Roadmap\nPhase 1: Basics\n1. Arrays\n2. Strings\nPhase 2: Practice\n- Solve 1 problem daily"}
                  className={`${inputClass} mt-2`}
                />
                <button
                  type="button"
                  className={`${buttonClass} mt-2`}
                  disabled={importBusy || !importSource.trim()}
                  onClick={() => previewRoadmap(importSource, importFilename)}
                >
                  Generate Checklist Preview
                </button>
              </div>
              <div className="rounded-xl border border-dashed border-slate-300 p-3">
                <label htmlFor="hlt-roadmap-file" className="block text-sm font-medium">Or upload a file</label>
                <input
                  ref={importFileRef}
                  id="hlt-roadmap-file"
                  type="file"
                  accept={roadmapFileAccept}
                  disabled={importBusy}
                  onChange={onImportFile}
                  className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-emerald-800"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Supports TXT, Markdown, CSV, JSON, HTML, text PDFs, DOCX, PPTX, XLSX and image OCR (PNG/JPG/WEBP).
                  OCR may need an initial language-model download. Scanned PDFs can be imported as page screenshots.
                </p>
                {importBusy && <p role="status" className="mt-2 text-sm text-emerald-700">Reading file on this device…</p>}
              </div>
              {importError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{importError}</p>}
              {(importItemsText || importWarnings.length > 0) && (
                <form onSubmit={saveImportedRoadmap} className="space-y-3 border-t border-slate-100 pt-4">
                  <h5 className="font-semibold">Review & Edit Before Saving</h5>
                  <label htmlFor="hlt-roadmap-destination" className="block text-sm font-medium">Add to</label>
                  <select
                    id="hlt-roadmap-destination"
                    className={inputClass}
                    value={importTarget}
                    onChange={(event) => setImportTarget(event.target.value)}
                  >
                    <option value="new">Create new task</option>
                    {tasks.map((task) => <option key={task.id} value={task.id}>Add checklist to {task.title}</option>)}
                  </select>
                  {importTarget === "new" && (
                    <div>
                      <label htmlFor="hlt-roadmap-title" className="block text-sm font-medium">Task name</label>
                      <input id="hlt-roadmap-title" className={`${inputClass} mt-1`}
                        maxLength={100} value={importTitle} onChange={(event) => setImportTitle(event.target.value)} />
                    </div>
                  )}
                  <div>
                    <label htmlFor="hlt-roadmap-items" className="block text-sm font-medium">
                      Checklist — one item per line ({importItemsText.split(/\r?\n/).filter((s) => s.trim()).length} items)
                    </label>
                    <textarea id="hlt-roadmap-items" rows={8} className={`${inputClass} mt-1`}
                      value={importItemsText} onChange={(event) => setImportItemsText(event.target.value)} />
                    <p className="mt-1 text-xs text-slate-500">Edit or delete any extracted line. New items start unchecked for each day.</p>
                  </div>
                  {importWarnings.map((warning, index) => (
                    <p key={index} className="text-xs text-amber-700">{warning}</p>
                  ))}
                  <button
                    type="submit"
                    disabled={importBusy || !importItemsText.trim()}
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Save Checklist to My Tasks
                  </button>
                </form>
              )}
            </div>
          )}

          {showAddTask && (
            <form onSubmit={addTask} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <label htmlFor="hlt-routine-new-task" className="block text-sm font-medium">Task Name</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  id="hlt-routine-new-task"
                  type="text"
                  placeholder="Enter task name"
                  className={inputClass}
                  maxLength={100}
                  value={newTaskTitle}
                  onChange={(event) => setNewTaskTitle(event.target.value)}
                />
                <button
                  type="submit"
                  disabled={!newTaskTitle.trim()}
                  className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Save Task
                </button>
              </div>
            </form>
          )}

          {tasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="font-semibold">No tasks added yet</p>
              <p className="mt-2 text-sm text-slate-500">Create a task to get started. No default tasks.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const items = Array.isArray(task.items) ? task.items : [];
                const done = items.filter((item) => checksForDate[item.id]).length;
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => {
                      setActiveTaskId(task.id);
                      setNewChecklistTitle("");
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-emerald-300 hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500"
                    aria-label={`Open ${task.title} checklist`}
                  >
                    <div className="min-w-0">
                      <p className="break-words text-base font-semibold">{task.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{done}/{items.length} completed</p>
                    </div>
                    <span aria-hidden="true" className="shrink-0 text-xl text-slate-400">›</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              setActiveTaskId(null);
              setNewChecklistTitle("");
            }}
          >
            ← Back to Tasks
          </button>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="break-words text-xl font-bold">{activeTask.title}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {(activeTask.items || []).filter((item) => checksForDate[item.id]).length}
                  /{(activeTask.items || []).length} checklist items done
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className={buttonClass} onClick={() => editTask(activeTask)}>Edit</button>
                <button type="button" className={`${buttonClass} text-rose-600`} onClick={() => deleteTask(activeTask)}>Delete</button>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {(!activeTask.items || activeTask.items.length === 0) && (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  No checklist items yet. Add your first item below.
                </p>
              )}
              {(activeTask.items || []).map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={Boolean(checksForDate[item.id])}
                      onChange={() => toggleChecklistItem(item.id)}
                      className="h-4 w-4 shrink-0 accent-emerald-600"
                    />
                    <span className={`break-words text-sm ${checksForDate[item.id] ? "text-slate-400 line-through" : "text-slate-800"}`}>
                      {item.title}
                    </span>
                  </label>
                  <button type="button" className={buttonClass} onClick={() => editChecklistItem(activeTask.id, item)} aria-label={`Edit ${item.title}`}>
                    Edit
                  </button>
                  <button type="button" className={`${buttonClass} text-rose-600`} onClick={() => deleteChecklistItem(activeTask.id, item)} aria-label={`Delete ${item.title}`}>
                    ×
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={addChecklistItem} className="mt-5 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                aria-label="New checklist item"
                placeholder="Add checklist item..."
                value={newChecklistTitle}
                onChange={(event) => setNewChecklistTitle(event.target.value)}
                maxLength={120}
                className={inputClass}
              />
              <button
                type="submit"
                disabled={!newChecklistTitle.trim()}
                className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                + Add Item
              </button>
            </form>
          </div>
        </div>
      )}

        </>
      )}

      <p className="text-xs text-slate-500">
        Tasks and checklist history stay in this device's browser/PWA storage. No online sync.
        Clearing site data or uninstalling the PWA may erase them.
      </p>
    </section>
  );
}
