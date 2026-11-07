import assert from "node:assert/strict";
import { matchUsdaFoods } from "../src/utils/usdaOfflineMatcher.js";

const sample = [
  { id: "usda_2708402", name: "Rice, cooked, NFS", source: "FNDDS", kcal100: 129, protein100: 2.67, carbs100: 28, fat100: 0.3 },
  { id: "usda_168914", name: "Rice noodles, cooked", source: "SR Legacy", kcal100: 108, protein100: 1.79, carbs100: 24, fat100: 0.2 },
  { id: "usda_173914", name: "Cereals, CREAM OF RICE, cooked with water, with salt", source: "SR Legacy", kcal100: 52, protein100: 0.9, carbs100: 11, fat100: 0 },
  { id: "usda_2709224", name: "Banana, raw", source: "FNDDS", kcal100: 97, protein100: 0.74, carbs100: 22.71, fat100: 0.28 },
  { id: "usda_2709802", name: "Peppers, banana, raw", source: "FNDDS", kcal100: 27, protein100: 1.66, carbs100: 5.3, fat100: 0.45 },
  { id: "usda_2646170", name: "Chicken, breast, boneless, skinless, raw", source: "Foundation", kcal100: 112, protein100: 22.5, carbs100: 0, fat100: 2.6 },
  { id: "usda_2759004", name: "Lunchmeat, chicken breast, sliced", source: "Foundation", kcal100: 100, protein100: 16.4, carbs100: 1, fat100: 3 },
  { id: "usda_2707427", name: "Dal", source: "FNDDS", kcal100: 145, protein100: 8.6, carbs100: 21.5, fat100: 2 },
];
function test(query, expected) {
  const match = matchUsdaFoods(query, sample);
  assert.equal(match.candidates[0]?.id, expected, `Wrong candidate for ${query}`);
  console.log("PASS", query, "→", match.candidates[0]?.name);
}
test("cooked rice", "usda_2708402");
test("rice noodles, cooked", "usda_168914");
test("pakke chawal", "usda_2708402");
test("kela", "usda_2709224");
test("chicken breast", "usda_2646170");
test("dal", "usda_2707427");
assert.equal(matchUsdaFoods("uble ande", sample).candidates.length, 0, "Eggs must stay pieces-only");
assert.equal(matchUsdaFoods("banana", sample).candidates.some(x => /peppers/i.test(x.name)), false);
assert.equal(matchUsdaFoods("cooked rice", sample).candidates.some(x => /noodle|cereal/i.test(x.name)), false);
console.log("All 9 matcher assertions passed (sample data only).");
