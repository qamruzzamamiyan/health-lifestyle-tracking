
import { useState } from "react";
import { Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import RegularMealManager from "./RegularMealManager";
import { lookupOfflineUsda } from "../utils/usdaOfflineMatcher";

// Approximate nutrition per indicated unit
const foods = [
  { id: "egg", name: "Boiled Egg", unit: "egg", kcal: 78, protein: 6.5, qty: 2 },
  { id: "banana", name: "Banana", unit: "piece", kcal: 105, protein: 1.3, qty: 1 },
  { id: "milk", name: "Full Cream Milk", unit: "ml", kcal: 0.9, protein: 0.032, qty: 250 },
  { id: "toned", name: "Toned Milk", unit: "ml", kcal: 0.6, protein: 0.032, qty: 250 },
  { id: "almond", name: "Almond", unit: "piece", kcal: 7, protein: 0.26, qty: 15 },
  { id: "honey", name: "Honey", unit: "tsp", kcal: 21, protein: 0, qty: 1 },
  { id: "peanut", name: "Peanut Butter", unit: "tbsp", kcal: 95, protein: 4, qty: 1 },
  { id: "chapati", name: "Chapati", unit: "piece", kcal: 100, protein: 3, qty: 2 },
  { id: "paneer", name: "Paneer Gravy", unit: "bowl", kcal: 320, protein: 13, qty: 1 },
  { id: "amla", name: "Amla Murabba", unit: "piece", kcal: 90, protein: 0.2, qty: 1 }
];

const round1 = (n) => Math.round(n * 10) / 10;

// STEP 17D FREE: Local, rule-based Hindi/Hinglish food understanding.
// No paid AI calls, access codes, or AI API keys are needed.
// A match is accepted only if food type + serving unit are known.
const SMART_FOOD_ALIASES = {
  egg: ["boiled egg", "boiled eggs", "ubla anda", "uble ande", "uble anda", "boiled anda", "boiled ande"],
  banana: ["banana", "bananas", "kela", "kele"],
  milk: ["ml full cream milk", "ml full cream doodh", "ml fullcream milk", "milliliter full cream milk", "millilitre full cream milk"],
  toned: ["ml toned milk", "ml toned doodh", "milliliter toned milk", "millilitre toned milk"],
  almond: ["almond", "almonds", "badam"],
  honey: ["tsp honey", "teaspoon honey", "tsp shahad", "chammach honey"],
  peanut: ["tbsp peanut butter", "tablespoon peanut butter", "tbsp peanut spread"],
  chapati: ["chapati", "chapatis", "roti", "rotis", "phulka", "phulkas"],
  paneer: ["bowl paneer gravy", "bowl paneer curry", "bowl paneer sabzi"],
  amla: ["amla murabba", "amla ka murabba", "piece amla murabba"]
};

function normalizeFoodPhrase(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[।.!]+$/g, "")
    .replace(/\s+/g, " ");
}

function parseLocalMeal(description) {
  const pieces = description
    .split(/\s*(?:,|\+|;|\band\b|\baur\b|और)\s*/i)
    .map(normalizeFoodPhrase)
    .filter(Boolean);

  const items = [];
  const unknown = [];

  for (const piece of pieces) {
    const match = piece.match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
    const qty = match ? Number(match[1]) : 0;
    const foodPhrase = match ? match[2].trim() : "";

    if (!Number.isFinite(qty) || qty <= 0 || qty > 10000) {
      unknown.push(piece);
      continue;
    }

    const food = foods.find(f => SMART_FOOD_ALIASES[f.id]?.includes(foodPhrase));
    if (!food) {
      unknown.push(piece);
      continue;
    }

    items.push({
      foodId: food.id,
      name: food.name,
      quantity: qty,
      unit: food.unit,
      calories: round1(qty * food.kcal),
      protein: round1(qty * food.protein),
      source: "Free offline catalog"
    });
  }

  return { items, unknown };
}


