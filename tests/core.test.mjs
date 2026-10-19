import test from 'node:test';
import assert from 'node:assert/strict';
import { Workspace, STORAGE_KEY, RECOVERY_KEY, dateKey, validDate, shiftDate, dateRange, emptyDay, newWorkspace, totals, dayTotals, portion, validateWorkspace, parseBackup, migrateFitCat, readLegacy, makeDemo, escapeHTML, toCSV } from '../app/core.js';
import { PRODUCTS, RECIPES, recipeNutrition } from '../app/data.js';

function memory(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { map, get length() { return map.size; }, key: i => [...map.keys()][i], getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) };
}
const food = (overrides = {}) => ({ id: 'f1', name: 'Тестовый продукт', meal: 'lunch', weight: 150, kcal: 180, protein: 10, fat: 5, carbs: 20, checked: true, ...overrides });
const fitcat = () => ({ version: 3, profile: { name: 'Ирина', age: 30, weight: 65, height: 170, gender: 'female', goal: 'maintain' }, foods: [food(), food({ id: 'f2', checked: false })], weight: [{ date: '2026-10-17', weight: 65 }], nutrition: [{ date: '2026-10-17', kcal: 1800, protein: 100, fat: 60, carbs: 210 }], water: 1250, lastDate: 'Sun Oct 18 2026', settings: { currentSteps: 5000, dailyActivity: 1.375 }, products: [], templates: [], wallet: { sample: true }, appearance: { sample: true } });

