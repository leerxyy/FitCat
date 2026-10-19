import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM, tick, submit } from './dom.mjs';
import { dateKey, shiftDate, STORAGE_KEY, newWorkspace } from '../app/core.js';
import { RECIPES } from '../app/data.js';

const env = setupDOM();
const { workspace, render } = await import('../app/app.js');
const $ = id => document.getElementById(id);
async function click(action, value, scope = document) {
  const target = scope.querySelectorAll(`[data-action="${action}"]`).find(el => value == null || el.dataset.value === value);
  assert.ok(target, `Missing action ${action}:${value || ''}`); target.click(); await tick(); return target;
}
async function go(route) { location.hash = `#${route}`; window.dispatchEvent(new Event('hashchange')); await tick(); }
function input(id, value) { $(id).value = value; $(id).dispatchEvent(new Event('input', { bubbles: true })); }
function change(id, value) { $(id).value = value; $(id).dispatchEvent(new Event('change', { bubbles: true })); }

test('launch shows clearly labeled demo with no persistent diary', () => {
  assert.equal(workspace.demo, true); assert.match($('demo-banner').textContent, /Деморежим/);
  assert.equal(env.localStorage.getItem(STORAGE_KEY), null);
  assert.equal($('main').querySelectorAll('h1').length, 1); assert.match($('main').textContent, /В вашем ритме/);
});
test('all six routes render without duplicate IDs or invalid SVG numbers', async () => {
  for (const route of ['overview', 'diary', 'rituals', 'progress', 'library', 'settings']) {
    await go(route); assert.equal($('main').querySelectorAll('h1').length, 1, route);
    const ids = document.querySelectorAll('[id]').map(el => el.id);
    assert.equal(new Set(ids).size, ids.length, `Duplicate IDs on ${route}`);
    for (const node of $('main').querySelectorAll('rect, circle, line, polyline')) for (const [, value] of node.attributes) assert.doesNotMatch(value, /NaN|Infinity/, `${route}: invalid chart geometry`);
    assert.equal(document.querySelectorAll('[aria-current="page"]').filter(el => el.dataset.nav === route).length >= 1, true);
  }
});
test('personal setup removes all demo entries and persists selected goals', async () => {
  await click('setup'); input('setup-name', 'Ирина'); input('setup-calories', '2100'); input('setup-water', '1800'); input('setup-steps', '7500');
  submit($('setup-form')); await tick();
  assert.equal(workspace.demo, false); assert.equal(workspace.state.profile.name, 'Ирина');
  assert.equal(workspace.state.profile.calories, 2100); assert.deepEqual(workspace.state.days, {});
  assert.equal(workspace.state.weights.length, 0); assert.equal($('demo-banner').textContent, '');
  assert.ok(env.localStorage.getItem(STORAGE_KEY));
});
test('food form uses per-100g values and updates all totals on a custom portion', async () => {
  await go('diary'); await click('open-food', 'breakfast');
  input('food-name', 'Творог с ягодами'); input('food-kcal', '120'); input('food-protein', '10'); input('food-fat', '4'); input('food-carbs', '11'); input('food-weight', '250');
  assert.equal($('portion-kcal').textContent, '300');
  $('food-save-product').checked = true; submit($('food-form')); await tick();
  const entry = workspace.getDay(dateKey()).foods[0]; assert.equal(entry.kcal, 300); assert.equal(entry.protein, 25); assert.equal(entry.meal, 'breakfast');
  assert.equal(workspace.state.products.length, 1); assert.equal(document.querySelector('#modal-root dialog'), null);
});
test('editing retains ID and recalculates exactly once from the per-100g source', async () => {
  const entry = workspace.getDay(dateKey()).foods[0]; await click('edit-food', entry.id);
  input('food-weight', '100'); submit($('food-form')); await tick();
  assert.equal(workspace.getDay(dateKey()).foods.length, 1); assert.equal(workspace.getDay(dateKey()).foods[0].id, entry.id); assert.equal(workspace.getDay(dateKey()).foods[0].kcal, 120);
});
test('planned toggle changes eaten totals, delete offers a working undo', async () => {
  const entry = workspace.getDay(dateKey()).foods[0]; await click('toggle-food', entry.id); assert.equal(workspace.getDay(dateKey()).foods[0].checked, false);
  await click('delete-food', entry.id); assert.equal(workspace.getDay(dateKey()).foods.length, 0);
  document.querySelector('.toast-action').click(); await tick(); assert.equal(workspace.getDay(dateKey()).foods.length, 1); assert.equal(workspace.getDay(dateKey()).foods[0].checked, false);
});
test('future entries are always planned and cannot be marked eaten', async () => {
  const tomorrow = shiftDate(dateKey(), 1); change('selected-date', tomorrow); await click('open-food', 'dinner');
  input('food-name', 'Завтрашний ужин'); input('food-kcal', '150'); input('food-weight', '200'); $('food-checked').checked = true;
  submit($('food-form')); await tick();
  const entry = workspace.getDay(tomorrow).foods[0]; assert.equal(entry.checked, false);
  await click('toggle-food', entry.id); assert.equal(workspace.getDay(tomorrow).foods[0].checked, false);
  change('selected-date', dateKey());
});
test('saved meal sets apply with new IDs and chosen meal, without changing originals', async () => {
  await click('save-template', 'breakfast'); input('template-name', 'Быстрый завтрак'); submit($('template-form')); await tick();
  const template = workspace.state.templates[0]; assert.equal(template.name, 'Быстрый завтрак');
  await click('open-templates'); await click('apply-template', template.id); $('template-meal').value = 'lunch'; submit($('apply-template-form')); await tick();
  const foods = workspace.getDay(dateKey()).foods; assert.equal(foods.length, 2); assert.notEqual(foods[0].id, foods[1].id); assert.equal(foods[1].meal, 'lunch'); assert.equal(template.foods[0].meal, 'breakfast');
});
test('quick water, custom amount and history deletion preserve exact daily totals', async () => {
  await go('overview'); await click('add-water', '250'); assert.equal(workspace.getDay(dateKey()).water, 250);
  document.querySelector('.toast-action').click(); await tick(); assert.equal(workspace.getDay(dateKey()).water, 0);
  await click('custom-water'); input('water-amount', '330'); submit($('water-form')); await tick(); assert.equal(workspace.getDay(dateKey()).water, 330);
  await go('rituals'); const id = workspace.getDay(dateKey()).waterLog[0].id; await click('delete-water', id); assert.equal(workspace.getDay(dateKey()).water, 0);
  document.querySelector('.toast-action').click(); await tick(); assert.equal(workspace.getDay(dateKey()).water, 330);
});
test('activity replaces daily total instead of accumulating repeated edits', async () => {
  await click('activity'); input('activity-steps', '7000'); input('activity-minutes', '40'); submit($('activity-form')); await tick();
  await click('activity'); input('activity-steps', '7500'); submit($('activity-form')); await tick(); assert.equal(workspace.getDay(dateKey()).steps, 7500); assert.equal(workspace.getDay(dateKey()).activeMinutes, 40);
});
test('custom ritual can be created, completed and removed with undo', async () => {
  await click('new-habit'); input('habit-name', 'Почитать книгу'); input('habit-time', '21:00'); input('habit-detail', 'Десять спокойных минут'); submit($('habit-form')); await tick();
  const habit = workspace.state.habits.at(-1); await click('toggle-habit', habit.id); assert.ok(workspace.getDay(dateKey()).habits.includes(habit.id));
  await click('delete-habit', habit.id); assert.equal(workspace.state.habits.some(h => h.id === habit.id), false);
  document.querySelector('.toast-action').click(); await tick(); assert.equal(workspace.state.habits.some(h => h.id === habit.id), true);
});
test('breathing control starts, pauses, resumes and cleans its modal', async () => {
  await click('breathing'); $('breath-start').click(); assert.equal($('breath-phase').textContent, 'Вдох.');
  $('breath-start').click(); assert.equal($('breath-phase').textContent, 'Пауза.');
  $('breath-start').click(); assert.equal($('breath-phase').textContent, 'Вдох.');
  await click('close-modal'); assert.equal(document.querySelector('#modal-root dialog'), null);
});
test('full breathing cycle follows 4/6 timing and completes only after sixty seconds', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'performance'); let now = 0;
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
  try {
    await click('breathing'); $('breath-start').click(); assert.equal($('breath-time').textContent, '01:00');
    now = 4000; env.runIntervals(150); assert.equal($('breath-phase').textContent, 'Выдох.');
    now = 10000; env.runIntervals(150); assert.equal($('breath-phase').textContent, 'Вдох.'); assert.match($('breath-cycle').textContent, /2 из 6/);
    document.hidden = true; document.dispatchEvent(new Event('visibilitychange')); assert.equal($('breath-phase').textContent, 'Пауза.');
    now = 30000; document.hidden = false; $('breath-start').click(); now = 79999; env.runIntervals(150); assert.notEqual($('breath-phase').textContent, 'Спасибо себе.');
    now = 80000; env.runIntervals(150); assert.equal($('breath-phase').textContent, 'Спасибо себе.');
    assert.ok(workspace.getDay(dateKey()).habits.includes('breath')); await click('close-modal');
  } finally { Object.defineProperty(globalThis, 'performance', descriptor); document.hidden = false; }
});
test('weight saves by date, replaces same-day value and supports deletion undo', async () => {
  await go('progress'); await click('log-weight'); input('weight-value', '67.5'); submit($('weight-form')); await tick();
  await click('log-weight'); input('weight-value', '67.2'); submit($('weight-form')); await tick();
  assert.equal(workspace.state.weights.length, 1); assert.equal(workspace.state.weights[0].weight, 67.2);
  await click('delete-weight', dateKey()); assert.equal(workspace.state.weights.length, 0); document.querySelector('.toast-action').click(); await tick(); assert.equal(workspace.state.weights[0].weight, 67.2);
});
test('library search, recipe filtering, favorites and recipe logging are connected', async () => {
  await go('library'); input('library-search', 'лосос'); assert.match($('library-results').textContent, /Боул с лососем/); assert.doesNotMatch($('library-results').textContent, /Йогурт с ягодами/);
  input('library-search', ''); await click('recipe-filter', 'breakfast'); assert.match($('library-results').textContent, /Тост/); assert.doesNotMatch($('library-results').textContent, /Тёплый салат/);
  await click('favorite', 'recipe-toast'); assert.ok(workspace.state.favorites.includes('recipe-toast'));
  await click('library-tab', 'favorites'); assert.match($('library-results').textContent, /Тост/);
  await click('add-recipe', 'toast'); assert.equal($('food-name').value, 'Тост с авокадо и яйцом'); submit($('food-form')); await tick();
  assert.ok(workspace.getDay(dateKey()).foods.some(f => f.name === 'Тост с авокадо и яйцом'));
});
test('notes are escaped in rendering, and selecting mood preserves a typed note', async () => {
  await go('diary'); input('day-note', '<img src=x onerror="bad()"> & заметка'); await click('set-mood', 'good');
  assert.equal(workspace.getDay(dateKey()).mood, 'good'); assert.match(workspace.getDay(dateKey()).note, /<img/);
  assert.equal($('main').querySelectorAll('img').length, 0); assert.match($('day-note').value, /<img/);
});
test('preferences persist and profile edits do not clear records', async () => {
  const count = workspace.getDay(dateKey()).foods.length; await go('settings'); change('theme-select', 'dark');
  assert.equal(document.documentElement.dataset.theme, 'dark'); $('reduced-motion').checked = true; $('reduced-motion').dispatchEvent(new Event('change', { bubbles: true }));
  assert.equal(document.documentElement.dataset.motion, 'reduced'); input('profile-name', 'Новое имя'); submit($('profile-form')); await tick();
  assert.equal(workspace.state.profile.name, 'Новое имя'); assert.equal(workspace.getDay(dateKey()).foods.length, count);
});
test('broken local search network can never block manual entry or send diary data', async () => {
  await click('open-food'); input('food-search', 'кефир');
  assert.match($('food-search-results').textContent, /Кефир/); await click('search-online');
  assert.match(document.querySelector('.dialog-toast-region').textContent, /Нет подключения/); assert.ok($('food-form')); await click('close-modal');
});
test('privacy and install guidance open working accessible dialogs', async () => {
  await click('privacy'); assert.match($('dialog-title').textContent, /Личное/); assert.match(document.querySelector('dialog').textContent, /localStorage/); await click('close-modal');
  await click('install'); assert.match(document.querySelector('dialog').textContent, /Safari/); await click('close-modal');
});
test('storage failure in food submission keeps form open and previous records intact', async () => {
  const count = workspace.getDay(dateKey()).foods.length; await click('open-food'); input('food-name', 'Не должно сохраниться'); input('food-kcal', '120');
  const original = env.localStorage.setItem; env.localStorage.setItem = () => { throw new Error('Quota'); };
  submit($('food-form')); await tick(); assert.equal(workspace.getDay(dateKey()).foods.length, count); assert.ok($('food-form')); assert.equal($('food-form').querySelector('.form-error').hidden, false);
  env.localStorage.setItem = original; await click('close-modal');
});
test('JSON restoration requires review and commits a validated backup only on confirmation', async () => {
  const beforeName = workspace.state.profile.name;
  const next = newWorkspace({ name: 'Восстановленное пространство' });
  $('import-file').files = [{ name: 'RITUA-test.json', size: 500, text: async () => JSON.stringify(next) }];
  $('import-file').dispatchEvent(new Event('change', { bubbles: true })); await tick();
  assert.equal(workspace.state.profile.name, beforeName); assert.match($('dialog-title').textContent, /Восстановить/);
  await click('confirm-dialog'); assert.equal(workspace.state.profile.name, 'Восстановленное пространство'); assert.equal(workspace.state.weights.length, 0);
});

test.after(() => { env.restoreTimers(); });
