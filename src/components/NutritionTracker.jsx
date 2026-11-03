
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";

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