test('calendar keys validate real dates, reject overflow and respect leap years', () => {
  assert.equal(validDate('2026-02-29'), false); assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2026-13-01'), false); assert.equal(validDate('2026-10-19T00:00'), false);
  assert.equal(shiftDate('2026-03-01', -1), '2026-02-28'); assert.equal(shiftDate('2024-03-01', -1), '2024-02-29');
  assert.deepEqual(dateRange('2026-01-02', 3), ['2025-12-31', '2026-01-01', '2026-01-02']);
});
test('dateKey uses local calendar components rather than UTC truncation', () => {
  assert.equal(dateKey(new Date(2026, 9, 19, 0, 1)), '2026-10-19');
});
test('nutrition counts eaten entries and supports planned totals separately', () => {
  assert.equal(totals([food(), food({ checked: false })]).kcal, 180);
  assert.equal(totals([food(), food({ checked: false })], false).kcal, 360);
  assert.equal(totals([]).protein, 0);
});
test('portion scales all four nutrients and rejects invalid portions and composition', () => {
  assert.deepEqual(portion({ kcal: 120, protein: 10, fat: 4, carbs: 12 }, 250), { kcal: 300, protein: 25, fat: 10, carbs: 30 });
  for (const grams of [0, -1, NaN, Infinity, 10001]) assert.throws(() => portion(PRODUCTS[0], grams));
  assert.throws(() => portion({ kcal: Infinity, protein: 10, fat: 4, carbs: 12 }, 100));
  assert.throws(() => portion({ kcal: 120, protein: -1, fat: 4, carbs: 12 }, 100));
});
test('legacy aggregate stays included when detailed entries are appended later', () => {
  const day = { ...emptyDay(), legacyTotal: { kcal: 1000, protein: 50, fat: 30, carbs: 120 }, foods: [food(), food({ checked: false })] };
  assert.equal(dayTotals(day).kcal, 1180); assert.equal(dayTotals(day).protein, 60);
});
test('demo is not written into persistent storage', () => {
  const storage = memory(); const w = new Workspace(storage);
  assert.equal(w.demo, true); w.dayUpdate('2026-10-19', d => { d.water = 500; });
  assert.equal(storage.length, 0); assert.equal(w.getDay('2026-10-19').water, 500);
});
test('a new personal workspace starts without any demo records or weights', () => {
  const storage = memory(); const w = new Workspace(storage);
  w.replace(newWorkspace({ name: 'Алексей' }));
  assert.equal(w.demo, false); assert.equal(w.state.profile.name, 'Алексей');
  assert.deepEqual(w.state.days, {}); assert.equal(w.state.weights.length, 0);
  assert.equal(new Workspace(storage).demo, false);
});
test('a storage failure cannot change the last committed in-memory state', () => {
  const storage = memory(); const w = new Workspace(storage); w.replace(newWorkspace());
  const before = structuredClone(w.state); storage.setItem = () => { throw new Error('QuotaExceeded'); };
  assert.throws(() => w.dayUpdate('2026-10-19', d => { d.water = 1000; }), /Не удалось сохранить/);
  assert.deepEqual(w.state, before);
});
test('a rejected replacement leaves both memory and current persistent data intact', () => {
  const storage = memory(); const w = new Workspace(storage); w.replace(newWorkspace({ name: 'До' }));
  const raw = storage.getItem(STORAGE_KEY); storage.setItem = () => { throw new Error('QuotaExceeded'); };
  assert.throws(() => w.replace(newWorkspace({ name: 'После' })));
  assert.equal(w.state.profile.name, 'До'); assert.equal(storage.getItem(STORAGE_KEY), raw);
});
test('committed writes retain a last good recovery state', () => {
  const storage = memory(); const w = new Workspace(storage); w.replace(newWorkspace());
  w.dayUpdate('2026-10-19', d => { d.water = 250; });
  assert.equal(JSON.parse(storage.getItem(RECOVERY_KEY)).days['2026-10-19'], undefined);
  w.dayUpdate('2026-10-19', d => { d.water = 500; });
  assert.equal(JSON.parse(storage.getItem(RECOVERY_KEY)).days['2026-10-19'].water, 250);
});
test('corrupt main data can recover from the last valid state', () => {
  const saved = newWorkspace({ name: 'Из копии' });
  const w = new Workspace(memory({ [STORAGE_KEY]: '{broken', [RECOVERY_KEY]: JSON.stringify(saved) }));
  assert.equal(w.demo, false); assert.equal(w.state.profile.name, 'Из копии'); assert.match(w.notice, /Восстановлена/);
});
test('unrecoverable storage is retained, without overwriting it with demo data', () => {
  const storage = memory({ [STORAGE_KEY]: '{broken' }); const w = new Workspace(storage);
  assert.equal(w.demo, true); assert.equal(storage.getItem(STORAGE_KEY), '{broken'); assert.match(w.notice, /повреждены/);
});
test('writes refresh a newer revision from another tab before applying the change', () => {
  const storage = memory(); const first = new Workspace(storage); first.replace(newWorkspace());
  const second = new Workspace(storage);
  first.dayUpdate('2026-10-19', d => { d.water = 250; });
  second.dayUpdate('2026-10-19', d => { d.steps = 1000; });
  assert.equal(second.getDay('2026-10-19').water, 250); assert.equal(second.getDay('2026-10-19').steps, 1000);
  assert.equal(first.sync(), true); assert.equal(first.getDay('2026-10-19').steps, 1000);
});
test('a new date never erases previous days or water history', () => {
  const w = new Workspace(memory()); w.replace(newWorkspace());
  w.dayUpdate('2026-10-18', d => { d.foods.push(food()); d.water = 1500; });
  w.dayUpdate('2026-10-19', d => { d.water = 250; });
  assert.equal(w.getDay('2026-10-18').water, 1500); assert.equal(w.getDay('2026-10-18').foods.length, 1);
  assert.equal(w.getDay('2026-10-20').water, 0);
});
test('FitCat migration keeps eaten vs planned entries, history, original data and date', () => {
  const original = fitcat(); const w = migrateFitCat(original, '2026-10-19');
  assert.equal(w.profile.name, 'Ирина'); assert.equal(w.days['2026-10-18'].foods[1].checked, false);
  assert.equal(dayTotals(w.days['2026-10-18']).kcal, 180);
  assert.equal(w.days['2026-10-17'].legacyTotal.kcal, 1800); assert.equal(w.weights[0].weight, 65);
  assert.equal(w.days['2026-10-19'], undefined); assert.equal(w.days['2026-10-18'].water, 1250);
  assert.deepEqual(w.legacy, original); w.legacy.profile.name = 'Изменено'; assert.equal(original.profile.name, 'Ирина');
});
test('same-origin migration never changes original FitCat keys', () => {
  const original = fitcat();
  const storage = memory({ fitnessProfile: JSON.stringify(original.profile), todayFoods: JSON.stringify(original.foods), weightHistory: JSON.stringify(original.weight), lastDate: original.lastDate, waterAmount: '1250' });
  const oldValue = storage.getItem('todayFoods'); const w = new Workspace(storage);
  assert.equal(w.demo, false); assert.equal(w.state.profile.name, 'Ирина'); assert.equal(storage.getItem('todayFoods'), oldValue);
  assert.ok(storage.getItem(STORAGE_KEY));
});
test('migration keeps aggregate history when old current-day detail is empty', () => {
  const raw = fitcat(); raw.foods = []; raw.lastDate = '2026-10-17';
  assert.equal(dayTotals(migrateFitCat(raw).days['2026-10-17']).kcal, 1800);
});
test('migration snapshots only app-owned original storage keys', () => {
  const raw = fitcat();
  const storage = memory({ fitnessProfile: JSON.stringify(raw.profile), todayFoods: '[]', weightHistory: '[]', fitcat_extra_setting: 'retained', unrelated_secret: 'never-copy' });
  const next = readLegacy(storage);
  assert.equal(next.legacy.originalStorage.fitcat_extra_setting, 'retained'); assert.equal(next.legacy.originalStorage.unrelated_secret, undefined);
});
test('backup roundtrip preserves user content, settings, custom products and templates', () => {
  const original = makeDemo('2026-10-19'); original.days['2026-10-19'].note = '<Личная заметка> & текст';
  original.preferences.theme = 'dark'; original.products = [{ ...PRODUCTS[0], id: 'custom-1' }];
  original.templates = [{ id: 't1', name: 'Мой набор', foods: [food()] }];
  const next = parseBackup(JSON.stringify(original));
  assert.equal(next.days['2026-10-19'].note, '<Личная заметка> & текст'); assert.equal(next.preferences.theme, 'dark');
  assert.equal(next.products[0].id, 'custom-1'); assert.equal(next.templates[0].foods[0].kcal, 180);
});
test('invalid imports fail before mutation and reject unknown schemas and malformed values', () => {
  for (const raw of ['{', '{}', '{"version":999}', JSON.stringify({ ...newWorkspace(), version: 2 })]) assert.throws(() => parseBackup(raw));
  let raw = newWorkspace(); raw.profile.calories = -50; assert.throws(() => parseBackup(raw));
  raw = newWorkspace(); raw.days['2026-02-30'] = emptyDay(); assert.throws(() => parseBackup(raw));
  raw = newWorkspace(); raw.days['2026-10-19'] = { ...emptyDay(), water: -5 }; assert.throws(() => parseBackup(raw));
  raw = newWorkspace(); raw.profile.targetWeight = 500; assert.throws(() => parseBackup(raw));
  raw = newWorkspace(); raw.products = [{ name: 'Сломан', kcal: 'NaN' }]; assert.throws(() => parseBackup(raw));
  raw = newWorkspace(); raw.days['2026-10-19'] = { ...emptyDay(), foods: [food({ kcal: -1 })] }; assert.throws(() => parseBackup(raw));
});
test('oversized imports are rejected', () => assert.throws(() => parseBackup(' '.repeat(5 * 1024 * 1024 + 1)), /5 МБ/));
test('duplicate imported food IDs are made unique to keep edit and delete precise', () => {
  const raw = newWorkspace(); raw.days['2026-10-19'] = { ...emptyDay(), foods: [food(), food()] };
  const next = validateWorkspace(raw); assert.notEqual(next.days['2026-10-19'].foods[0].id, next.days['2026-10-19'].foods[1].id);
});
test('all recipe ingredients exist and their portions reproduce expected totals', () => {
  for (const recipe of RECIPES) {
    const n = recipeNutrition(recipe); assert.ok(n.kcal > 0); assert.ok(n.weight > 0);
    assert.ok(recipe.ingredients.every(([id]) => PRODUCTS.some(p => p.id === id)));
    assert.ok(n.protein >= 0 && n.carbs >= 0 && n.fat >= 0);
  }
});
test('CSV omits missing days instead of inventing zero measurements', () => {
  const state = newWorkspace(); state.days['2026-10-19'] = { ...emptyDay(), foods: [food()], water: 1000 };
  const csv = toCSV(state, ['2026-10-18', '2026-10-19']);
  assert.ok(csv.startsWith('\uFEFF')); assert.equal(csv.split('\r\n').length, 2); assert.match(csv, /"180"/); assert.doesNotMatch(csv, /2026-10-18/);
});
test('escapeHTML neutralizes markup, quotes and event attributes in imported text', () => {
  assert.equal(escapeHTML('<img src=x onerror="bad()"> & \'test\''), '&lt;img src=x onerror=&quot;bad()&quot;&gt; &amp; &#39;test&#39;');
});
