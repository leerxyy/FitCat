// Atelier changes the experience of the day, never its nutritional targets.
export const RHYTHMS = {
  balance: { name: 'Баланс', icon: 'leaf', line: 'У каждого дела — своё время.', description: 'Ровный день с небольшими паузами.', slots: [['water', '09:00'], ['walk', '14:00'], ['pause', '16:00'], ['breath', '19:00']] },
  focus: { name: 'Фокус', icon: 'sun', line: 'Больше ясности. Меньше шума.', description: 'Паузы вокруг дел, которым нужно внимание.', slots: [['water', '09:00'], ['pause', '11:00'], ['walk', '14:30'], ['breath', '18:30']] },
  restore: { name: 'Мягкий день', icon: 'moon', line: 'Сегодня можно немного медленнее.', description: 'Больше пространства для восстановления.', slots: [['water', '09:30'], ['walk', '12:00'], ['pause', '16:30'], ['breath', '21:00']] },
};
export const BREATH_DURATIONS = [60, 180, 300];
export const MOODS = [
  { id: 'great', name: 'Много энергии', icon: 'sun', description: 'Хочется двигаться и делать' },
  { id: 'good', name: 'Всё в равновесии', icon: 'leaf', description: 'Ровное, спокойное состояние' },
  { id: 'okay', name: 'Нейтрально', icon: 'coffee', description: 'Обычный день в своём темпе' },
  { id: 'low', name: 'Нужна забота', icon: 'moon', description: 'Хочется тишины и отдыха' },
];
export function normalizeRhythm(value) { return Object.hasOwn(RHYTHMS, value) ? value : 'balance'; }
export function validTime(value) { return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
export function normalizePlan(value) {
  if (!Array.isArray(value)) return null;
  const seen = new Set();
  return value.slice(0, 30).filter(item => {
    if (!item || typeof item.habitId !== 'string' || !item.habitId || item.habitId.length > 150 || !validTime(item.time) || seen.has(item.habitId)) return false;
    seen.add(item.habitId); return true;
  }).map(item => ({ habitId: item.habitId, time: item.time }));
}
export function dayPlan(state, day) {
  const custom = normalizePlan(day?.plan);
  const rhythm = RHYTHMS[normalizeRhythm(day?.rhythm)];
  let slots = custom;
  if (!slots) {
    const builtIn = rhythm.slots.map(([habitId, time]) => ({ habitId, time: day?.rhythm === 'balance' || !day?.rhythm ? state.habits.find(h => h.id === habitId)?.time || time : time }));
    const baseIds = new Set(builtIn.map(s => s.habitId));
    slots = [...builtIn, ...state.habits.filter(h => !baseIds.has(h.id)).map(h => ({ habitId: h.id, time: h.time }))];
  }
  return slots.map(slot => { const habit = state.habits.find(h => h.id === slot.habitId); return habit ? { ...habit, time: slot.time, done: !!day?.habits?.includes(habit.id) } : null; }).filter(Boolean).sort((a, b) => a.time.localeCompare(b.time));
}
export function nextMoment(plan, minute = new Date().getHours() * 60 + new Date().getMinutes()) {
  const unfinished = plan.filter(p => !p.done);
  if (!unfinished.length) return null;
  const minutes = value => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };
  const recent = unfinished.filter(p => minutes(p.time) <= minute);
  return recent.at(-1) || unfinished[0];
}
export function weekReview(state, dates) {
  const days = dates.filter(d => state.days[d]).map(d => state.days[d]);
  const sum = key => days.reduce((n, d) => n + (Number(d[key]) || 0), 0);
  return {
    recorded: days.length,
    waterAverage: days.length ? Math.round(sum('water') / days.length) : null,
    stepsAverage: days.length ? Math.round(sum('steps') / days.length) : null,
    rituals: days.reduce((n, d) => n + (d.habits?.length || 0), 0),
    reflections: days.filter(d => d.mood || d.note).length,
  };
}
export function commandMatches(commands, query) {
  const normalized = String(query || '').toLocaleLowerCase('ru').trim().replaceAll('ё', 'е');
  return commands.filter(c => `${c.title} ${c.subtitle || ''} ${c.keywords || ''}`.toLocaleLowerCase('ru').replaceAll('ё', 'е').includes(normalized));
}
