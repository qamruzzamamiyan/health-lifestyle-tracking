/**
 * Step 20A - offline USDA nutrition regression / integrity tests.
 * Run from the Health & Lifestyle Tracking project root:
 *   node --test tests/testNutritionAccuracy.test.mjs
 *
 * Read-only. No external network calls, API keys, storage mutations, or writes.
 * Built-in Node.js modules only. Against actual public/data/usda_foods_v1.json.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { matchUsdaFoods, lookupOfflineUsda } from '../src/utils/usdaOfflineMatcher.js';

const root = process.cwd();
const file = join(root, 'public', 'data', 'usda_foods_v1.json');
let payload;
try {
  payload = JSON.parse(readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`\nUSDA JSON unavailable at ${file}\n${err.message}\nRun from the project root.\n`);
  process.exit(1);
}
const foods = payload.foods;
const sourceNames = new Set(['Foundation', 'FNDDS', 'SR Legacy']);
const byId = new Map(Array.isArray(foods) ? foods.map(row => [row.id, row]) : []);

// No network: mimic Vite's local /public JSON URL for the real lookup function.
let localFetchCount = 0;
globalThis.fetch = async (url) => {
  assert.equal(url, '/data/usda_foods_v1.json', 'Lookup must fetch local USDA JSON only');
  localFetchCount += 1;
  return { ok: true, json: async () => payload };
};

function top(query, collection = foods) {
  return matchUsdaFoods(query, collection).candidates[0];
}
function approx(actual, expected, tol = 0.05) {
  assert.ok(Math.abs(actual - expected) <= tol,
    `expected ${expected} ± ${tol}, received ${actual}`);
}
function sourceOf(row) {
  assert.ok(row && sourceNames.has(row.source), `Invalid USDA source ${row?.source}`);
}

// ---------- A. Database identity & integrity (10 checks) ----------
test('01 - JSON schema version is usda-foods-web-v1', () => {
  assert.equal(payload.version, 'usda-foods-web-v1');
});
test('02 - declared nutrition basis is per 100 grams', () => {
  assert.match(payload.nutritionBasis, /per 100\s*g/i);
});
test('03 - data is a nonempty array', () => {
  assert.ok(Array.isArray(foods) && foods.length > 0);
});
test('04 - 13,588 curated USDA records present in this version', () => {
  assert.equal(foods.length, 13588);
  assert.equal(payload.recordCount, foods.length);
});
test('05 - all IDs are unique', () => {
  assert.equal(byId.size, foods.length);
});
test('06 - all source labels are approved USDA sources', () => {
  for (const row of foods) sourceOf(row);
});
test('07 - no INDB record is deployed', () => {
  for (const row of foods) assert.match(row.id, /^usda_\d+$/);
});
test('08 - every USDA record has a food name', () => {
  for (const row of foods) assert.ok(typeof row.name === 'string' && row.name.trim().length);
});
test('09 - every record has finite, nonnegative macronutrients', () => {
  for (const row of foods) {
    for (const field of ['kcal100', 'protein100', 'carbs100', 'fat100']) {
      assert.ok(Number.isFinite(row[field]) && row[field] >= 0,
        `${row.id}: bad ${field}=${row[field]}`);
    }
  }
});
test('10 - USDA attribution exists in the JSON', () => {
  assert.match(payload.attribution, /USDA|FoodData Central/i);
});

// ---------- B. Known anchors & real full-dataset matching (9 checks) ----------
test('11 - known cooked rice anchor exists', () => {
  assert.match(byId.get('usda_2708402')?.name || '', /rice.*cooked/i);
});
test('12 - known raw chicken breast anchor exists', () => {
  assert.match(byId.get('usda_2646170')?.name || '', /chicken/i);
});
test('13 - cooked rice retrieves the intended rice anchor', () => {
  assert.equal(top('cooked rice')?.id, 'usda_2708402');
});
test('14 - Hinglish pakke chawal retrieves cooked rice', () => {
  assert.equal(top('pakke chawal')?.id, 'usda_2708402');
});
test('15 - cooked rice does not recommend noodles, cereals, or cream of rice', () => {
  const rows = matchUsdaFoods('cooked rice', foods, 10).candidates;
  assert.ok(rows.length);
  assert.ok(rows.every(row => !/noodle|cereal|cream of rice|pudding|fried rice/i.test(row.name)));
});
test('16 - banana search returns banana rather than banana peppers', () => {
  const rows = matchUsdaFoods('banana', foods, 10).candidates;
  assert.ok(rows.length);
  assert.ok(rows.every(row => !/pepper|chips|bread|smoothie|cake|pudding/i.test(row.name)));
});
test('17 - Hinglish kela returns a banana food', () => {
  assert.match(top('kela')?.name || '', /banana/i);
});
test('18 - chicken breast search excludes processed lunchmeat', () => {
  const rows = matchUsdaFoods('chicken breast', foods, 10).candidates;
  assert.ok(rows.length);
  assert.ok(rows.every(row => !/lunchmeat|sausage|nugget|soup|sandwich|deli/i.test(row.name)));
});
test('19 - egg gram-search is blocked: count/pcs only', () => {
  const result = matchUsdaFoods('uble ande', foods);
  assert.equal(result.candidates.length, 0);
  assert.match(result.message, /pcs/i);
});

// ---------- C. Adversarial matching edge cases (5 checks) ----------
const example = [
  { id: 'usda_2708402', name: 'Rice, cooked, NFS', source: 'FNDDS', kcal100: 129, protein100: 2.67, carbs100: 28, fat100: 0.3 },
  { id: 'usda_168914', name: 'Rice noodles, cooked', source: 'SR Legacy', kcal100: 108, protein100: 1.79, carbs100: 24, fat100: 0.2 },
  { id: 'usda_173914', name: 'Cereals, CREAM OF RICE, cooked with water', source: 'SR Legacy', kcal100: 52, protein100: 0.9, carbs100: 11, fat100: 0 },
  { id: 'usda_2709224', name: 'Banana, raw', source: 'FNDDS', kcal100: 97, protein100: 0.74, carbs100: 22.71, fat100: 0.28 },
  { id: 'usda_2709802', name: 'Peppers, banana, raw', source: 'FNDDS', kcal100: 27, protein100: 1.66, carbs100: 5.3, fat100: 0.45 },
  { id: 'usda_2646170', name: 'Chicken, breast, boneless, skinless, raw', source: 'Foundation', kcal100: 112, protein100: 22.5, carbs100: 0, fat100: 2.6 },
  { id: 'usda_2759004', name: 'Lunchmeat, chicken breast, sliced', source: 'Foundation', kcal100: 100, protein100: 16.4, carbs100: 1, fat100: 3 },
];
test('20 - synthetic rice confusion: plain rice beats rice noodles', () => {
  assert.equal(top('cooked rice', example)?.id, 'usda_2708402');
});
test('21 - asking specifically for rice noodles is allowed', () => {
  assert.equal(top('rice noodles cooked', example)?.id, 'usda_168914');
});
test('22 - synthetic banana confusion: banana peppers are filtered', () => {
  assert.equal(top('banana', example)?.id, 'usda_2709224');
});
test('23 - synthetic chicken confusion: processed lunchmeat is filtered', () => {
  assert.equal(top('chicken breast', example)?.id, 'usda_2646170');
});
test('24 - unavailable database produces no fabricated candidates', () => {
  assert.equal(matchUsdaFoods('cooked rice', null).candidates.length, 0);
});

// ---------- D. Actual app lookup: calculations and confirmation (10 checks) ----------
test('25 - lookup uses the local database; 100 g rice = 129 kcal', async () => {
  const rice = await lookupOfflineUsda('cooked rice', 100);
  assert.equal(rice.fdcId, '2708402');
  approx(rice.calories, 129);
  approx(rice.protein, 2.7);
  assert.equal(rice.unit, 'g');
});
test('26 - 200 g rice scales calories/protein without changing food identity', async () => {
  const rice = await lookupOfflineUsda('cooked rice', 200);
  assert.equal(rice.fdcId, '2708402');
  approx(rice.calories, 258);
  approx(rice.protein, 5.3);
});
test('27 - 250 g rice scales correctly', async () => {
  const rice = await lookupOfflineUsda('cooked rice', 250);
  approx(rice.calories, 322.5);
  approx(rice.protein, 6.7);
});
test('28 - every USDA result requires user confirmation before logging', async () => {
  const rice = await lookupOfflineUsda('pakke chawal', 100);
  assert.equal(rice.requiresConfirmation, true);
  assert.equal(rice.kind, 'usda-candidate');
});
test('29 - unknown food does not invent calories', async () => {
  const result = await lookupOfflineUsda('zzzzunfindablefoodzzzz', 100);
  assert.ok(typeof result.error === 'string' && result.error.length);
  assert.equal(result.calories, undefined);
});
test('30 - zero-gram quantity is rejected', async () => {
  await assert.rejects(() => lookupOfflineUsda('cooked rice', 0), /valid quantity/i);
});
test('31 - negative-gram quantity is rejected', async () => {
  await assert.rejects(() => lookupOfflineUsda('cooked rice', -100), /valid quantity/i);
});
test('32 - NaN quantity is rejected', async () => {
  await assert.rejects(() => lookupOfflineUsda('cooked rice', Number.NaN), /valid quantity/i);
});
test('33 - quantity above 20 kg is rejected', async () => {
  await assert.rejects(() => lookupOfflineUsda('cooked rice', 20001), /valid quantity/i);
});
test('34 - repeated searches reuse cached local JSON', async () => {
  await lookupOfflineUsda('cooked rice', 150);
  assert.equal(localFetchCount, 1);
});

// ---------- E. Static safeguards (not a browser UI test) (3 checks) ----------
const trackerSource = readFileSync(join(root, 'src/components/NutritionTracker.jsx'), 'utf8');
const regularSource = readFileSync(join(root, 'src/components/RegularMealManager.jsx'), 'utf8');
test('35 - tracker source includes confirmation guard before adding meals', () => {
  assert.match(trackerSource, /smartResult\.items\.some\(item\s*=>\s*item\.requiresConfirmation\)/);
});
test('36 - tracker source includes Hinglish egg aliases', () => {
  assert.match(trackerSource, /uble ande/);
  assert.match(trackerSource, /kcal:\s*78\s*,\s*protein:\s*6\.5/);
});
test('37 - Regular Meals source checks the confirmation flag', () => {
  assert.match(regularSource, /!smartResult\.items\.some\(item\s*=>\s*item\.requiresConfirmation\)/);
});
