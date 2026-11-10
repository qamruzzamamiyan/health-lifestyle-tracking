import { useEffect, useMemo, useRef, useState } from "react";
import { roadmapFileAccept } from "../utils/readRoadmapFile";
import { parseSkillRoadmapText, countDraftSteps } from "../utils/skillRoadmapParser";
import {
  PLANNER_UPDATED_EVENT, SKILLS_KEY, makePlannerId, readPlannerForBackup,
  roadmapProgress, savePlannerSkills, skillProgress,
} from "../utils/routinePlannerData";

const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500";
const outline = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";
const primary = "rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50";
const statuses = ["planned", "active", "paused", "completed"];
const newPhase = (title = "New Phase") => ({id: makePlannerId(), title, steps: []});
const newStep = (title = "") => ({id: makePlannerId(), title, done: false, completedAt: null});

function readSkills() {
  try { return { data: readPlannerForBackup().skills, error: "" }; }
  catch (err) { return { data: [], error: `Saved planner cannot be read: ${err.message}` }; }
}

export default function SkillsPanel({ focusSkillId, onFocusHandled }) {
  const [initial] = useState(readSkills);
  const [skills, setSkills] = useState(initial.data);
  const [error, setError] = useState(initial.error);
  const [skillId, setSkillId] = useState(null);
  const [roadmapId, setRoadmapId] = useState(null);
  const [newSkillVisible, setNewSkillVisible] = useState(false);
  const [skillName, setSkillName] = useState("");
  const [skillDescription, setSkillDescription] = useState("");
  const [importText, setImportText] = useState("");
  const [importWarnings, setImportWarnings] = useState([]);
  const [draft, setDraft] = useState(null);
  const [fileBusy, setFileBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    const refresh = () => {
      const snapshot = readSkills();
      setSkills(snapshot.data);
      setError(snapshot.error);
    };
    const onStorage = (e) => { if (!e.key || e.key === SKILLS_KEY) refresh(); };
    window.addEventListener(PLANNER_UPDATED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PLANNER_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (focusSkillId) {
      setSkillId(focusSkillId);
      setRoadmapId(null);
      setDraft(null);
      onFocusHandled?.();
    }
  }, [focusSkillId, onFocusHandled]);

  const skill = useMemo(() => skills.find((item) => item.id === skillId), [skills, skillId]);
  const roadmap = skill?.roadmaps.find((item) => item.id === roadmapId) || null;

  function commit(next) {
    try {
      savePlannerSkills(next);
      setSkills(next);
      setError("");
      return true;
    } catch (err) {
      setError(`Changes were NOT saved: ${err.message}`);
      return false;
    }
  }
  function addSkill(e) {
    e.preventDefault();
    const title = skillName.trim().slice(0, 100);
    if (!title) return;
    const id = makePlannerId();
    if (commit([...skills, { id, title, description: skillDescription.trim().slice(0, 1000),
      status: "planned", targetDate: "", roadmaps: [] }])) {
      setSkillId(id); setSkillName(""); setSkillDescription(""); setNewSkillVisible(false);
    }
  }
  function updateSkill(patch) {
    if (!skill) return;
    commit(skills.map((s) => s.id === skill.id ? {...s, ...patch} : s));
  }
  function renameSkill() {
    const title = window.prompt("Skill name", skill.title);
    if (title?.trim()) updateSkill({title: title.trim().slice(0, 100)});
  }
  function editDescription() {
    const description = window.prompt("Skill notes / goal", skill.description || "");
    if (description !== null) updateSkill({description: description.trim().slice(0, 1000)});
  }
  function deleteSkill() {
    if (!skill || !window.confirm(`Delete skill "${skill.title}" and all its roadmaps? Timetable references will not be deleted.`)) return;
    if (commit(skills.filter((s) => s.id !== skill.id))) {
      setSkillId(null); setRoadmapId(null); setDraft(null);
    }
  }
  function startRoadmapEditor(existing = null) {
    const prepared = existing ? {
      id: existing.id, title: existing.title,
      phases: existing.phases.map((p) => ({...p, steps: p.steps.map((s) => ({...s}))}))
    } : {id: makePlannerId(), title: "", phases: [newPhase("General")]};
    setDraft(prepared);
    setImportText("");
    setImportWarnings([]);
    setRoadmapId(null);
  }
  function generatePreview(text, filename = "") {
    const parsed = parseSkillRoadmapText(text, filename);
    if (!parsed.phases.length) {
      setError("No checklist items found. Paste a list with bullets or one topic per line."); return;
    }
    setDraft({
      id: draft?.id || makePlannerId(),
      title: parsed.title.slice(0, 120),
      phases: parsed.phases.map((p) => ({ ...p, id: makePlannerId(), steps: p.steps.map((s) => ({...s, id: makePlannerId()})) })),
    });
    setImportWarnings(parsed.warnings);
    setError("");
  }
  async function uploadRoadmap(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileBusy(true);
    try {
      const {readRoadmapFile} = await import("../utils/readRoadmapFile");
      const contents = await readRoadmapFile(file);
      setImportText(contents);
      generatePreview(contents, file.name);
    } catch (err) { setError(`Cannot read file: ${err.message}`); }
    finally { setFileBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  function draftPhase(index, patch) {
    setDraft((prev) => ({...prev, phases: prev.phases.map((p, i) => i === index ? {...p, ...patch} : p)}));
  }
  function draftStep(phaseIndex, stepIndex, patch) {
    setDraft((prev) => ({...prev, phases: prev.phases.map((p, i) => i !== phaseIndex ? p : {
      ...p, steps: p.steps.map((s,j) => j === stepIndex ? {...s, ...patch} : s)
    })}));
  }
  function saveRoadmap(e) {
    e.preventDefault();
    if (!skill || !draft) return;
    const title = draft.title.trim().slice(0, 120);
    const phases = draft.phases.map((p) => ({...p,
      title: p.title.trim().slice(0, 120),
      steps: p.steps.filter((s) => s.title.trim()).map((s) => ({...s, title: s.title.trim().slice(0,220)}))
    })).filter((p) => p.title && p.steps.length);
    if (!title || !phases.length || !countDraftSteps(phases)) {
      setError("Roadmap needs a title and at least one phase with a checklist step."); return;
    }
    if (phases.length > 50 || countDraftSteps(phases) > 250) {
      setError("Roadmaps support up to 50 phases and 250 checklist steps."); return;
    }
    const nextRoadmap = {id: draft.id, title, phases};
    const next = skills.map((s) => s.id === skill.id ? {
      ...s, roadmaps: s.roadmaps.some((r) => r.id === draft.id)
        ? s.roadmaps.map((r) => r.id === draft.id ? nextRoadmap : r)
        : [...s.roadmaps, nextRoadmap]
    } : s);
    if (commit(next)) { setDraft(null); setImportText(""); setRoadmapId(draft.id); }
  }
  function deleteRoadmap() {
    if (!roadmap || !window.confirm(`Delete roadmap "${roadmap.title}" and all progress?`)) return;
    const next = skills.map((s) => s.id === skill.id ? {
      ...s, roadmaps: s.roadmaps.filter((r) => r.id !== roadmap.id)
    } : s);
    if (commit(next)) setRoadmapId(null);
  }
  function toggleStep(phaseId, stepId) {
    const next = skills.map((s) => s.id !== skill.id ? s : {
      ...s, roadmaps: s.roadmaps.map((r) => r.id !== roadmap.id ? r : {
        ...r, phases: r.phases.map((p) => p.id !== phaseId ? p : {
          ...p, steps: p.steps.map((step) => step.id !== stepId ? step : {
            ...step, done: !step.done, completedAt: !step.done ? new Date().toISOString() : null,
          })
        })
      })
    });
    commit(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xl font-bold text-slate-900">My Skills</h3>
        {!skill && <button className={primary} onClick={() => setNewSkillVisible((v) => !v)} type="button">+ Add Skill</button>}
      </div>
      <p className="text-sm text-slate-500">Skills and permanent roadmap progress stay on this device. Nothing is preloaded.</p>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

      {!skill ? <>
        {newSkillVisible && <form onSubmit={addSkill} className="space-y-3 rounded-2xl border bg-white p-4">
          <label className="block text-sm font-medium">Skill name
            <input required maxLength={100} value={skillName} onChange={(e) => setSkillName(e.target.value)} className={`${input} mt-1`} placeholder="e.g., Cyber Security" />
          </label>
          <label className="block text-sm font-medium">Goal / notes (optional)
            <textarea value={skillDescription} onChange={(e) => setSkillDescription(e.target.value)} maxLength={1000} rows={2} className={`${input} mt-1`} />
          </label>
          <button className={primary} type="submit">Save Skill</button>
        </form>}
        {skills.length === 0 ? <p className="rounded-2xl border border-dashed bg-white p-6 text-center text-sm text-slate-500">No skills yet. Add the first skill you want to learn.</p> :
          skills.map((s) => {
            const p = skillProgress(s);
            return <button type="button" key={s.id} onClick={() => {setSkillId(s.id); setRoadmapId(null);setDraft(null);}}
              className="w-full space-y-2 rounded-2xl border bg-white p-4 text-left shadow-sm hover:border-emerald-300">
              <div className="flex items-center justify-between gap-2"><span className="font-semibold">{s.title}</span><span className="text-xs capitalize text-slate-500">{s.status}</span></div>
              <p className="text-xs text-slate-500">{s.roadmaps.length} roadmaps · {p.done}/{p.total} steps complete</p>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div style={{width:`${p.percent}%`}} className="h-full bg-emerald-500" /></div>
            </button>;
          })}
      </> : <>
        <button type="button" className={outline} onClick={() => {setSkillId(null);setRoadmapId(null);setDraft(null);}}>← All Skills</button>
        <div className="rounded-2xl border bg-white p-4 space-y-3">
          <div className="flex flex-wrap justify-between gap-2">
            <div><h4 className="text-lg font-bold">{skill.title}</h4><p className="text-sm text-slate-500">{skill.description || "No notes added"}</p></div>
            <div className="flex flex-wrap gap-2"><button className={outline} type="button" onClick={renameSkill}>Rename</button><button className={outline} type="button" onClick={editDescription}>Notes</button><button className={`${outline} text-rose-600`} type="button" onClick={deleteSkill}>Delete Skill</button></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium">Learning status
              <select value={skill.status} onChange={(e) => updateSkill({status:e.target.value})} className={`${input} mt-1`}>
                {statuses.map((s) => <option key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium">Target date (optional)
              <input type="date" className={`${input} mt-1`} value={skill.targetDate || ""} onChange={(e) => updateSkill({targetDate:e.target.value})} />
            </label>
          </div>
          <p className="text-sm font-medium text-emerald-700">Permanent roadmap progress: {skillProgress(skill).done}/{skillProgress(skill).total} steps ({skillProgress(skill).percent}%)</p>
        </div>

        {draft ? <form onSubmit={saveRoadmap} className="space-y-4 rounded-2xl border bg-white p-4">
          <h4 className="font-bold">Review / Edit Roadmap</h4>
          <label className="block text-sm font-medium">Roadmap title
            <input className={`${input} mt-1`} maxLength={120} value={draft.title} onChange={(e) => setDraft((v) => ({...v,title:e.target.value}))} />
          </label>
          <div className="rounded-xl bg-slate-50 p-3 space-y-2">
            <label className="block text-sm font-medium">Paste AI roadmap (optional)</label>
            <textarea rows={5} value={importText} onChange={(e) => setImportText(e.target.value)}
              placeholder={"# Python Roadmap\n## Phase 1: Basics\n- Variables\n- Functions\n## Phase 2: Projects\n- Build a calculator"}
              className={input} />
            <button className={outline} type="button" disabled={!importText.trim() || fileBusy} onClick={() => generatePreview(importText)}>Generate Phase Preview</button>
            <label className="block text-sm font-medium">Or upload a supported file
              <input ref={fileRef} type="file" accept={roadmapFileAccept} onChange={uploadRoadmap} disabled={fileBusy} className="mt-1 block w-full text-sm" />
            </label>
            <p className="text-xs text-slate-500">Locally parsed. Supports the same formats as your Tasks importer; scanned PDF text may require manual pasting.</p>
            {fileBusy && <p role="status" className="text-sm text-emerald-700">Reading document locally…</p>}
            {importWarnings.map((warning,i) => <p key={i} className="text-xs text-amber-700">{warning}</p>)}
          </div>
          <div className="space-y-3">
            {draft.phases.map((phase,pIndex) => <div className="space-y-2 rounded-xl border p-3" key={phase.id}>
              <div className="flex gap-2"><input aria-label="Phase name" className={input} value={phase.title} maxLength={120} onChange={(e) => draftPhase(pIndex,{title:e.target.value})} />
                <button className={`${outline} text-rose-600`} type="button" onClick={() => setDraft((v) => ({...v, phases:v.phases.filter((p) => p.id !== phase.id)}))}>Remove Phase</button></div>
              {phase.steps.map((step,sIndex) => <div key={step.id} className="flex gap-2">
                <input aria-label="Checklist step" value={step.title} onChange={(e) => draftStep(pIndex,sIndex,{title:e.target.value})} maxLength={220} className={input} />
                <button type="button" className={`${outline} text-rose-600`} onClick={() => draftPhase(pIndex,{steps:phase.steps.filter((s) => s.id !== step.id)})}>×</button>
              </div>)}
              <button type="button" className={outline} onClick={() => draftPhase(pIndex,{steps:[...phase.steps,newStep()]})}>+ Add Step</button>
            </div>)}
            <button type="button" className={outline} onClick={() => setDraft((v) => ({...v, phases:[...v.phases,newPhase()]}))}>+ Add Phase</button>
          </div>
          <p className="text-xs text-slate-500">{countDraftSteps(draft.phases)} steps · Changes are saved only when you select Save Roadmap.</p>
          <div className="flex gap-2"><button className={primary} type="submit">Save Roadmap</button><button className={outline} type="button" onClick={() => setDraft(null)}>Cancel</button></div>
        </form> : roadmap ? <div className="space-y-4">
          <button type="button" className={outline} onClick={() => setRoadmapId(null)}>← All Roadmaps</button>
          <div className="rounded-2xl border bg-white p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-lg font-bold">{roadmap.title}</h4><div className="flex gap-2"><button type="button" className={outline} onClick={() => startRoadmapEditor(roadmap)}>Edit</button><button type="button" className={`${outline} text-rose-600`} onClick={deleteRoadmap}>Delete</button></div></div>
            <p className="text-sm text-emerald-700">{roadmapProgress(roadmap).done}/{roadmapProgress(roadmap).total} permanently completed ({roadmapProgress(roadmap).percent}%)</p>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-500" style={{width:`${roadmapProgress(roadmap).percent}%`}} /></div>
          </div>
          {roadmap.phases.map((phase) => {
            const total=phase.steps.length, done=phase.steps.filter((s)=>s.done).length;
            return <div key={phase.id} className="space-y-3 rounded-2xl border bg-white p-4">
              <div><h5 className="font-semibold">{phase.title}</h5><p className="text-xs text-slate-500">{done}/{total} milestones complete</p></div>
              {phase.steps.map((step) => <label key={step.id} className="flex cursor-pointer items-start gap-3 rounded-lg bg-slate-50 p-3">
                <input type="checkbox" className="mt-1 accent-emerald-600" checked={step.done} onChange={() => toggleStep(phase.id,step.id)} />
                <span className={`text-sm ${step.done?"text-slate-400 line-through":"text-slate-800"}`}>{step.title}{step.done && step.completedAt ? <small className="mt-1 block text-xs text-slate-400">Completed {new Date(step.completedAt).toLocaleDateString("en-IN")}</small> : null}</span>
              </label>)}
            </div>;
          })}
        </div> : <div className="space-y-3">
          <div className="flex justify-between items-center"><h4 className="font-semibold">Roadmaps</h4><button type="button" className={primary} onClick={() => startRoadmapEditor()}>+ Add / Import Roadmap</button></div>
          {skill.roadmaps.length === 0 ? <p className="rounded-xl border border-dashed bg-white p-5 text-sm text-slate-500">No roadmap yet. Create one manually or import an AI-generated roadmap.</p> :
          skill.roadmaps.map((r) => {
            const p=roadmapProgress(r);
            return <button type="button" key={r.id} className="w-full rounded-xl border bg-white p-4 text-left hover:border-emerald-300" onClick={() => setRoadmapId(r.id)}>
              <span className="font-semibold">{r.title}</span><p className="mt-1 text-xs text-slate-500">{p.done}/{p.total} steps · {p.percent}% complete</p>
              <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-500" style={{width:`${p.percent}%`}} /></div>
            </button>;
          })}
        </div>}
      </>}
      <p className="text-xs text-slate-500">Completing a roadmap step is permanent. It does not reset tomorrow and does not automatically check daily timetable sessions.</p>
    </div>
  );
}
