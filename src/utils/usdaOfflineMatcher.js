/** USDA-only, free static JSON matcher. Candidate ranking is heuristic, not accuracy %. */
const NORMALIZE = {
  chawal: "rice", chaval: "rice", pakke: "cooked", paka: "cooked",
  pakka: "cooked", pake: "cooked", pakki: "cooked", pakaya: "cooked",
  kela: "banana", kele: "banana", bananas: "banana",
  anda: "egg", ande: "egg", eggs: "egg", uble: "boiled", ubla: "boiled",
  ubli: "boiled", ubale: "boiled", doodh: "milk", dudh: "milk",
  daal: "dal", dahl: "dal", kaccha: "raw", kacchi: "raw",
  bhuna: "roasted", bhune: "roasted", bhuni: "roasted",
  rotis: "chapati", roti: "chapati", chapatis: "chapati",
};
const STOP = new Set(["a", "an", "the", "of", "and", "aur", "with", "some", "plain", "fresh", "nfs"]);
const PREP = new Set(["raw", "cooked", "boiled", "fried", "baked", "roasted", "steamed", "grilled", "dried"]);
const BLOCKED = {
  rice: new Set(["noodle", "noodles", "pasta", "vermicelli", "flour", "pudding", "cereal", "cereals", "cream", "cracker", "cake", "bread", "milk", "bran", "chips", "cookie", "fried", "risotto", "biryani", "pilaf", "sushi", "wild", "brown", "black", "red", "oil", "butter", "fat", "honey", "sweet", "sugar", "margarine", "glutinous", "sticky", "ingredient", "coconut", "ghee", "mung", "bean", "beans"]),
  banana: new Set(["powder", "dehydrated", "dried", "chips", "chip", "bread", "cake", "pudding", "pie", "nectar", "juice", "smoothie", "milkshake", "melon", "pepper", "peppers", "babyfood", "flour", "split", "baked", "fried", "overripe", "curry", "kofta", "chutney", "pakora", "halwa", "dessert", "appam", "raita", "pancake", "fritters", "ice", "cream"]),
  chicken: new Set(["nugget", "nuggets", "soup", "noodle", "sandwich", "salad", "sausage", "stock", "broth", "lunchmeat", "sliced", "deli", "roll", "processed", "breaded"]),
};
const GENERIC = new Set(["rice", "chicken", "dal", "milk", "paneer"]);
// A bare "banana" / "kela" means the fruit, not a banana-based recipe.
// Exact token whitelist excludes peppers, chips, pancakes, smoothies, desserts.
const PLAIN_BANANA_ALLOWED_TOKENS = new Set([
  "banana", "raw", "ripe", "slightly", "fresh", "green", "yellow",
  "unripe", "whole", "peeled", "peel", "without", "organic",
  "fruit", "frozen", "unsweetened", "mature", "cavendish", "nfs"
]);


function tokens(value) {
  return String(value).toLowerCase().match(/[a-z0-9]+/g)?.map(t => NORMALIZE[t] || t)
    .filter(t => !STOP.has(t)) || [];
}
function allPresent(required, candidate) {
  return required.every(word => candidate.includes(word));
}
function round1(number) { return Math.round(number * 10) / 10; }
function usable(row) {
  return row && typeof row.name === "string" && Number.isFinite(row.kcal100) && row.kcal100 >= 0 &&
    Number.isFinite(row.protein100) && row.protein100 >= 0 && Number.isFinite(row.carbs100) &&
    Number.isFinite(row.fat100) && typeof row.id === "string";
}

