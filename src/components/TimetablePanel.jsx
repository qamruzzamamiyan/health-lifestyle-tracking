import { useEffect, useMemo, useState } from "react";
import {
  PLANNER_UPDATED_EVENT, SKILLS_KEY, TIMETABLE_KEY, SESSION_CHECKS_KEY,
  localPlannerDate, makePlannerId, readPlannerForBackup,
  savePlannerSchedules, savePlannerSessionChecks, scheduledOnDate,
} from "../utils/routinePlannerData";

const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500";
const outline = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";
const primary = "rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-emerald-700";
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const blank = (date) => ({
  id: makePlannerId(), title: "", start: "07:00", end: "08:00", repeat: "daily",
  weekdays: [], date, linkType: "none", linkId: "", roadmapId: "", notes: "",
});
const readPlanner = () => {
  try {return {data:readPlannerForBackup(),error:""};}
  catch(err) {return {data:{skills:[],schedules:[],sessionChecksByDay:{}},error:err.message};}
};

export default function TimetablePanel({ selectedDate, onSelectedDateChange, tasks = [], onOpenLinked }) {
  const [initial] = useState(readPlanner);
  const [planner, setPlanner] = useState(initial.data);
  const [error, setError] = useState(initial.error);
  const [draft, setDraft] = useState(null);
  const [showFlexible, setShowFlexible] = useState(true);
  useEffect(() => {
    const refresh = () => {const next=readPlanner();setPlanner(next.data);setError(next.error);};
    const onStorage=(e)=> {if (!e.key || [SKILLS_KEY,TIMETABLE_KEY,SESSION_CHECKS_KEY].includes(e.key))refresh();};
    window.addEventListener(PLANNER_UPDATED_EVENT,refresh);
    window.addEventListener("storage",onStorage);
    return ()=> {window.removeEventListener(PLANNER_UPDATED_EVENT,refresh);window.removeEventListener("storage",onStorage);};
  },[]);
  const displayed = selectedDate || localPlannerDate();
  const todaySchedules = useMemo(() => planner.schedules.filter((s)=>scheduledOnDate(s,displayed)).sort((a,b)=>a.start.localeCompare(b.start)), [planner.schedules,displayed]);
  const flexible = planner.schedules.filter((s)=>s.repeat === "flexible");
  const checks = planner.sessionChecksByDay[displayed] || {};
  const done = todaySchedules.filter((s)=>checks[s.id]).length;
  const progress = todaySchedules.length ? Math.round(100*done/todaySchedules.length) : 0;

  function saveSchedule(e) {
    e.preventDefault();
    if (!draft) return;
    const next = {...draft, title:draft.title.trim().slice(0,120), notes:draft.notes.trim().slice(0,1500)};
    if (!next.title || next.start >= next.end) {setError("Enter a title and an end time later than the start time.");return;}
    if (next.repeat === "weekly" && !next.weekdays.length) {setError("Select at least one weekday.");return;}
    if (next.repeat === "once" && !next.date) {setError("Choose a date for a one-time session.");return;}
    if (next.linkType === "none") {next.linkId="";next.roadmapId="";}
    if (next.linkType !== "skill") next.roadmapId="";
    const schedules=planner.schedules.some((s)=>s.id===next.id)
      ? planner.schedules.map((s)=>s.id===next.id ? next : s)
      : [...planner.schedules,next];
    try { savePlannerSchedules(schedules);setPlanner((p)=>({...p,schedules}));setDraft(null);setError(""); }
    catch(err){setError(`Session not saved: ${err.message}`);}
  }
  function deleteSchedule(schedule) {
    if (!window.confirm(`Delete schedule "${schedule.title}"? Historical day checkmarks are kept in backup.`)) return;
    const schedules=planner.schedules.filter((s)=>s.id!==schedule.id);
    try {savePlannerSchedules(schedules);setPlanner((p)=>({...p,schedules}));setError("");}
    catch(err){setError(`Could not delete: ${err.message}`);}
  }
  function toggleSession(scheduleId) {
    const nextDay={...(checks)};
    if (nextDay[scheduleId]) delete nextDay[scheduleId];
    else nextDay[scheduleId]=true;
    const history={...planner.sessionChecksByDay,[displayed]:nextDay};
    try {savePlannerSessionChecks(history);setPlanner((p)=>({...p,sessionChecksByDay:history}));setError("");}
    catch(err){setError(`Completion not saved: ${err.message}`);}
  }
  const linkedSkill=planner.skills.find((s)=>s.id===draft?.linkId);
  function linkLabel(schedule) {
    if (schedule.linkType==="skill") {
      const s=planner.skills.find((sk)=>sk.id===schedule.linkId);
      const r=s?.roadmaps.find((rm)=>rm.id===schedule.roadmapId);
      return s ? `Skill: ${s.title}${r?` · ${r.title}`:""}` : "Linked skill no longer exists";
    }
    if (schedule.linkType==="task") {
      const t=tasks.find((t)=>t.id===schedule.linkId);
      return t ? `Task: ${t.title}` : "Linked task no longer exists";
    }
    return "Personal session";
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xl font-bold">My Timetable</h3><button type="button" className={primary} onClick={()=>setDraft(blank(displayed))}>+ Add Schedule</button></div>
    <p className="text-sm text-slate-500">A timetable session completes for the selected date only. Skill roadmap progress remains independent.</p>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    <div className="rounded-2xl border bg-white p-4">
      <label className="block text-sm font-medium">Select Date
        <input type="date" value={displayed} onChange={(e)=>onSelectedDateChange(e.target.value || localPlannerDate())} className={`${input} mt-2`}/>
      </label>
      <div className="mt-4 flex items-center justify-between gap-2"><p className="font-medium">Scheduled sessions</p><span className="text-sm text-emerald-700">{done}/{todaySchedules.length}</span></div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Selected date timetable completion">
        <div className="h-full bg-emerald-500" style={{width:`${progress}%`}} />
      </div>
    </div>

    {draft && <form onSubmit={saveSchedule} className="space-y-3 rounded-2xl border border-emerald-200 bg-white p-4">
      <h4 className="font-bold">{planner.schedules.some((s)=>s.id===draft.id)?"Edit":"New"} Schedule</h4>
      <label className="block text-sm font-medium">Session title
        <input className={`${input} mt-1`} required maxLength={120} placeholder="e.g. Study Networking" value={draft.title} onChange={(e)=>setDraft((p)=>({...p,title:e.target.value}))} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium">Start Time<input type="time" className={`${input} mt-1`} value={draft.start} onChange={(e)=>setDraft((p)=>({...p,start:e.target.value}))}/></label>
        <label className="text-sm font-medium">End Time<input type="time" className={`${input} mt-1`} value={draft.end} onChange={(e)=>setDraft((p)=>({...p,end:e.target.value}))}/></label>
      </div>
      <label className="block text-sm font-medium">Repeat
        <select value={draft.repeat} className={`${input} mt-1`} onChange={(e)=>setDraft((p)=>({...p,repeat:e.target.value}))}>
          <option value="daily">Daily</option><option value="weekly">Weekly · Selected Days</option><option value="once">Once · Specific Date</option><option value="flexible">Flexible · Anytime</option>
        </select>
      </label>
      {draft.repeat==="weekly" && <div className="space-y-2"><p className="text-sm font-medium">Repeat on</p>
        <div className="flex flex-wrap gap-3">{weekdays.map((day,index)=><label key={day} className="flex items-center gap-1 text-sm"><input type="checkbox" className="accent-emerald-600" checked={draft.weekdays.includes(index)} onChange={(e)=>setDraft((p)=>({...p,weekdays:e.target.checked?[...p.weekdays,index].sort():p.weekdays.filter((v)=>v!==index)}))}/>{day}</label>)}</div>
      </div>}
      {draft.repeat==="once" && <label className="block text-sm font-medium">Session Date<input className={`${input} mt-1`} type="date" value={draft.date} onChange={(e)=>setDraft((p)=>({...p,date:e.target.value}))}/></label>}
      <label className="block text-sm font-medium">Link to task/skill (optional)
        <select className={`${input} mt-1`} value={`${draft.linkType}:${draft.linkId}`} onChange={(e)=>{
          const [linkType,linkId]=e.target.value.split(":");setDraft((p)=>({...p,linkType,linkId,roadmapId:""}));
        }}>
          <option value="none:">No link</option>
          {tasks.map((t)=><option key={t.id} value={`task:${t.id}`}>Task: {t.title}</option>)}
          {planner.skills.map((s)=><option key={s.id} value={`skill:${s.id}`}>Skill: {s.title}</option>)}
        </select>
      </label>
      {draft.linkType==="skill" && linkedSkill && <label className="block text-sm font-medium">Specific roadmap (optional)
        <select className={`${input} mt-1`} value={draft.roadmapId || ""} onChange={(e)=>setDraft((p)=>({...p,roadmapId:e.target.value}))}>
          <option value="">Entire skill</option>{linkedSkill.roadmaps.map((r)=><option key={r.id} value={r.id}>{r.title}</option>)}
        </select>
      </label>}
      <label className="block text-sm font-medium">Session notes (optional)
        <textarea className={`${input} mt-1`} rows={2} maxLength={1500} value={draft.notes} onChange={(e)=>setDraft((p)=>({...p,notes:e.target.value}))} />
      </label>
      <div className="flex gap-2"><button type="submit" className={primary}>Save Schedule</button><button type="button" className={outline} onClick={()=>setDraft(null)}>Cancel</button></div>
    </form>}

    {todaySchedules.length===0 ? <div className="rounded-2xl border border-dashed bg-white p-5 text-sm text-slate-500">No sessions scheduled for this date. Add a session to get started.</div> :
      <div className="space-y-3">{todaySchedules.map((schedule)=><div key={schedule.id} className="rounded-2xl border bg-white p-4">
        <div className="flex items-start gap-3">
          <label className="flex flex-1 cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-600" checked={Boolean(checks[schedule.id])} onChange={()=>toggleSession(schedule.id)} />
            <span><span className={`block font-medium ${checks[schedule.id]?"line-through text-slate-400":"text-slate-900"}`}>{schedule.title}</span><span className="mt-1 block text-xs text-slate-500">{schedule.start}–{schedule.end} · {linkLabel(schedule)}</span>{schedule.notes && <span className="mt-1 block text-xs text-slate-500">{schedule.notes}</span>}</span>
          </label>
          <div className="flex flex-wrap gap-2"><button type="button" className={outline} onClick={()=>setDraft({...schedule})}>Edit</button><button type="button" className={`${outline} text-rose-600`} onClick={()=>deleteSchedule(schedule)}>Delete</button></div>
        </div>
        {schedule.linkType!=="none" && <button type="button" className="mt-2 text-xs font-medium text-emerald-700" onClick={()=>onOpenLinked?.(schedule.linkType,schedule.linkId)}>Open linked {schedule.linkType} →</button>}
      </div>)}</div>}

    {flexible.length>0 && <div className="space-y-3">
      <button className={outline} type="button" onClick={()=>setShowFlexible((v)=>!v)}>{showFlexible?"Hide":"Show"} flexible sessions ({flexible.length})</button>
      {showFlexible && flexible.map((schedule)=><div key={schedule.id} className="rounded-2xl border bg-white p-4">
        <div className="flex items-center justify-between gap-3"><div><p className="font-medium">{schedule.title}</p><p className="text-xs text-slate-500">Anytime · {schedule.start}–{schedule.end} · {linkLabel(schedule)}</p></div><div className="flex gap-2"><button type="button" className={outline} onClick={()=>setDraft({...schedule})}>Edit</button><button type="button" className={`${outline} text-rose-600`} onClick={()=>deleteSchedule(schedule)}>Delete</button></div></div>
        {schedule.linkType!=="none" && <button type="button" className="mt-2 text-xs font-medium text-emerald-700" onClick={()=>onOpenLinked?.(schedule.linkType,schedule.linkId)}>Open linked {schedule.linkType} →</button>}
      </div>)}
      <p className="text-xs text-slate-500">Flexible sessions do not count toward daily completion because they have no assigned date.</p>
    </div>}
    <p className="text-xs text-slate-500">Timetable completion resets by selected date; prior dates remain in local history. Changing a daily session does not complete skill milestones.</p>
  </div>;
}
