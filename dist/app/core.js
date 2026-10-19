import { DEFAULT_HABITS, RECIPES, recipeNutrition, INTENTIONS } from './data.js';
import { normalizeRhythm, normalizePlan } from './atelier.js';

export const STORAGE_KEY = 'ritua.workspace.v1';
export const RECOVERY_KEY = 'ritua.recovery.v1';
export const DEFAULT_PROFILE = { name: '', intention: 'balance', calories: 2200, protein: 120, fat: 75, carbs: 260, water: 2000, steps: 8000, targetWeight: null };
export const uid = () => globalThis.crypto?.randomUUID?.() || `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, Number(v) || 0));
export const round = (v, precision = 1) => Math.round((Number(v) || 0) * 10 ** precision) / 10 ** precision;
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function dateKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function validDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00`);
  return Number.isFinite(d.getTime()) && dateKey(d) === s && s >= '2000-01-01' && s <= '2100-12-31';
}
export function shiftDate(key, days) { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + days); return dateKey(d); }
export function dateRange(end, length) { return Array.from({ length }, (_, i) => shiftDate(end, i - length + 1)); }
export function emptyDay() { return { foods: [], water: 0, waterLog: [], steps: 0, activeMinutes: 0, habits: [], note: '', mood: '', rhythm: 'balance', intention: '', plan: null }; }
export function newWorkspace(profile = {}) {
  return { kind: 'ritua-backup', version: 2, edition: 'atelier', revision: 0, updatedAt: new Date().toISOString(), profile: { ...DEFAULT_PROFILE, ...profile }, days: {}, weights: [], products: [], templates: [], favorites: [], habits: structuredClone(DEFAULT_HABITS), preferences: { theme: 'light', reducedMotion: false }, legacy: null };
}
export function totals(foods = [], checkedOnly = true) {
  const total = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  for (const food of foods) if (!checkedOnly || food.checked) for (const k of Object.keys(total)) total[k] += Number(food[k]) || 0;
  return Object.fromEntries(Object.entries(total).map(([k, v]) => [k, round(v)]));
}
export function portion(product, grams) {
  if (!Number.isFinite(grams) || grams <= 0 || grams > 10000) throw new Error('Укажите порцию от 1 до 10 000 г.');
  const r = {};
  for (const key of ['kcal', 'protein', 'fat', 'carbs']) {
    const n = Number(product[key]);
    if (!Number.isFinite(n) || n < 0 || n > (key === 'kcal' ? 1000 : 100)) throw new Error('Проверьте значения на 100 г: до 1 000 ккал и до 100 г каждого нутриента.');
    r[key] = round(n * grams / 100);
  }
  return r;
}
const text = (s, max = 150) => typeof s === 'string' ? s.trim().slice(0, max) : '';
function number(v, min, max, fallback = 0) { return Number.isFinite(Number(v)) && v !== '' && v != null ? clamp(Number(v), min, max) : fallback; }
function normalizeFood(f) {
  if (!f || !text(f.name) || !Number.isFinite(Number(f.weight)) || Number(f.weight) <= 0 || Number(f.weight) > 10000) return null;
  if (['kcal', 'protein', 'fat', 'carbs'].some(k => !Number.isFinite(Number(f[k])) || Number(f[k]) < 0 || Number(f[k]) > 100000)) return null;
  return { id: text(f.id) || uid(), name: text(f.name), weight: round(f.weight), meal: ['breakfast', 'lunch', 'dinner', 'snack'].includes(f.meal) ? f.meal : 'snack', checked: f.checked !== false, ...Object.fromEntries(['kcal', 'protein', 'fat', 'carbs'].map(k => [k, round(f[k])])) };
}
function normalizeProduct(p) {
  if (!p || !text(p.name)) return null;
  if (['kcal', 'protein', 'fat', 'carbs'].some(k => !Number.isFinite(Number(p[k])) || Number(p[k]) < 0 || Number(p[k]) > (k === 'kcal' ? 1000 : 100))) return null;
  return { id: text(p.id) || uid(), name: text(p.name), category: 'Мои продукты', ...Object.fromEntries(['kcal', 'protein', 'fat', 'carbs'].map(k => [k, round(p[k])])) };
}
export function validateWorkspace(raw, { strict = false } = {}) {
  const invalid = () => { throw new Error('Файл не является корректной резервной копией RITUA. Ваши записи не изменены.'); };
  if (!raw || raw.kind !== 'ritua-backup' || ![1, 2].includes(raw.version) || !raw.profile || typeof raw.days !== 'object' || Array.isArray(raw.days) || raw.days === null) invalid();
  const result = newWorkspace();
  if (strict && ['weights', 'products', 'templates', 'favorites', 'habits'].some(k => !Array.isArray(raw[k]))) invalid();
  result.revision = number(raw.revision, 0, Number.MAX_SAFE_INTEGER);
  result.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : result.updatedAt;
  const bounds = { calories: [800, 6000], protein: [20, 350], fat: [15, 250], carbs: [20, 800], water: [250, 6000], steps: [500, 50000] };
  for (const [k, [min, max]] of Object.entries(bounds)) {
    const v = Number(raw.profile[k]);
    if (strict && (!Number.isFinite(v) || v < min || v > max)) invalid();
    result.profile[k] = number(raw.profile[k], min, max, DEFAULT_PROFILE[k]);
  }
  result.profile.name = text(raw.profile.name, 50);
  result.profile.intention = Object.hasOwn(INTENTIONS, raw.profile.intention) ? raw.profile.intention : 'balance';
  result.profile.targetWeight = raw.profile.targetWeight == null ? null : number(raw.profile.targetWeight, 30, 350, null);
  if (strict && raw.profile.targetWeight != null && (!Number.isFinite(Number(raw.profile.targetWeight)) || Number(raw.profile.targetWeight) < 30 || Number(raw.profile.targetWeight) > 350)) invalid();
  if (Object.keys(raw.days).length > 3660) invalid();
  for (const [key, day] of Object.entries(raw.days)) {
    if (!validDate(key) || !day || !Array.isArray(day.foods) || day.foods.length > 1000) { if (strict) invalid(); else continue; }
    if (strict && [['water', 15000], ['steps', 100000], ['activeMinutes', 1440]].some(([k, max]) => day[k] != null && (!Number.isFinite(Number(day[k])) || Number(day[k]) < 0 || Number(day[k]) > max))) invalid();
    if (strict && day.plan != null && (!Array.isArray(day.plan) || normalizePlan(day.plan).length !== day.plan.length)) invalid();
    const foods = day.foods.map(normalizeFood).filter(Boolean);
    if (strict && foods.length !== day.foods.length) invalid();
    const ids = new Set();
    for (const f of foods) { if (ids.has(f.id)) f.id = uid(); ids.add(f.id); }
    result.days[key] = { ...emptyDay(), foods, water: number(day.water, 0, 15000), steps: number(day.steps, 0, 100000), activeMinutes: number(day.activeMinutes, 0, 1440),
      waterLog: (Array.isArray(day.waterLog) ? day.waterLog : []).slice(-200).filter(l => l && typeof l.id === 'string' && Number.isFinite(l.amount) && l.amount > 0 && l.amount <= 2000).map(l => ({ id: text(l.id), amount: l.amount, time: text(l.time, 30) })),
      habits: [...new Set((Array.isArray(day.habits) ? day.habits : []).filter(h => typeof h === 'string').slice(0, 50))],
      note: text(day.note, 3000), mood: ['great', 'good', 'okay', 'low', ''].includes(day.mood) ? day.mood : '',
      rhythm: normalizeRhythm(day.rhythm), intention: text(day.intention, 120), plan: normalizePlan(day.plan),
      ...(day.legacyTotal ? { legacyTotal: Object.fromEntries(['kcal', 'protein', 'fat', 'carbs'].map(k => [k, number(day.legacyTotal[k], 0, 100000)])) } : {}),
    };
  }
  const weights = Array.isArray(raw.weights) ? raw.weights : [];
  if (strict && weights.some(w => !validDate(w?.date) || !Number.isFinite(w.weight) || w.weight < 30 || w.weight > 350)) invalid();
  result.weights = [...new Map(weights.filter(w => validDate(w?.date) && Number.isFinite(Number(w.weight)) && Number(w.weight) >= 30 && Number(w.weight) <= 350).map(w => [w.date, { date: w.date, weight: round(w.weight) }])).values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-3660);
  result.products = (Array.isArray(raw.products) ? raw.products : []).slice(0, 2000).map(normalizeProduct).filter(Boolean);
  if (strict && result.products.length !== raw.products.length) invalid();
  result.templates = (Array.isArray(raw.templates) ? raw.templates : []).slice(0, 100).filter(t => text(t?.name) && Array.isArray(t.foods)).map(t => ({ id: text(t.id) || uid(), name: text(t.name, 80), foods: t.foods.slice(0, 100).map(normalizeFood).filter(Boolean) })).filter(t => t.foods.length);
  result.favorites = [...new Set((Array.isArray(raw.favorites) ? raw.favorites : []).filter(f => typeof f === 'string').slice(0, 3000))];
  if (Array.isArray(raw.habits)) result.habits = raw.habits.slice(0, 30).filter(h => text(h?.name)).map(h => ({ id: text(h.id) || uid(), name: text(h.name, 80), detail: text(h.detail, 150), icon: ['drop', 'walk', 'leaf', 'wind', 'sun', 'moon', 'heart'].includes(h.icon) ? h.icon : 'leaf', time: /^([01]\d|2[0-3]):[0-5]\d$/.test(h.time) ? h.time : '12:00' }));
  result.preferences = { theme: ['light', 'dark', 'system'].includes(raw.preferences?.theme) ? raw.preferences.theme : 'light', reducedMotion: !!raw.preferences?.reducedMotion };
  // Preserve the full original export for unsupported FitCat cosmetics, friends and wallet.
  result.legacy = raw.legacy && typeof raw.legacy === 'object' ? raw.legacy : null;
  return result;
}
export function dayTotals(day) {
  const total = totals(day?.foods || []);
  if (day?.legacyTotal) for (const key of Object.keys(total)) total[key] = round(total[key] + (Number(day.legacyTotal[key]) || 0));
  return total;
}
export function legacyTargets(profile, settings = {}) {
  const w = number(profile.weight, 30, 350, 70), h = number(profile.height, 100, 250, 170), age = number(profile.age, 18, 100, 30);
  const bmr = profile.gender === 'female' ? 447.6 + 9.2 * w + 3.1 * h - 4.3 * age : 88.36 + 13.4 * w + 4.8 * h - 5.7 * age;
  const kcal = Math.round(bmr * number(settings.dailyActivity, 1.2, 1.725, 1.375) * (profile.goal === 'lose' ? .85 : profile.goal === 'gain' ? 1.1 : 1));
  return { calories: clamp(kcal, 800, 6000), protein: Math.round(w * 1.8), fat: Math.round(w * .9), carbs: clamp(Math.round((kcal - w * 1.8 * 4 - w * .9 * 9) / 4), 20, 800), water: clamp(Math.round(w * 35), 250, 6000), steps: number(settings.currentSteps, 500, 50000, 8000) };
}
export function migrateFitCat(data, today = dateKey()) {
  if (!data || typeof data.profile?.name !== 'string' || !Array.isArray(data.foods) || !Array.isArray(data.weight) || !Number.isFinite(Number(data.profile.weight)) || Number(data.profile.weight) < 30 || Number(data.profile.weight) > 350) throw new Error('Не удалось распознать резервную копию FitCat. Ваши записи не изменены.');
  if (data.foods.some(f => !normalizeFood({ ...f, protein: f.protein ?? 0, fat: f.fat ?? 0, carbs: f.carbs ?? 0 }))) throw new Error('В копии FitCat есть некорректные записи питания.');
  const result = newWorkspace({ ...legacyTargets(data.profile, data.settings), name: text(data.profile.name, 50), intention: Object.hasOwn(INTENTIONS, data.profile.goal) ? data.profile.goal : 'balance' });
  for (const record of data.nutrition || []) if (validDate(record.date)) result.days[record.date] = { ...emptyDay(), legacyTotal: { ...totals(), ...Object.fromEntries(['kcal', 'protein', 'fat', 'carbs'].map(k => [k, number(record[k], 0, 100000)])) } };
  const oldDate = validDate(data.lastDate) ? data.lastDate : (() => { const d = new Date(data.lastDate); return Number.isFinite(d.getTime()) ? dateKey(d) : today; })();
  const oldAggregate = !data.foods.length ? result.days[oldDate]?.legacyTotal : null;
  result.days[oldDate] = { ...emptyDay(), foods: data.foods.map(f => normalizeFood({ ...f, protein: f.protein ?? 0, fat: f.fat ?? 0, carbs: f.carbs ?? 0, checked: Boolean(f.checked) })), water: number(data.water, 0, 15000), steps: number(data.settings?.currentSteps, 0, 100000), ...(oldAggregate ? { legacyTotal: oldAggregate } : {}) };
  result.weights = data.weight;
  result.products = (data.products || []).map(p => ({ ...p, id: p.id || uid(), protein: p.protein ?? 0, fat: p.fat ?? 0, carbs: p.carbs ?? 0 }));
  result.templates = (data.templates || []).map(t => ({ ...t, id: t.id || uid() }));
  result.legacy = structuredClone(data);
  return validateWorkspace(result);
}
export function parseBackup(raw) {
  if (typeof raw === 'string' && raw.length > 5 * 1024 * 1024) throw new Error('Размер резервной копии превышает 5 МБ.');
  let data;
  try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { throw new Error('Не удалось прочитать JSON. Выберите резервную копию RITUA или FitCat.'); }
  return data?.kind === 'ritua-backup' ? validateWorkspace(data, { strict: true }) : migrateFitCat(data);
}
export function readLegacy(storage) {
  try {
    const profile = JSON.parse(storage.getItem('fitnessProfile'));
    if (!profile) return null;
    const j = (key, fallback) => { try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; } };
    const settings = Object.fromEntries(['dailyActivity', 'currentSteps', 'currentTemp', 'workoutEnabled', 'smartWaterEnabled'].map(k => [k, j(k, undefined)]));
    const legacy = { version: 3, profile, foods: j('todayFoods', []), weight: j('weightHistory', []), nutrition: j('nutritionHistory', []), products: j('fitcat_products', []), templates: j('fitcat_templates', []), friends: j('fitcat_friends', []), uid: storage.getItem('fitcat_myUid'), photo: storage.getItem('profilePhoto'), photoEdit: j('fitcat_photo_edit_v1', null), wallet: j('fitcat_wallet_v1', null), appearance: j('fitcat_appearance_v1', null), profileStyle: j('fitcat_profile_style_v1', null), settings, water: Number(storage.getItem('waterAmount')) || 0, lastDate: storage.getItem('lastDate') };
    // Preserve only keys belonging to FitCat; never copy other apps on the same origin.
    legacy.originalStorage = {};
    const allowed = new Set(['fitnessProfile', 'todayFoods', 'weightHistory', 'nutritionHistory', 'profilePhoto', 'waterAmount', 'lastDate', 'dailyActivity', 'workoutEnabled', 'workoutIntensity', 'currentSteps', 'currentTemp', 'smartWaterEnabled', 'smartSearchEnabled', 'smartSearchResults', 'hapticsEnabled', 'waterTemperatureMode']);
    for (let i = 0; i < (storage.length || 0); i++) { const key = storage.key(i); if (key && (key.startsWith('fitcat_') || allowed.has(key))) legacy.originalStorage[key] = storage.getItem(key); }
    return migrateFitCat(legacy);
  } catch { return null; }
}
export function makeDemo(today = dateKey()) {
  const state = newWorkspace({ name: 'Александр' });
  const recipes = [RECIPES[0], RECIPES[1], RECIPES[2]];
  const foods = recipes.map((r, i) => ({ id: `demo-${r.id}`, name: r.name, ...recipeNutrition(r), meal: ['breakfast', 'lunch', 'snack'][i], checked: true }));
  state.days[today] = { ...emptyDay(), foods, water: 1250, waterLog: [{ id: 'd1', amount: 250, time: '09:10' }, { id: 'd2', amount: 500, time: '11:30' }, { id: 'd3', amount: 250, time: '13:20' }, { id: 'd4', amount: 250, time: '15:40' }], steps: 6240, activeMinutes: 35, habits: ['water', 'walk'], mood: 'good' };
  const steps = [7800, 8650, 5300, 9400, 7100, 8200];
  for (let i = 1; i <= 6; i++) state.days[shiftDate(today, -i)] = { ...emptyDay(), legacyTotal: { kcal: 1820 + i * 52, protein: 90 + i * 5, fat: 55 + i, carbs: 210 + i * 4 }, water: 1500 + i * 100, steps: steps[i - 1], activeMinutes: 20 + i * 4, habits: i % 2 ? ['water', 'walk', 'pause'] : ['water', 'walk', 'breath'] };
  for (let i = 6; i >= 0; i--) state.weights.push({ date: shiftDate(today, -i * 4), weight: round(76.8 + i * .15) });
  state.favorites = ['recipe-toast', 'recipe-bowl', 'yogurt', 'avocado'];
  return state;
}
export class Workspace {
  constructor(storage) {
    this.storage = storage; this.demo = true; this.notice = ''; this.state = makeDemo();
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) {
        try { this.state = validateWorkspace(JSON.parse(raw)); this.demo = false; }
        catch {
          const recovery = storage.getItem(RECOVERY_KEY);
          if (recovery) { this.state = validateWorkspace(JSON.parse(recovery)); this.demo = false; this.notice = 'Восстановлена последняя корректная копия. Экспортируйте её для надёжности.'; }
          else this.notice = 'Сохранённые данные повреждены. Они оставлены без изменений; сейчас открыт деморежим.';
        }
      } else {
        const legacy = readLegacy(storage);
        if (legacy) { storage.setItem(STORAGE_KEY, JSON.stringify(legacy)); this.state = legacy; this.demo = false; this.notice = 'Ваши записи FitCat перенесены в RITUA. Исходные данные сохранены.'; }
      }
    } catch { this.notice = 'Хранилище браузера недоступно. Открыт деморежим; для личного дневника разрешите сохранение данных.'; }
  }
  getDay(date = dateKey()) { return this.state.days[date] || emptyDay(); }
  update(change) {
    let previous = this.state;
    if (!this.demo) {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw) {
        try { const current = validateWorkspace(JSON.parse(raw)); if (current.revision > previous.revision) previous = current; } catch { /* Retain known-good state. */ }
      }
    }
    const next = structuredClone(previous);
    change(next);
    next.revision = previous.revision + 1; next.updatedAt = new Date().toISOString();
    if (!this.demo) {
      try { this.storage.setItem(STORAGE_KEY, JSON.stringify(next)); }
      catch { throw new Error('Не удалось сохранить запись: хранилище браузера недоступно или заполнено. Экспортируйте данные и освободите место.'); }
      try { this.storage.setItem(RECOVERY_KEY, JSON.stringify(previous)); } catch { /* Main write has already committed atomically. */ }
    }
    this.state = next; return next;
  }
  dayUpdate(date, change) {
    if (!validDate(date)) throw new Error('Некорректная дата.');
    return this.update(s => { s.days[date] ||= emptyDay(); change(s.days[date], s); });
  }
  replace(next) {
    const valid = validateWorkspace(next, { strict: true });
    valid.revision = Math.max(this.state.revision, valid.revision) + 1;
    valid.updatedAt = new Date().toISOString();
    try { this.storage.setItem(STORAGE_KEY, JSON.stringify(valid)); }
    catch { throw new Error('Не удалось сохранить данные. Освободите место в браузере и повторите.'); }
    if (!this.demo) try { this.storage.setItem(RECOVERY_KEY, JSON.stringify(this.state)); } catch { /* Recovery is optional. */ }
    this.state = valid; this.demo = false;
  }
  sync() {
    if (this.demo) return false;
    try { const next = validateWorkspace(JSON.parse(this.storage.getItem(STORAGE_KEY))); if (next.revision !== this.state.revision || next.updatedAt !== this.state.updatedAt) { this.state = next; return true; } } catch { return false; }
    return false;
  }
}

export function toCSV(state, dates) {
  const rows = [['Дата', 'Ккал', 'Белки, г', 'Жиры, г', 'Углеводы, г', 'Вода, мл', 'Шаги', 'Активность, мин', 'Ритуалов']];
  for (const date of dates) {
    const day = state.days[date];
    if (!day) continue;
    const t = dayTotals(day);
    rows.push([date, t.kcal, t.protein, t.fat, t.carbs, day.water, day.steps, day.activeMinutes, day.habits.length]);
  }
  return '\uFEFF' + rows.map(r => r.map(x => `"${String(x).replaceAll('"', '""')}"`).join(';')).join('\r\n');
}