// STEP 17C: Only explicit gram/kilogram quantities can be scaled using
// USDA per-100-g values. Count, bowl, ml, oil and recipe weights need
// their own verified conversion rules (later steps).
function parseGramItem(input) {
  const match = input.match(/^(\d+(?:\.\d+)?)\s*(g|gm|gram|grams|gramme|grammes|kg|kilogram|kilograms)\s+(.+)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const grams = /^(kg|kilogram|kilograms)$/i.test(match[2]) ? amount * 1000 : amount;
  const foodName = match[3].trim().replace(/\s+/g, " ");
  if (!Number.isFinite(grams) || grams <= 0 || grams > 20000 || foodName.length < 2) return null;
  return { grams, foodName, display: input };
}

async function lookupGramFood(item) {
  // Search local static USDA JSON, not a paid API.
  // Candidate is explicitly unconfirmed until the user approves its food name.
  return lookupOfflineUsda(item.foodName, item.grams);
}

function localDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function NutritionTracker({ entries, setEntries,calorieGoal = 2150,
  proteinMin = 60,
  proteinMax = 80 }) {
  const [date, setDate] = useState(localDate);
  const [meal, setMeal] = useState("Breakfast");
  const [mode, setMode] = useState("preset");
  const [foodId, setFoodId] = useState("egg");
  const [quantity, setQuantity] = useState(2);

  const [customName, setCustomName] = useState("");
  const [customCalories, setCustomCalories] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [editingId, setEditingId] = useState(null);

  // Smart free-text meal input, independent of the existing Add Food form.
  const [smartText, setSmartText] = useState("");
  const [smartResult, setSmartResult] = useState(null);
  const [smartLoading, setSmartLoading] = useState(false);

  const selectedFood = foods.find(f => f.id === foodId) || foods[0];
  const dayEntries = entries.filter(e => e.date === date);

  const totalCalories = dayEntries.reduce(
    (sum, e) => sum + e.calories, 0
  );

  const totalProtein = dayEntries.reduce(
    (sum, e) => sum + e.protein, 0
  );

  function saveEntry(e) {
    e.preventDefault();

    let item;

    if (mode === "preset") {
      const qty = Number(quantity);

      if (!Number.isFinite(qty) || qty <= 0) return;

      item = {
        kind: "preset",
        foodId,
        name: selectedFood.name,
        quantity: qty,
        unit: selectedFood.unit,
        calories: round1(qty * selectedFood.kcal),
        protein: round1(qty * selectedFood.protein)
      };
    } else {
      const calories = Number(customCalories);
      const protein = Number(customProtein);

      if (
        !customName.trim() ||
        customCalories === "" ||
        customProtein === "" ||
        !Number.isFinite(calories) ||
        !Number.isFinite(protein) ||
        calories < 0 ||
        protein < 0
      ) return;

      item = {
        kind: "custom",
        foodId: null,
        name: customName.trim(),
        quantity: 1,
        unit: "serving",
        calories: round1(calories),
        protein: round1(protein)
      };
    }

    const record = {
      ...item,
      id: editingId || crypto.randomUUID(),
      date,
      meal
    };

    setEntries(previous =>
      editingId
        ? previous.map(e => e.id === editingId ? record : e)
        : [...previous, record]
    );

    setEditingId(null);
    setCustomName("");
    setCustomCalories("");
    setCustomProtein("");
  }

  function editEntry(entry) {
    setEditingId(entry.id);
    setDate(entry.date);
    setMeal(entry.meal);
    setMode(entry.kind);

    if (entry.kind === "preset") {
      setFoodId(entry.foodId);
      setQuantity(entry.quantity);
    } else {
      setCustomName(entry.name);
      setCustomCalories(String(entry.calories));
      setCustomProtein(String(entry.protein));
    }
  }

  function deleteEntry(id) {
    setEntries(previous => previous.filter(e => e.id !== id));
    if (editingId === id) setEditingId(null);
  }

  async function calculateSmartMeal() {
    if (smartLoading || !smartText.trim()) return;
    setSmartLoading(true);
    setSmartResult(null);
    try {
      if (smartText.length > 400) {
        setSmartResult({ items: [], unknown: ["Keep food input within 400 characters."] });
        return;
      }

      const parts = smartText.split(/\s*(?:,|\+|;|\band\b|\baur\b|और)\s*/i).filter(Boolean);
      if (parts.length > 8) {
        setSmartResult({ items: [], unknown: ["Please enter up to 8 foods at once."] });
        return;
      }

      // Free Hindi/Hinglish local parser: no paid AI request.
      const local = parseLocalMeal(smartText);
      const items = local.items.map(i => ({ ...i, source: "Offline catalog" }));
      const unknown = [];

      // Online lookup only for unrecognized items with explicit gram weights.
      // Failures remain unresolved: no invented nutrition values.
      const resolved = await Promise.all(local.unknown.map(async (part) => {
        const weighted = parseGramItem(part);
        if (!weighted) {
          return { error: `${part} — specify grams (e.g. 150 g cooked rice), or use a known offline unit.` };
        }
        try {
          return await lookupGramFood(weighted);
        } catch (error) {
          return { error: `${part} — ${error.message || "Online lookup failed"}` };
        }
      }));

      for (const result of resolved) {
        if (result.error) unknown.push(result.error);
        else items.push(result);
      }
      setSmartResult({ items, unknown });
    } finally {
      setSmartLoading(false);
    }
  }

  function confirmSmartMatch(index) {
    setSmartResult(previous => {
      if (!previous || !previous.items?.[index]?.requiresConfirmation) return previous;
      const items = previous.items.map((item, idx) =>
        idx === index ? { ...item, requiresConfirmation: false } : item
      );
      return { ...previous, items };
    });
  }

  function addSmartMeal() {
    if (!smartResult || smartResult.items.length === 0 || smartResult.unknown.length > 0 || smartLoading ||
        smartResult.items.some(item => item.requiresConfirmation)) {
      return;
    }

    const records = smartResult.items.map(item => ({
      kind: item.foodId ? "preset" : "custom",
      foodId: item.foodId ?? null,
      name: item.foodId ? item.name : item.displayName,
      quantity: item.foodId ? item.quantity : 1,
      unit: item.foodId ? item.unit : "serving",
      calories: item.calories,
      protein: item.protein,
      ...(item.carbs != null ? { carbs: item.carbs } : {}),
      ...(item.fat != null ? { fat: item.fat } : {}),
      source: item.source,
      ...(item.fdcId ? { fdcId: item.fdcId, matchedName: item.matchedName } : {}),
      id: crypto.randomUUID(),
      date,
      meal
    }));

    setEntries(previous => [...previous, ...records]);
    setSmartText("");
    setSmartResult(null);
  }

  const inputStyle =
    "mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 " +
    "text-sm outline-none focus:border-emerald-500";

  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-2xl font-bold">Diet & Nutrition</h2>
        <p className="mt-1 text-sm text-slate-500">
          Track daily meals, calories and protein.
        </p>
      </div>

      {/* DATE */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <label className="text-sm font-medium">
          Select Date
          <input
            type="date"
            value={date}
            onChange={e => {
              setDate(e.target.value);
              setEditingId(null);
            }}
            className={inputStyle}
          />
        </label>
      </div>

      {/* DAILY SUMMARY */}
      <div className="grid gap-4 sm:grid-cols-2">

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Total Calories</p>
          <h3 className="mt-2 text-3xl font-bold text-emerald-700">
            {Math.round(totalCalories)} kcal
          </h3>
          <p className="mt-2 text-xs text-slate-500">
            Goal: {calorieGoal.toLocaleString("en-IN")} kcal
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{
                width: `${Math.min(100, totalCalories / calorieGoal * 100)}%`
              }}
            />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Total Protein</p>
          <h3 className="mt-2 text-3xl font-bold text-blue-700">
            {round1(totalProtein)} g
          </h3>
          <p className="mt-2 text-xs text-slate-500">
            Goal: {proteinMin}–{proteinMax} g
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{
                width: `${Math.min(100, proteinMax > 0 ? totalProtein / proteinMax * 100 : 0)}%`
              }}
            />
          </div>
        </div>

      </div>

      {/* SMART FREE-TEXT MEAL INPUT — STEP 17A */}
      <section className="space-y-4 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Sparkles size={22} className="mt-1 text-emerald-600" />
          <div>
            <h3 className="text-lg font-bold text-slate-900">Smart Calorie Calculator</h3>
            <p className="mt-1 text-sm text-slate-500">
              Type foods in Hindi, Hinglish or English. Known items work offline;
              gram-based foods use the local USDA database. Verify suggested food matches.
            </p>
          </div>
        </div>

        <label className="block text-sm font-medium">
          What did you eat?
          <textarea
            rows={3}
            value={smartText}
            onChange={e => {
              setSmartText(e.target.value);
              setSmartResult(null);
            }}
            placeholder="2 boiled eggs, 1 banana, 250 ml full cream milk"
            className={inputStyle}
          />
        </label>

        <label className="block text-sm font-medium">
          Meal type
          <select
            value={meal}
            onChange={e => setMeal(e.target.value)}
            className={inputStyle}
          >
            {["Breakfast", "Lunch", "Snacks", "Dinner"].map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={calculateSmartMeal}
          disabled={!smartText.trim() || smartLoading}
          className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {smartLoading ? "Calculating..." : "Calculate Calories"}
        </button>

        {smartResult && (
          <div className="space-y-3 rounded-xl bg-slate-50 p-4">
            {smartResult.items.length > 0 && (
              <>
                <h4 className="font-semibold text-slate-800">Nutrition breakdown</h4>
                {smartResult.items.map((item, index) => (
                  <div key={`${item.foodId || item.fdcId || item.name}-${index}`} className="space-y-1 border-b border-slate-200 pb-2 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span>{item.displayName || `${item.quantity} ${item.unit} × ${item.name}`}</span>
                      <span className="font-medium">{item.calories} kcal · {item.protein} g protein</span>
                    </div>
                    {item.source && <p className="text-xs text-slate-500">Source: {item.source}</p>}
                    {item.matchedName && (
                      <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                        <p className="text-xs text-amber-900">USDA candidate: <strong>{item.matchedName}</strong></p>
                        <p className="text-xs text-amber-800">{item.matchMessage || "Check food and preparation before logging."}</p>
                        {item.requiresConfirmation ? (
                          <button type="button" onClick={() => confirmSmartMatch(index)}
                            className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800">
                            Yes, this matches my food
                          </button>
                        ) : (
                          <p className="text-xs font-semibold text-emerald-700">Food match confirmed by you. Nutrition remains an estimate.</p>
                        )}
                      </div>
                    )}
                    {item.carbs != null && item.fat != null && (
                      <p className="text-xs text-slate-500">Carbs: {item.carbs} g · Fat: {item.fat} g</p>
                    )}
                  </div>
                ))}
                {smartResult.items.some(item => item.requiresConfirmation) && (
                  <p className="text-xs font-medium text-amber-800">
                    Confirm all USDA matched foods before saving to Daily Nutrition or Regular Meals.
                  </p>
                )}
                <p className="border-t border-slate-200 pt-3 text-sm font-semibold text-emerald-700">
                  Estimated total: {round1(smartResult.items.reduce((sum, item) => sum + item.calories, 0))} kcal
                  {" · "}
                  {round1(smartResult.items.reduce((sum, item) => sum + item.protein, 0))} g protein
                </p>
              </>
            )}

            {smartResult.unknown.length > 0 && (
              <div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">Could not calculate these items:</p>
                <ul className="mt-1 list-inside list-disc">
                  {smartResult.unknown.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
                <p className="mt-2">
                  Use a clearer description and quantity in grams for USDA lookup.
                  No calories were guessed. Add All is disabled until every item is resolved.
                </p>
              </div>
            )}

            {smartResult.items.length === 0 && smartResult.unknown.length === 0 && (
              <p className="text-sm text-slate-600">Enter at least one food with its quantity.</p>
            )}

            <button
              type="button"
              disabled={smartResult.items.length === 0 || smartResult.unknown.length > 0 || smartLoading || smartResult.items.some(item => item.requiresConfirmation)}
              onClick={addSmartMeal}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={17} /> Add All to {date}
            </button>
          </div>
        )}

        {/* STEP 17E: Searchable, one-click offline weekly meals */}
        <RegularMealManager
          smartResult={smartResult}
          smartText={smartText}
          date={date}
          meal={meal}
          entries={entries}
          setEntries={setEntries}
        />

        <p className="text-xs leading-5 text-slate-500">
          Free offline: 2 uble ande, 1 kela, 250 ml full cream doodh.
          Free local USDA dataset: 150 g cooked rice or 100 g chicken breast.
          No paid AI service. Unknown foods and unverified bowl sizes are not guessed.
          Regular weekly meals can be saved and searched below.
        </p>
      </section>

      {/* FOOD ENTRY FORM */}
      <form
        onSubmit={saveEntry}
        className="space-y-5 rounded-2xl bg-white p-6 shadow-sm"
      >
        <h3 className="text-lg font-bold">
          {editingId ? "Edit Food Entry" : "Add Food"}
        </h3>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("preset")}
            className={`rounded-xl px-4 py-2 text-sm ${
              mode === "preset"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            Food Database
          </button>

          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`rounded-xl px-4 py-2 text-sm ${
              mode === "custom"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            Custom Food
          </button>
        </div>

        <label className="block text-sm font-medium">
          Meal
          <select
            className={inputStyle}
            value={meal}
            onChange={e => setMeal(e.target.value)}
          >
            {["Breakfast", "Lunch", "Snacks", "Dinner"].map(m => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>

        {mode === "preset" ? (
          <div className="grid gap-4 sm:grid-cols-2">

            <label className="block text-sm font-medium">
              Food Item
              <select
                className={inputStyle}
                value={foodId}
                onChange={e => {
                  const food = foods.find(f => f.id === e.target.value);
                  setFoodId(food.id);
                  setQuantity(food.qty);
                }}
              >
                {foods.map(food => (
                  <option key={food.id} value={food.id}>
                    {food.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Quantity ({selectedFood.unit})
              <input
                type="number"
                min="0.1"
                step="any"
                required
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className={inputStyle}
              />
            </label>

          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">

            <label className="block text-sm font-medium">
              Food Name / Serving
              <input
                required
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="1 bowl dal"
                className={inputStyle}
              />
            </label>

            <label className="block text-sm font-medium">
              Total Calories
              <input
                type="number"
                min="0"
                step="any"
                required
                value={customCalories}
                onChange={e => setCustomCalories(e.target.value)}
                className={inputStyle}
              />
            </label>

            <label className="block text-sm font-medium">
              Total Protein (g)
              <input
                type="number"
                min="0"
                step="any"
                required
                value={customProtein}
                onChange={e => setCustomProtein(e.target.value)}
                className={inputStyle}
              />
            </label>

          </div>
        )}

        {mode === "preset" && (
          <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            Estimated: {round1(Number(quantity || 0) * selectedFood.kcal)} kcal
            {" • "}
            {round1(Number(quantity || 0) * selectedFood.protein)} g protein
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="flex items-center gap-2 rounded-xl
              bg-emerald-600 px-5 py-3 text-sm font-semibold
              text-white hover:bg-emerald-700"
          >
            <Plus size={18} />
            {editingId ? "Update Food" : "Add Food"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded-xl bg-slate-100 px-5 py-3 text-sm"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      {/* SAVED FOOD HISTORY */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-bold">
          Food History — {date}
        </h3>

        {dayEntries.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
            No food logged for this date.
          </p>
        ) : (
          <div className="space-y-3">
            {[...dayEntries].reverse().map(entry => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between
                  gap-3 rounded-xl border border-slate-100 p-4"
              >
                <div>
                  <p className="font-semibold text-slate-800">
                    {entry.kind === "preset"
                      ? `${entry.quantity} ${entry.unit} × ${entry.name}`
                      : entry.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {entry.meal} • {entry.calories} kcal
                    {" • "}{entry.protein} g protein
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => editEntry(entry)}
                    aria-label={`Edit ${entry.name}`}
                    className="rounded-lg bg-blue-50 p-2 text-blue-600"
                  >
                    <Pencil size={17} />
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteEntry(entry.id)}
                    aria-label={`Delete ${entry.name}`}
                    className="rounded-lg bg-red-50 p-2 text-red-600"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs leading-5 text-slate-500">
        Nutrition values are approximate. Actual calories and protein
        depend on portion sizes, brand, ingredients and preparation.
      </p>
    </div>
  );
}