/** Query is food name WITHOUT weight; supply grams separately. */
export function matchUsdaFoods(query, foods, limit = 5) {
  const qt = [...new Set(tokens(query))];
  const core = qt.filter(t => !PREP.has(t) && t !== "white" && t !== "brown");
  if (core.length === 0) return { candidates: [], message: "Food name required." };
  // Eggs are intentionally count-only in this app.
  if (core.includes("egg")) return { candidates: [], message: "Eggs ko pcs mein likho (e.g. 2 uble ande), grams mein nahi." };
  if (!Array.isArray(foods)) return { candidates: [], message: "Offline database unavailable." };
  const candidates = [];
  for (const row of foods) {
    if (!usable(row)) continue;
    const nameTokens = [...new Set(tokens(row.name))];
    // Whole banana fruit queries must not suggest prepared foods.
    // Explicit queries such as "banana smoothie" still use normal matching.
    if (qt.length === 1 && qt[0] === "banana" &&
        nameTokens.some(t => !PLAIN_BANANA_ALLOWED_TOKENS.has(t))) continue;

    if (!allPresent(core, nameTokens)) continue;
    if (!allPresent(qt.filter(t => PREP.has(t) || t === "white" || t === "brown"), nameTokens)) continue;
    const extra = nameTokens.filter(t => !qt.includes(t));
    let incompatible = false;
    for (const [family, blocked] of Object.entries(BLOCKED)) {
      if (core.includes(family) && extra.some(t => blocked.has(t))) { incompatible = true; break; }
    }
    if (incompatible) continue;
    if (qt.includes("cooked") && nameTokens.some(t => ["raw", "uncooked", "dried", "dry"].includes(t))) continue;
    if (qt.includes("raw") && nameTokens.some(t => ["cooked", "fried", "roasted", "baked"].includes(t))) continue;
    let score = 60 + qt.filter(t => nameTokens.includes(t)).length * 12 - extra.length * 2.5;
    if (qt.includes("banana") && qt.every(t => !PREP.has(t)) && nameTokens.includes("raw")) score += 9;
    if (qt.includes("rice") && qt.includes("cooked") && nameTokens.includes("nfs")) score += 7;
    if (row.source === "Foundation") score += 0.25;
    candidates.push({ ...row, score: round1(score) });
  }
  candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const top = candidates.slice(0, Math.max(1, Math.min(10, limit)));
  let message = top.length ? "Verify matched food and preparation before logging." : "No suitable exact-word USDA match. Try a clearer description.";
  if (core.some(t => GENERIC.has(t)) && !qt.some(t => PREP.has(t))) {
    message = top.length ? "Food/preparation unspecified; verify the suggested match before logging." : message;
  }
  return { candidates: top, message };
}

let datasetPromise = null;
/** Read the local USDA file under public/data. No paid API or secret key needed. */
export async function loadUsdaDatabase() {
  if (!datasetPromise) {
    datasetPromise = (async () => {
      const base = import.meta.env?.BASE_URL || "/";
      const url = `${base.replace(/\/?$/, "/")}data/usda_foods_v1.json`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`USDA dataset not available (HTTP ${response.status})`);
      const payload = await response.json();
      if (payload?.version !== "usda-foods-web-v1" || !Array.isArray(payload.foods) || payload.foods.length === 0) {
        throw new Error("USDA dataset schema mismatch; expected v1 JSON with foods[].");
      }
      return payload.foods;
    })().catch(error => { datasetPromise = null; throw error; });
  }
  return datasetPromise;
}

export async function lookupOfflineUsda(foodName, grams) {
  if (!Number.isFinite(grams) || grams <= 0 || grams > 20000) {
    throw new Error("Please enter a valid quantity in grams (up to 20 kg).");
  }
  const foods = await loadUsdaDatabase();
  const matched = matchUsdaFoods(foodName, foods);
  if (!matched.candidates.length) return { error: matched.message };
  const best = matched.candidates[0];
  const factor = grams / 100;
  return {
    kind: "usda-candidate",
    name: foodName,
    displayName: `${grams} g ${foodName}`,
    quantity: grams,
    unit: "g",
    calories: round1(best.kcal100 * factor),
    protein: round1(best.protein100 * factor),
    carbs: round1(best.carbs100 * factor),
    fat: round1(best.fat100 * factor),
    matchedName: best.name,
    fdcId: best.id.replace("usda_", ""),
    source: `USDA ${best.source} (local database)`,
    requiresConfirmation: true,
    matchMessage: matched.message,
    otherCandidates: matched.candidates.slice(1).map(row => ({ id: row.id, name: row.name })),
  };
}
