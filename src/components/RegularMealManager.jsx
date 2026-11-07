import { useEffect, useMemo, useState } from "react";
import { BookmarkPlus, CalendarDays, Download, Upload, Plus, Search, Pencil, Trash2 } from "lucide-react";

// Offline saved meal templates, SEPARATE from hlt_food_entries_v1.
// Existing food history is not modified until the user explicitly adds a meal.
const STORAGE_KEY = "hlt_regular_meals_v1";
const DAYS = [
  { id: 1, label: "Mon" }, { id: 2, label: "Tue" },
  { id: 3, label: "Wed" }, { id: 4, label: "Thu" },
  { id: 5, label: "Fri" }, { id: 6, label: "Sat" },
  { id: 0, label: "Sun" }
];
const MEAL_TYPES = ["Breakfast", "Lunch", "Snacks", "Dinner"];
const round1 = n => Math.round(n * 10) / 10;

function validItem(item) {
  return item && typeof item.name === "string" && item.name.trim() &&
    Number.isFinite(item.calories) && item.calories >= 0 &&
    Number.isFinite(item.protein) && item.protein >= 0 &&
    Number.isFinite(item.quantity) && item.quantity > 0 &&
    typeof item.unit === "string";
}

function validTemplate(meal) {
  return meal && typeof meal.id === "string" && typeof meal.name === "string" &&
    meal.name.trim().length > 0 && meal.name.length <= 70 &&
    MEAL_TYPES.includes(meal.mealType) &&
    Array.isArray(meal.weekdays) && meal.weekdays.every(d => Number.isInteger(d) && d >= 0 && d <= 6) &&
    Array.isArray(meal.items) && meal.items.length > 0 && meal.items.length <= 8 &&
    meal.items.every(validItem);
}

function loadMeals() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data.filter(validTemplate).slice(0, 200) : [];
  } catch {
    return [];
  }
}

function dayOf(date) {
  // Local noon avoids UTC date shifts when reading YYYY-MM-DD.
  return new Date(`${date}T12:00:00`).getDay();
}

function makeLogEntry(item, savedMeal, date) {
  const preset = Boolean(item.foodId);
  return {
    kind: preset ? "preset" : "custom",
    foodId: item.foodId || null,
    name: preset ? item.name : (item.displayName || item.name),
    quantity: preset ? item.quantity : 1,
    unit: preset ? item.unit : "serving",
    calories: item.calories,
    protein: item.protein,
    ...(Number.isFinite(item.carbs) ? { carbs: item.carbs } : {}),
    ...(Number.isFinite(item.fat) ? { fat: item.fat } : {}),
    ...(item.source ? { source: item.source } : {}),
    ...(item.fdcId ? { fdcId: item.fdcId, matchedName: item.matchedName } : {}),
    regularMealId: savedMeal.id,
    regularMealName: savedMeal.name,
    id: crypto.randomUUID(),
    date,
    meal: savedMeal.mealType
  };
}

function DaysPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Regular weekdays">
      {DAYS.map(day => (
        <button
          key={day.id}
          type="button"
          aria-pressed={value.includes(day.id)}
          onClick={() => onChange(value.includes(day.id)
            ? value.filter(id => id !== day.id)
            : [...value, day.id])}
          className={`rounded-lg border px-3 py-2 text-sm transition ${
            value.includes(day.id)
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-emerald-50"
          }`}
        >
          {day.label}
        </button>
      ))}
    </div>
  );
}

