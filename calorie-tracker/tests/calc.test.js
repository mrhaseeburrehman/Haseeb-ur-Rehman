import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bmr, dailyBudget, buildTrend, addDays, daysBetween } from '../calc.js';
import { parseMealText } from '../foods.js';

const profile = {
  sex: 'male', age: 35, heightCm: 180, weightKg: 90, targetKg: 85,
  activity: 'sedentary', pace: 0.5, weeklyRateKg: -0.5, startDay: '2026-10-01',
};

test('bmr uses Mifflin-St Jeor', () => {
  assert.equal(bmr(profile), 10 * 90 + 6.25 * 180 - 5 * 35 + 5);
});

test('daily budget subtracts the weekly deficit', () => {
  const tdee = bmr(profile) * 1.2;
  assert.equal(dailyBudget(profile), Math.round(tdee - 550));
});

test('date helpers cross month boundaries', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(daysBetween('2026-10-01', '2026-10-15'), 14);
});

test('trend with no meals falls back to the plan', () => {
  const t = buildTrend({ profile, meals: [], weights: [] }, '2026-10-05');
  assert.equal(t.loggedDays, 0);
  assert.ok(t.etaDay > '2026-10-05');
  assert.equal(t.etaDay, t.plannedDay);
});

test('eating under budget moves the target date closer, overeating removes it', () => {
  const meals = (kcal) => [...Array(10)].map((_, i) => ({
    day: addDays('2026-10-01', i), items: [{ name: 'x', calories: kcal }],
  }));
  const strict = buildTrend({ profile, meals: meals(1500), weights: [] }, '2026-10-11');
  const loose = buildTrend({ profile, meals: meals(2200), weights: [] }, '2026-10-11');
  const over = buildTrend({ profile, meals: meals(3500), weights: [] }, '2026-10-11');
  assert.ok(strict.current < 90);
  assert.ok(strict.etaDay < loose.etaDay);
  assert.equal(over.etaDay, null);
  assert.ok(over.avgBalance > 0);
});

test('weigh-ins pull the estimate toward the scale', () => {
  const t = buildTrend({ profile, meals: [], weights: [{ day: '2026-10-03', kg: 88 }] }, '2026-10-04');
  assert.equal(t.current, 89);
});

test('text parser recognises quantities and multi-word foods', () => {
  const items = parseMealText('2 eggs, a slice of toast and an orange juice');
  assert.deepEqual(items.map((i) => i.calories), [156, 80, 110]);
});
