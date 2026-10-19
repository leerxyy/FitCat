import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorkspace, emptyDay, parseBackup, validateWorkspace, makeDemo } from '../app/core.js';
import { dayPlan, nextMoment, normalizePlan, commandMatches, weekReview } from '../app/atelier.js';

test('Atelier upgrades RITUA 1.0 backups without changing diary or profile values', () => {
  const state = makeDemo('2026-10-19'); state.version = 1; delete state.edition;
  for (const day of Object.values(state.days)) { delete day.plan; delete day.rhythm; delete day.intention; }
  const next = parseBackup(JSON.stringify(state));
  assert.equal(next.version, 2); assert.equal(next.edition, 'atelier');
  assert.deepEqual(next.profile, state.profile); assert.deepEqual(next.days['2026-10-19'].foods, state.days['2026-10-19'].foods);
  assert.equal(next.days['2026-10-19'].rhythm, 'balance'); assert.equal(next.days['2026-10-19'].plan, null);
});
test('Atelier backup roundtrip retains a custom plan, intention and reflection', () => {
  const state = newWorkspace(); state.days['2026-10-19'] = { ...emptyDay(), rhythm: 'focus', intention: 'Больше пространства', note: 'Личная мысль', mood: 'good', plan: [{ habitId: 'breath', time: '18:40' }] };
  const next = parseBackup(JSON.stringify(state)); assert.deepEqual(next.days, state.days);
});
test('invalid or duplicate plan times are rejected on import before replacement', () => {
  for (const plan of [[{ habitId: 'water', time: '25:10' }], [{ habitId: 'water', time: '10:60' }], [{ habitId: 'water', time: '10:00' }, { habitId: 'water', time: '11:00' }], { water: '10:00' }]) {
    const state = newWorkspace(); state.days['2026-10-19'] = { ...emptyDay(), plan };
    assert.throws(() => parseBackup(state));
  }
});
test('an explicitly empty day plan remains empty rather than restoring defaults', () => {
  const state = newWorkspace(), day = { ...emptyDay(), plan: [] };
  assert.deepEqual(dayPlan(state, day), []); assert.equal(nextMoment([]), null);
});
test('daily plan sorts chosen times and ignores references to removed rituals', () => {
  const state = newWorkspace(), day = { ...emptyDay(), plan: [{ habitId: 'breath', time: '20:00' }, { habitId: 'deleted', time: '08:00' }, { habitId: 'walk', time: '13:00' }], habits: ['walk'] };
  const result = dayPlan(state, day); assert.deepEqual(result.map(p => p.id), ['walk', 'breath']); assert.equal(result[0].done, true);
});
test('rhythm changes suggested schedule while leaving global habits and goals intact', () => {
  const state = newWorkspace(), before = structuredClone(state);
  const balance = dayPlan(state, emptyDay()), focus = dayPlan(state, { ...emptyDay(), rhythm: 'focus' });
  assert.notDeepEqual(balance.map(h => h.time), focus.map(h => h.time)); assert.deepEqual(state, before);
});
test('next moment chooses the most recent incomplete item or the first upcoming one', () => {
  const plan = [{ id: 'a', time: '09:00', done: false }, { id: 'b', time: '13:00', done: true }, { id: 'c', time: '18:00', done: false }];
  assert.equal(nextMoment(plan, 8 * 60).id, 'a'); assert.equal(nextMoment(plan, 19 * 60).id, 'c');
  assert.equal(nextMoment(plan.map(p => ({ ...p, done: true })), 10), null);
});
test('week review counts only recorded dates and uses null for missing averages', () => {
  const state = newWorkspace(); assert.equal(weekReview(state, ['2026-10-19']).waterAverage, null);
  state.days['2026-10-19'] = { ...emptyDay(), water: 1500, steps: 7000, habits: ['water'], mood: 'good' };
  const result = weekReview(state, ['2026-10-18', '2026-10-19']);
  assert.equal(result.waterAverage, 1500); assert.equal(result.recorded, 1); assert.equal(result.reflections, 1);
});
test('command search supports Cyrillic case, spaces and equivalent ё/е spellings', () => {
  const commands = [{ title: 'Записать приём пищи', keywords: 'еда' }, { title: 'Добавить воду', keywords: 'пить' }];
  assert.equal(commandMatches(commands, '  ПРИЕМ ').length, 1); assert.equal(commandMatches(commands, 'ПИТЬ')[0].title, 'Добавить воду'); assert.equal(commandMatches(commands, 'no-match').length, 0);
});