export default function RegularMealManager({ smartResult, smartText, date, meal, entries, setEntries }) {
  const [savedMeals, setSavedMeals] = useState(loadMeals);
  const [search, setSearch] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [declinedSave, setDeclinedSave] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDays, setNewDays] = useState([]);
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDays, setEditDays] = useState([]);
  const [editType, setEditType] = useState("Lunch");

  const calculated = smartResult &&
    Array.isArray(smartResult.items) && smartResult.items.length > 0 &&
    Array.isArray(smartResult.unknown) && smartResult.unknown.length === 0 &&
    !smartResult.items.some(item => item.requiresConfirmation);

  useEffect(() => {
    setShowSave(false);
    setDeclinedSave(false);
    setNotice("");
  }, [smartResult]);

  const weekday = dayOf(date);
  const matching = useMemo(() => {
    const q = search.toLocaleLowerCase().trim();
    return savedMeals.filter(item =>
      !q || [item.name, item.mealType, ...item.items.map(i => i.displayName || i.name)]
        .join(" ").toLocaleLowerCase().includes(q)
    ).sort((a, b) => {
      const aToday = a.weekdays.includes(weekday) ? 1 : 0;
      const bToday = b.weekdays.includes(weekday) ? 1 : 0;
      return bToday - aToday || a.name.localeCompare(b.name);
    });
  }, [savedMeals, search, weekday]);

  function persist(next) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSavedMeals(next);
      return true;
    } catch {
      setNotice("Unable to save: device storage may be full or blocked. Please do not clear app data.");
      return false;
    }
  }

  function saveCalculatedMeal() {
    if (!calculated) return;
    const title = newName.trim();
    if (!title || title.length > 70) {
      setNotice("Enter a meal name (1–70 characters).");
      return;
    }
    if (newDays.length === 0) {
      setNotice("Select at least one regular weekday.");
      return;
    }
    if (savedMeals.some(item => item.name.toLocaleLowerCase() === title.toLocaleLowerCase())) {
      setNotice("That meal name is already saved. Choose another name or edit the existing meal.");
      return;
    }
    if (savedMeals.length >= 200) {
      setNotice("Saved meal limit reached (200). Remove an old meal first.");
      return;
    }

    // Save the full calculated nutrition snapshot. This remains usable offline.
    const template = {
      id: crypto.randomUUID(),
      name: title,
      mealType: meal,
      weekdays: [...new Set(newDays)],
      description: String(smartText || "").slice(0, 400),
      items: smartResult.items.map(item => ({
        foodId: item.foodId || null,
        name: item.name,
        ...(item.displayName ? { displayName: item.displayName } : {}),
        quantity: item.quantity,
        unit: item.unit,
        calories: item.calories,
        protein: item.protein,
        ...(Number.isFinite(item.carbs) ? { carbs: item.carbs } : {}),
        ...(Number.isFinite(item.fat) ? { fat: item.fat } : {}),
        ...(item.source ? { source: item.source } : {}),
        ...(item.fdcId ? { fdcId: item.fdcId, matchedName: item.matchedName } : {})
      })),
      createdAt: new Date().toISOString()
    };

    if (!validTemplate(template)) {
      setNotice("This calculation could not be saved safely. Check quantities and try again.");
      return;
    }
    if (persist([...savedMeals, template])) {
      setShowSave(false);
      setDeclinedSave(true);
      setSelectedId(template.id);
      setNewName("");
      setNewDays([]);
      setNotice(`Saved "${title}" for offline use. It has NOT been added to your daily calories.`);
    }
  }

  function addToLog(template) {
    if (entries.some(item => item.date === date && item.regularMealId === template.id)) {
      if (!window.confirm(`You have already added "${template.name}" on ${date}. Add it again?`)) return;
    }
    const records = template.items.map(item => makeLogEntry(item, template, date));
    setEntries(previous => [...previous, ...records]);
    setSelectedId(template.id);
    setNotice(`Added "${template.name}" (${round1(template.items.reduce((n, i) => n + i.calories, 0))} kcal) to ${date}.`);
  }

  function edit(template) {
    setEditId(template.id);
    setEditName(template.name);
    setEditDays([...template.weekdays]);
    setEditType(template.mealType);
    setSelectedId(template.id);
    setNotice("");
  }

  function saveEdit() {
    const title = editName.trim();
    if (!title || title.length > 70 || editDays.length === 0) {
      setNotice("Enter a meal name and choose at least one weekday.");
      return;
    }
    if (savedMeals.some(item => item.id !== editId && item.name.toLocaleLowerCase() === title.toLocaleLowerCase())) {
      setNotice("Another saved meal already uses that name.");
      return;
    }
    const next = savedMeals.map(item => item.id === editId ? {
      ...item,
      name: title,
      mealType: editType,
      weekdays: [...new Set(editDays)]
    } : item);
    if (persist(next)) {
      setEditId(null);
      setNotice("Regular meal updated. Previously logged food entries remain unchanged.");
    }
  }

  function remove(template) {
    if (!window.confirm(`Delete saved meal "${template.name}"? Previously logged food entries will remain.`)) return;
    if (persist(savedMeals.filter(item => item.id !== template.id))) {
      if (selectedId === template.id) setSelectedId(null);
      if (editId === template.id) setEditId(null);
      setNotice(`Deleted saved template "${template.name}". Daily food history is unchanged.`);
    }
  }

  function exportMeals() {
    const backup = {
      type: "hlt-regular-meals",
      version: 1,
      exportedAt: new Date().toISOString(),
      regularMeals: savedMeals
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hlt-regular-meals-${date}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function importMeals(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setNotice("Backup file is too large (maximum 1 MB).");
      return;
    }
    try {
      const data = JSON.parse(await file.text());
      const list = data?.regularMeals;
      if (data?.type !== "hlt-regular-meals" || data?.version !== 1 ||
          !Array.isArray(list) || list.length > 200 ||
          !list.every(validTemplate) ||
          new Set(list.map(item => item.id)).size !== list.length) {
        setNotice("Invalid saved-meals backup. Nothing was changed.");
        return;
      }
      if (!window.confirm(`Import ${list.length} saved meals? This REPLACES the ${savedMeals.length} saved meals currently on this device. Existing food history remains unchanged.`)) return;
      if (persist(list)) {
        setSelectedId(null);
        setEditId(null);
        setNotice(`Imported ${list.length} saved meals. Existing food history remains unchanged.`);
      }
    } catch {
      setNotice("Could not read that saved-meals JSON backup. Nothing was changed.");
    }
  }

  const inputClass = "w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-500";
  return (
    <div className="space-y-5 border-t border-emerald-100 pt-5">
      {calculated && (
        <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-start gap-2">
            <BookmarkPlus className="mt-0.5 shrink-0 text-emerald-700" size={20} />
            <div>
              <h4 className="font-semibold text-emerald-950">Is this a regular weekly meal?</h4>
              <p className="text-xs text-emerald-800">Save the calculated meal once, then add it to your log offline with one click.</p>
            </div>
          </div>
          {!showSave ? (
            declinedSave ? (
              <button type="button" onClick={() => { setShowSave(true); setDeclinedSave(false); }}
                className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-800">
                Change mind? Save this meal
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setShowSave(true); setNotice(""); }}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                  Yes, save meal
                </button>
                <button type="button" onClick={() => setDeclinedSave(true)}
                  className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm text-slate-700">
                  No, just this time
                </button>
              </div>
            )
          ) : (
            <div className="space-y-3 rounded-xl bg-white p-3">
              <label className="block text-sm font-medium">Meal name
                <input value={newName} onChange={e => setNewName(e.target.value)} maxLength={70}
                  placeholder="e.g. Mess Lunch" className={`mt-2 ${inputClass}`} />
              </label>
              <div>
                <p className="mb-2 text-sm font-medium">Which days do you usually eat it?</p>
                <DaysPicker value={newDays} onChange={setNewDays} />
              </div>
              <p className="text-xs text-slate-600">Meal type: {meal}. This saves a recipe, not an eaten entry.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={saveCalculatedMeal}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Save Regular Meal</button>
                <button type="button" onClick={() => setShowSave(false)}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      <section className="space-y-3" aria-label="Saved regular meals">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays size={20} className="text-emerald-600" />
            <h4 className="text-base font-bold text-slate-900">My Regular Meals</h4>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={exportMeals} disabled={savedMeals.length === 0}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 disabled:opacity-40">
              <Download size={14} /> Export
            </button>
            <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">
              <Upload size={14} /> Import
              <input type="file" accept=".json,application/json" onChange={importMeals} className="sr-only" />
            </label>
          </div>
        </div>
        <p className="text-xs text-slate-500">Search your saved meals offline. Meals planned for the selected date appear first; other saved meals are still available.</p>
        <label className="relative block">
          <Search size={18} className="absolute left-3 top-3.5 text-slate-400" />
          <span className="sr-only">Search regular meals</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search saved meals or ingredients..." className={`${inputClass} pl-10`} />
        </label>
        <p className="text-xs text-slate-500">{matching.length} of {savedMeals.length} saved meals</p>
        {matching.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            {savedMeals.length ? "No matching saved meals." : "No regular meals saved yet. Calculate a meal above and choose Yes, save meal."}
          </p>
        ) : (
          <div className="space-y-2">
            {matching.map(template => {
              const isToday = template.weekdays.includes(weekday);
              const selected = template.id === selectedId;
              const kcal = round1(template.items.reduce((sum, item) => sum + item.calories, 0));
              const protein = round1(template.items.reduce((sum, item) => sum + item.protein, 0));
              return (
                <div key={template.id} className={`rounded-xl border p-3 ${selected ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button type="button" onClick={() => setSelectedId(selected ? null : template.id)}
                      className="min-w-0 flex-1 text-left" aria-expanded={selected}>
                      <p className="font-semibold text-slate-900">{template.name} {isToday && <span className="ml-1 text-xs font-normal text-emerald-700">Scheduled</span>}</p>
                      <p className="mt-1 text-xs text-slate-600">{template.items.map(i => i.displayName || `${i.quantity} ${i.unit} ${i.name}`).join(" + ")}</p>
                      <p className="mt-1 text-xs text-slate-500">{kcal} kcal · {protein} g protein · {template.mealType}</p>
                    </button>
                    <button type="button" onClick={() => addToLog(template)}
                      className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                      aria-label={`Add ${template.name} to ${date}`}>
                      <Plus size={16} /> Add
                    </button>
                  </div>
                  {selected && (
                    <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                      <p className="text-xs text-slate-600">Regular days: {DAYS.filter(d => template.weekdays.includes(d.id)).map(d => d.label).join(", ")}</p>
                      <p className="text-xs text-slate-500">Saved quantities and nutrition values work offline. No meal is auto-logged.</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => edit(template)}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"><Pencil size={14} /> Edit details</button>
                        <button type="button" onClick={() => remove(template)}
                          className="flex items-center gap-1 rounded-lg border border-red-100 px-3 py-2 text-xs text-red-600"><Trash2 size={14} /> Delete</button>
                      </div>
                    </div>
                  )}
                  {editId === template.id && (
                    <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
                      <label className="block text-sm font-medium">Meal name
                        <input className={`mt-2 ${inputClass}`} maxLength={70} value={editName} onChange={e => setEditName(e.target.value)} />
                      </label>
                      <label className="block text-sm font-medium">Meal type
                        <select className={`mt-2 ${inputClass}`} value={editType} onChange={e => setEditType(e.target.value)}>
                          {MEAL_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </label>
                      <DaysPicker value={editDays} onChange={setEditDays} />
                      <div className="flex gap-2">
                        <button type="button" onClick={saveEdit} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white">Save changes</button>
                        <button type="button" onClick={() => setEditId(null)} className="rounded-lg bg-white px-3 py-2 text-sm">Cancel</button>
                      </div>
                      <p className="text-xs text-slate-500">Changing ingredient quantities comes in Step 17G. Previously logged food history stays unchanged.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {notice && <p role="status" className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{notice}</p>}
        <p className="text-xs leading-5 text-slate-500">
          Saved meals work offline on this device. Mac and iPhone do not automatically sync. Use Export/Import for these saved meals:
          the existing Backup & Export module may not include this new storage key yet.
        </p>
      </section>
    </div>
  );
}
