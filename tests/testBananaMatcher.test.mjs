import test from 'node:test';
import assert from 'node:assert/strict';
import { matchUsdaFoods } from '../src/utils/usdaOfflineMatcher.js';

function food(id, name) {
  return { id: `usda_${id}`, name, source: 'FNDDS', kcal100: 90,
    protein100: 1, carbs100: 22, fat100: .3 };
}
const candidates = [
  food(1, 'Banana, raw'),
  food(2, 'Bananas, ripe and slightly ripe, raw'),
  food(3, 'Peppers, banana, raw'),
  food(4, 'Banana pancakes'),
  food(5, 'Banana smoothie'),
  food(6, 'Banana breadfruit cake'),
  food(7, 'Banana chips'),
  food(8, 'Banana pudding'),
  food(9, 'Banana, fresh, organic')
];

test('plain banana returns only banana fruit candidates', () => {
  const rows = matchUsdaFoods('banana', candidates, 10).candidates;
  assert.ok(rows.length >= 2);
  assert.ok(rows.every(row => !/pepper|chip|bread|smoothie|cake|pudding|pancake/i.test(row.name)));
});
test('Hinglish kela follows the same plain-fruit rule', () => {
  const rows = matchUsdaFoods('kela', candidates, 10).candidates;
  assert.ok(rows.length);
  assert.ok(rows.every(row => !/pepper|chip|bread|smoothie|cake|pudding|pancake/i.test(row.name)));
});
test('explicit banana smoothie query remains searchable', () => {
  assert.equal(matchUsdaFoods('banana smoothie', candidates).candidates[0]?.name, 'Banana smoothie');
});
test('explicit banana chips query remains searchable', () => {
  assert.equal(matchUsdaFoods('banana chips', candidates).candidates[0]?.name, 'Banana chips');
});
