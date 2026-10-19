import { Workspace, STORAGE_KEY, RECOVERY_KEY, newWorkspace, validateWorkspace, dateKey, validDate, shiftDate, emptyDay, totals, portion, parseBackup, uid, round, clamp, escapeHTML as e, toCSV } from './core.js';
import { RHYTHMS, MOODS, dayPlan, nextMoment, normalizePlan, commandMatches, BREATH_DURATIONS } from './atelier.js';
import { PRODUCTS, RECIPES, MEALS, INTENTIONS, recipeNutrition } from './data.js';
import { icon, brandMark, foodArt } from './icons.js';
import { num, dateLabel, btn, iconBtn, field, errorText, showFormError, toast, openModal, closeModal, confirmDialog, downloadFile, emptyState } from './ui.js';
import * as views from './atelier-views.js';

let storage;
try { storage = globalThis.localStorage; } catch { storage = { getItem() { throw new Error('Storage unavailable'); }, setItem() { throw new Error('Storage unavailable'); } }; }
export const workspace = new Workspace(storage);
const routes = { overview: views.overview, diary: views.diary, rituals: views.rituals, progress: views.progress, library: views.library, settings: views.settings };
let selectedDate = dateKey(), currentToday = selectedDate;
let route = routeFromHash(), period = 7, metric = 'kcal', libraryTab = 'recipes', libraryQuery = '', recipeFilter = 'all', mealFilter = '';
let foodContext = null, searchRequest = 0, searchController = null, installPrompt = null;
let pendingImport = null;
function routeFromHash() { const id = location.hash.slice(1); return Object.hasOwn(routes, id) ? id : 'overview'; }
function context() { return { state: workspace.state, day: workspace.getDay(selectedDate), date: selectedDate, demo: workspace.demo, period, metric, libraryTab, libraryQuery, recipeFilter, mealFilter }; }
const $ = id => document.getElementById(id);

export function applyPreferences() {
  const p = workspace.state.preferences;
  const dark = p.theme === 'dark' || (p.theme === 'system' && globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.motion = p.reducedMotion ? 'reduced' : 'normal';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#20291e' : '#4b5b3d');
}
function updateChrome() {
  const navName = views.NAV.find(n => n[0] === route)?.[1] || 'Настройки';
  $('breadcrumb-current').textContent = navName;
  document.title = `${navName} · RITUA Atelier`;
  document.querySelectorAll('[data-nav]').forEach(a => { const active = a.dataset.nav === route; a.classList.toggle('active', active); if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('profile-avatar').textContent = workspace.state.profile.name.trim().charAt(0).toLocaleUpperCase('ru') || 'R';
  $('save-status').textContent = workspace.demo ? 'Демо-пространство' : navigator.onLine === false ? 'Сохранено на устройстве' : 'Всё сохранено';
  $('save-status').classList.toggle('is-demo', workspace.demo);
  $('demo-banner').innerHTML = workspace.demo ? `<div class="demo-banner">${icon('spark')}<span>Деморежим · пример вашего дня</span><button type="button" data-action="setup">Начать свой день ${icon('arrow')}</button></div>` : '';
  const allDone = dayPlan(workspace.state, workspace.getDay(dateKey())).every(h => h.done);
  document.querySelector('.notification-dot').hidden = allDone;
  if ($('current-mood')) $('current-mood').textContent = MOODS.find(m => m.id === workspace.getDay(dateKey()).mood)?.name || 'Как вы сегодня?';
}
export function render({ navigate = false } = {}) {
  applyPreferences(); updateChrome();
  const focus = document.activeElement;
  const focusAction = focus?.dataset?.action, focusValue = focus?.dataset?.value, focusId = focus?.id;
  const top = window.scrollY;
  $('main').innerHTML = routes[route](context());
  if (navigate) {
    window.scrollTo?.({ top: 0, behavior: 'instant' });
    $('main').querySelector('h1')?.focus({ preventScroll: true });
    $('main').classList.remove('page-enter');
    requestAnimationFrame(() => $('main').classList.add('page-enter'));
  } else {
    if (focusId && $(focusId)) $(focusId).focus({ preventScroll: true });
    else if (focusAction) [...$('main').querySelectorAll('[data-action]')].find(el => el.dataset.action === focusAction && el.dataset.value === focusValue)?.focus({ preventScroll: true });
    window.scrollTo?.({ top, behavior: 'instant' });
  }
}
function mutate(change, message = '') { workspace.update(change); render(); if (message) toast(message); }
function updateDay(change, message = '', date = selectedDate) { workspace.dayUpdate(date, change); render(); if (message) toast(message); }
function navigate(id) {
  if (!Object.hasOwn(routes, id)) return;
  closeModal();
  if (location.hash !== `#${id}`) location.hash = `#${id}`;
  route = id; render({ navigate: true });
}
function chooseDate(date) {
  if (!validDate(date) || date > shiftDate(dateKey(), 30)) throw new Error('Выберите дату не позднее 30 дней вперёд.');
  selectedDate = date; mealFilter = ''; render();
}
function defaultMeal() { const h = new Date().getHours(); return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack'; }
function productById(id) { return workspace.state.products.find(p => p.id === id) || PRODUCTS.find(p => p.id === id); }
function readNumeric(form, id) { const value = form.querySelector(`#${id}`).value; if (!value.trim() || !Number.isFinite(Number(value))) throw new Error('Заполните числовые поля корректными значениями.'); return Number(value); }

function openFood(meal = '', { food = null, product = null, productOnly = false, recipe = null } = {}) {
  searchController?.abort(); const session = ++searchRequest;
  const grams = food?.weight || recipe?.weight || 100;
  const per100 = food ? Object.fromEntries(['kcal', 'protein', 'fat', 'carbs'].map(k => [k, round(food[k] / food.weight * 100, 3)])) : recipe ? Object.fromEntries(['kcal', 'protein', 'fat', 'carbs'].map(k => [k, round(recipe[k] / recipe.weight * 100, 3)])) : product || { kcal: '', protein: 0, fat: 0, carbs: 0 };
  const name = food?.name || product?.name || recipe?.name || '';
  foodContext = { session, date: selectedDate, editing: food?.id || null, productOnly, external: [], product: product || null };
  const dialog = openModal(productOnly ? 'Ваш продукт' : food ? 'Изменить запись' : 'Что сегодня в меню?', `<form id="food-form"><div class="food-search" ${productOnly || food || recipe ? 'hidden' : ''}><label class="search-field">${icon('search')}<input id="food-search" type="search" placeholder="Найти продукт или блюдо…" autocomplete="off" ${productOnly || food || recipe ? '' : 'autofocus'} aria-label="Поиск продукта"></label><div id="food-search-results" class="product-search-results"></div><div class="food-search-bottom"><span>Продукты доступны без интернета</span>${btn('Искать в Open Food Facts', 'search-online', { cls: 'text-button', symbol: 'search' })}</div><p id="online-search-status" class="field-intro" role="status" hidden></p></div>${field('Название', 'food-name', name, `maxlength="150" autocomplete="off"${productOnly || food || recipe ? ' autofocus' : ''}`, { required: true })}<div class="nutrition-inputs"><span>ПИЩЕВАЯ ЦЕННОСТЬ НА 100 Г</span><div class="form-grid">${[['kcal', 'Ккал', 1000], ['protein', 'Белки, г', 100], ['fat', 'Жиры, г', 100], ['carbs', 'Углеводы, г', 100]].map(([k, label, max]) => field(label, `food-${k}`, per100[k], `min="0" max="${max}" step="any" inputmode="decimal"`, { type: 'number', required: true })).join('')}</div></div>${!productOnly ? `<div class="form-grid meal-select-row">${field('Порция, г', 'food-weight', grams, 'min="1" max="10000" step="0.1" inputmode="decimal"', { type: 'number', required: true })}<label class="field" for="food-meal"><span>Приём пищи</span><select id="food-meal" name="food-meal">${MEALS.map(m => `<option value="${m.id}" ${(food?.meal || meal || defaultMeal()) === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}</select></label></div><div class="portion-preview"><span>В вашей порции <span id="portion-grams">${num(grams)}</span> г</span><strong><span id="portion-kcal">0</span> <small>ккал</small></strong></div><label class="check-row"><input type="checkbox" id="food-checked" ${selectedDate <= dateKey() && (food ? food.checked : true) ? 'checked' : ''}>Уже съедено</label>${!food && !product && !recipe ? '<label class="check-row"><input type="checkbox" id="food-save-product">Сохранить в моих продуктах</label>' : ''}<p class="field-intro" style="margin-bottom:0">${dateLabel(selectedDate, { day: 'numeric', month: 'long', year: 'numeric' })}${selectedDate > dateKey() ? ' · будущая запись будет запланирована' : ''}</p>` : '<p class="field-intro" style="margin-top:15px;margin-bottom:0">Введите данные с упаковки. Продукт появится в вашей библиотеке.</p>'}${errorText}<div class="dialog-actions">${btn('Отмена', 'close-modal', { cls: 'button button-ghost' })}${btn(productOnly ? 'Сохранить продукт' : food ? 'Сохранить изменения' : 'Добавить в дневник', '', { type: 'submit', cls: 'button button-primary', symbol: 'check' })}</div></form>`, { cleanup: () => { searchController?.abort(); ++searchRequest; foodContext = null; } });
  const form = dialog.querySelector('form');
  form.addEventListener('submit', event => { event.preventDefault(); saveFood(form); });
  form.addEventListener('input', event => { if (event.target.id === 'food-search') { searchController?.abort(); ++searchRequest; updateProductChoices(event.target.value); } else updatePortionPreview(); });
  if (!productOnly && !food && !recipe) updateProductChoices('');
  updatePortionPreview();
}
function updateProductChoices(query) {
  if (!foodContext || !$('food-search-results')) return;
  const q = query.toLocaleLowerCase('ru').trim();
  const all = [...workspace.state.products, ...PRODUCTS];
  let matches = q ? all.filter(p => p.name.toLocaleLowerCase('ru').includes(q)) : all.filter(p => workspace.state.favorites.includes(p.id));
  if (!q && !matches.length) matches = all.slice(0, 5);
  $('food-search-results').innerHTML = matches.slice(0, 6).map(p => `<button type="button" class="product-choice" data-action="choose-product" data-value="${e(p.id)}"><span><strong>${e(p.name)}</strong><small>${e(p.category || 'Мой продукт')}</small></span><span>${num(p.kcal)} ккал / 100 г</span></button>`).join('') || '<div class="field-intro" style="padding:12px;margin:0">Не нашли? Введите название и пищевую ценность ниже.</div>';
  $('online-search-status').hidden = true;
}
function fillProduct(product) {
  if (!foodContext || !product) return;
  foodContext.product = product;
  $('food-name').value = product.name;
  for (const key of ['kcal', 'protein', 'fat', 'carbs']) $(`food-${key}`).value = product[key];
  $('food-search').value = product.name; $('food-search-results').innerHTML = '';
  $('online-search-status').hidden = true;
  updatePortionPreview(); $('food-weight')?.focus();
}
function updatePortionPreview() {
  if (!$('portion-kcal')) return;
  const grams = Number($('food-weight')?.value) || 0;
  $('portion-grams').textContent = num(grams);
  $('portion-kcal').textContent = num(round((Number($('food-kcal').value) || 0) * grams / 100));
}
function saveFood(form) {
  try {
    const ctx = foodContext;
    if (!ctx) return;
    const name = $('food-name').value.trim();
    if (!name) throw new Error('Укажите название продукта.');
    const product = { id: uid(), name, category: 'Мои продукты', ...Object.fromEntries(['kcal', 'protein', 'fat', 'carbs'].map(k => [k, readNumeric(form, `food-${k}`)])) };
    portion(product, 100);
    if (ctx.productOnly) {
      workspace.update(s => { if (s.products.length >= 2000) throw new Error('В библиотеке уже 2 000 продуктов. Удалите ненужные.'); s.products.unshift(product); });
      closeModal(); libraryTab = 'products'; navigate('library'); toast('Продукт сохранён в библиотеке.'); return;
    }
    const weight = readNumeric(form, 'food-weight');
    const entry = { id: ctx.editing || uid(), name, weight, meal: $('food-meal').value, checked: ctx.date <= dateKey() && $('food-checked').checked, ...portion(product, weight) };
    const shouldSave = $('food-save-product')?.checked;
    workspace.dayUpdate(ctx.date, (day, s) => {
      if (ctx.editing) { const i = day.foods.findIndex(f => f.id === ctx.editing); if (i === -1) throw new Error('Эта запись удалена в другом окне. Создайте новую.'); day.foods[i] = entry; }
      else { if (day.foods.length >= 1000) throw new Error('Слишком много записей за один день.'); day.foods.push(entry); }
      if (shouldSave && !s.products.some(p => p.name.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'))) s.products.unshift(product);
    });
    closeModal(); render(); toast(ctx.editing ? 'Запись обновлена.' : entry.checked ? 'Добавлено в дневник. Приятного дня.' : 'Добавлено в план питания.');
  } catch (error) { showFormError(error, form); }
}
async function searchOnline(button) {
  const query = $('food-search')?.value.trim();
  if (!foodContext || !query || query.length < 2) { $('food-search')?.focus(); toast('Введите хотя бы две буквы названия.'); return; }
  if (navigator.onLine === false) { toast('Нет подключения. Выберите продукт из встроенной базы или введите данные с упаковки.', { error: true }); return; }
  searchController?.abort(); const controller = new AbortController(); searchController = controller;
  const request = ++searchRequest; const dialog = document.querySelector('#modal-root dialog');
  const status = $('online-search-status'); status.hidden = false; status.textContent = 'Ищем в Open Food Facts…'; button.disabled = true;
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
    url.search = new URLSearchParams({ search_terms: query, search_simple: '1', action: 'process', json: '1', page_size: '8', fields: 'product_name,product_name_ru,brands,nutriments' });
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error('Поиск сейчас недоступен. Введите данные с упаковки.');
    const result = await response.json();
    if (request !== searchRequest || !foodContext || !dialog.isConnected) return;
    foodContext.external = (result.products || []).map(p => { const n = p.nutriments || {}; return { name: String(p.product_name_ru || p.product_name || '').slice(0, 150), category: String(p.brands || 'Open Food Facts').slice(0, 80), kcal: Number(n['energy-kcal_100g'] ?? Number(n.energy_100g) / 4.184), protein: Number(n.proteins_100g ?? 0), fat: Number(n.fat_100g ?? 0), carbs: Number(n.carbohydrates_100g ?? 0) }; }).filter(p => p.name && ['kcal', 'protein', 'fat', 'carbs'].every(k => Number.isFinite(p[k]) && p[k] >= 0 && p[k] <= (k === 'kcal' ? 1000 : 100)));
    $('food-search-results').innerHTML = foodContext.external.map((p, i) => `<button type="button" class="product-choice" data-action="choose-external" data-value="${i}"><span><strong>${e(p.name)}</strong><small>${e(p.category)}</small></span><span>${num(p.kcal)} ккал</span></button>`).join('');
    status.textContent = foodContext.external.length ? 'Данные сообщества Open Food Facts. Проверьте значения на упаковке.' : 'Ничего не нашлось. Можно заполнить данные вручную.';
  } catch (error) { if (request === searchRequest && dialog.isConnected) { status.textContent = controller.signal.aborted ? 'Поиск не ответил вовремя. Встроенные продукты по-прежнему доступны.' : error.message; } }
  finally { clearTimeout(timeout); if (button.isConnected) button.disabled = false; }
}

function openSetup() {
  const dialog = openModal('Здесь начинается ваш ритм.', `<form id="setup-form" class="setup-form"><div class="setup-art" role="img" aria-label="Тихий внутренний двор с оливковым деревом и отражением в воде"></div><p class="setup-description">Немного пространства для себя — каждый день.<br>Начнём с простых ориентиров. Их всегда можно изменить.</p>${field('Как к вам обращаться', 'setup-name', '', 'maxlength="50" autocomplete="given-name" autofocus', { hint: 'Можно оставить пустым' })}<div class="form-grid">${field('Энергия, ккал', 'setup-calories', 2200, 'min="800" max="6000" step="1"', { type: 'number', required: true })}${field('Вода, мл', 'setup-water', 2000, 'min="250" max="6000" step="50"', { type: 'number', required: true })}${field('Движение, шагов', 'setup-steps', 8000, 'min="500" max="50000" step="100"', { type: 'number', required: true })}<label class="field"><span>Мне хочется</span><select id="setup-intention">${Object.entries(INTENTIONS).map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label></div><div class="inline-note compact">${icon('info')}Числа — стартовый пример, а не персональный расчёт. Белки, жиры и углеводы можно настроить в профиле.</div><div class="setup-footnote">${icon('shield')}Демо-записи не попадут в ваш дневник. Данные сохраняются только в этом браузере.</div>${errorText}<div class="dialog-actions">${btn('Пока посмотреть', 'close-modal', { cls: 'button button-ghost' })}${btn('Создать мой дневник', '', { type: 'submit', cls: 'button button-primary', symbol: 'arrow' })}</div></form>`);
  dialog.querySelector('form').addEventListener('submit', event => {
    event.preventDefault(); const form = event.target;
    try {
      const profile = { name: $('setup-name').value.trim(), calories: readNumeric(form, 'setup-calories'), water: readNumeric(form, 'setup-water'), steps: readNumeric(form, 'setup-steps'), intention: $('setup-intention').value };
      const next = newWorkspace(profile); next.preferences = structuredClone(workspace.state.preferences);
      workspace.replace(next); selectedDate = dateKey(); closeModal(); navigate('overview'); toast('Ваше пространство готово. Начните с небольшого шага.');
    } catch (error) { showFormError(error, form); }
  });
}
function openWater() {
  const dialog = openModal('Ещё немного воды.', `<form id="water-form"><p class="setup-description">Стакан, чашка или любимая бутылка — учитывайте удобный вам объём.</p>${field('Объём, мл', 'water-amount', 250, 'min="1" max="2000" step="1" inputmode="numeric" autofocus', { type: 'number', required: true })}${errorText}<div class="dialog-actions">${btn('Отмена', 'close-modal', { cls: 'button button-ghost' })}${btn('Добавить воду', '', { type: 'submit', cls: 'button button-primary', symbol: 'plus' })}</div></form>`);
  const date = selectedDate;
  dialog.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); try { const amount = readNumeric(ev.target, 'water-amount'); if (amount <= 0 || amount > 2000) throw new Error('Добавьте от 1 до 2 000 мл за раз.'); addWater(amount, date); closeModal(); } catch (error) { showFormError(error, ev.target); } });
}
function addWater(amount, date = selectedDate) {
  if (date > dateKey()) throw new Error('Воду можно записать за сегодня или прошедший день.');
  if (!Number.isFinite(amount) || amount <= 0 || amount > 2000) throw new Error('Некорректный объём воды.');
  const entry = { id: uid(), amount, time: new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date()) };
  workspace.dayUpdate(date, day => { if (day.water + amount > 15000) throw new Error('Проверьте записи: за день уже внесено 15 литров.'); day.water += amount; day.waterLog.push(entry); if (day.waterLog.length > 200) day.waterLog.shift(); });
  render(); toast(`Добавлено ${num(amount)} мл.`, { actionLabel: 'Отменить', action: () => { removeWater(entry.id, date, false); } });
}
function removeWater(id, date = selectedDate, allowUndo = true) {
  const record = workspace.getDay(date).waterLog.find(l => l.id === id); if (!record) return;
  workspace.dayUpdate(date, day => { day.water = Math.max(0, day.water - record.amount); day.waterLog = day.waterLog.filter(l => l.id !== id); }); render();
  if (allowUndo) toast('Запись воды удалена.', { actionLabel: 'Вернуть', action: () => { workspace.dayUpdate(date, d => { if (d.waterLog.some(l => l.id === id)) return; d.water += record.amount; d.waterLog.push(record); }); render(); } });
}
function openActivity() {
  const date = selectedDate, day = workspace.getDay(date);
  const dialog = openModal('Движение в вашем темпе.', `<form id="activity-form"><p class="setup-description">Внесите итоговые значения за ${dateLabel(date)}. Это заменит предыдущую запись дня.</p><div class="form-grid">${field('Шагов за день', 'activity-steps', day.steps, 'min="0" max="100000" step="1" inputmode="numeric" autofocus', { type: 'number', required: true })}${field('Активность, минут', 'activity-minutes', day.activeMinutes, 'min="0" max="1440" step="1" inputmode="numeric"', { type: 'number', required: true })}</div><div class="inline-note compact">${icon('walk')}Данные можно взять с телефона, часов или записать самостоятельно. Автоматической синхронизации с трекерами нет.</div>${errorText}<div class="dialog-actions">${btn('Отмена', 'close-modal', { cls: 'button button-ghost' })}${btn('Сохранить', '', { type: 'submit', cls: 'button button-primary', symbol: 'check' })}</div></form>`);
  dialog.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); try { if (date > dateKey()) throw new Error('Активность можно записать за сегодня или прошедший день.'); const steps = readNumeric(ev.target, 'activity-steps'), minutes = readNumeric(ev.target, 'activity-minutes'); if (steps < 0 || steps > 100000 || minutes < 0 || minutes > 1440) throw new Error('Проверьте количество шагов и минут.'); workspace.dayUpdate(date, d => { d.steps = Math.round(steps); d.activeMinutes = Math.round(minutes); }); closeModal(); render(); toast('Активность сохранена.'); } catch (error) { showFormError(error, ev.target); } });
}
function openHabit() {
  if (workspace.state.habits.length >= 30) throw new Error('Можно добавить до 30 ритуалов. Оставьте место для самого важного.');
  const dialog = openModal('Ваш маленький ритуал.', `<form id="habit-form">${field('Название', 'habit-name', '', 'maxlength="80" placeholder="Например, 10 минут с книгой" autofocus', { required: true })}<div class="form-grid" style="margin-top:17px">${field('Время в расписании', 'habit-time', '12:00', '', { type: 'time', required: true })}<label class="field"><span>Символ</span><select id="habit-icon"><option value="leaf">Лист</option><option value="sun">Солнце</option><option value="moon">Луна</option><option value="heart">Сердце</option><option value="walk">Движение</option><option value="drop">Вода</option></select></label></div>${field('Небольшая подсказка себе', 'habit-detail', '', 'maxlength="150" placeholder="Необязательно"')}<p class="field-intro" style="margin-top:15px;margin-bottom:0">Время отображается в расписании внутри приложения. Фоновые уведомления не отправляются.</p>${errorText}<div class="dialog-actions">${btn('Отмена', 'close-modal', { cls: 'button button-ghost' })}${btn('Добавить ритуал', '', { type: 'submit', cls: 'button button-primary', symbol: 'plus' })}</div></form>`);
  dialog.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); try { const name = $('habit-name').value.trim(), time = $('habit-time').value; if (!name) throw new Error('Назовите свой ритуал.'); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Укажите время.'); workspace.update(s => s.habits.push({ id: uid(), name, time, detail: $('habit-detail').value.trim(), icon: $('habit-icon').value })); closeModal(); render(); toast('Новый ритуал добавлен.'); } catch (error) { showFormError(error, ev.target); } });
}
function openWeight() {
  const date = selectedDate > dateKey() ? dateKey() : selectedDate;
  const last = workspace.state.weights.filter(w => w.date <= date).at(-1);
  const dialog = openModal('Просто ещё одна точка.', `<form id="weight-form"><p class="setup-description">Вес меняется по многим причинам. Одно измерение — не оценка вашего дня.</p><div class="form-grid">${field('Вес, кг', 'weight-value', last?.weight || '', 'min="30" max="350" step="0.1" inputmode="decimal" autofocus', { type: 'number', required: true })}${field('Дата', 'weight-date', date, `min="2000-01-01" max="${dateKey()}"`, { type: 'date', required: true })}</div><p class="field-intro" style="margin-top:15px;margin-bottom:0">Повторная запись на ту же дату заменит предыдущее измерение.</p>${errorText}<div class="dialog-actions">${btn('Отмена', 'close-modal', { cls: 'button button-ghost' })}${btn('Сохранить измерение', '', { type: 'submit', cls: 'button button-primary', symbol: 'check' })}</div></form>`);
  dialog.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); try { const weight = readNumeric(ev.target, 'weight-value'), d = $('weight-date').value; if (weight < 30 || weight > 350 || !validDate(d) || d > dateKey()) throw new Error('Проверьте дату и вес (от 30 до 350 кг).'); workspace.update(s => { s.weights = s.weights.filter(w => w.date !== d); s.weights.push({ date: d, weight: round(weight) }); s.weights.sort((a, b) => a.date.localeCompare(b.date)); }); closeModal(); render(); toast('Измерение сохранено.'); } catch (error) { showFormError(error, ev.target); } });
}
function openRecipe(id) {
  const r = RECIPES.find(r => r.id === id); if (!r) return;
  const t = recipeNutrition(r);
  openModal(r.name, `<div class="recipe-detail-art ${r.tint}">${foodArt(r.art, r.id)}</div><p class="soft-copy">${r.subtitle} · ${r.time} минут · 1 порция (${num(t.weight)} г)</p><div class="recipe-nutrition">${[['kcal', 'Ккал'], ['protein', 'Белки, г'], ['fat', 'Жиры, г'], ['carbs', 'Углеводы, г']].map(([k, name]) => `<div><strong>${num(t[k])}</strong><span>${name}</span></div>`).join('')}</div><h3>Что понадобится</h3><ul class="recipe-ingredients">${r.ingredients.map(([id, grams]) => `<li><span>${PRODUCTS.find(p => p.id === id).name}</span><span>${num(grams)} г</span></li>`).join('')}</ul><h3>Готовим без спешки</h3><ol class="recipe-steps">${r.steps.map(step => `<li>${step}</li>`).join('')}</ol><p class="soft-copy">Пищевая ценность ориентировочная. Вес порции рассчитан по указанным ингредиентам и может измениться при готовке.</p><div class="dialog-actions">${btn('В избранное', 'favorite', { value: `recipe-${id}`, cls: 'button button-ghost', symbol: 'heart' })}${btn('В дневник', 'add-recipe', { value: id, cls: 'button button-primary', symbol: 'plus' })}</div>`);
}
function addRecipe(id) { const r = RECIPES.find(r => r.id === id); if (r) openFood(r.category, { recipe: { ...recipeNutrition(r), name: r.name } }); }
function saveTemplate(meal) {
  const foods = workspace.getDay(selectedDate).foods.filter(f => f.meal === meal); if (!foods.length) return;
  const dialog = openModal('Сохраните любимое сочетание.', `<form id="template-form">${field('Название набора', 'template-name', `Мой ${MEALS.find(m => m.id === meal)?.name.toLocaleLowerCase('ru') || 'набор'}`, 'maxlength="80" autofocus', { required: true })}<p class="field-intro" style="margin-top:15px;margin-bottom:0">${foods.map(f => e(f.name)).join(' · ')}<br>${num(totals(foods, false).kcal)} ккал в наборе</p>${errorText}<div class="dialog-actions">${btn('Отмена', 'close-modal', { cls: 'button button-ghost' })}${btn('Сохранить набор', '', { type: 'submit', cls: 'button button-primary', symbol: 'copy' })}</div></form>`);
  dialog.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); try { const name = $('template-name').value.trim(); if (!name) throw new Error('Укажите название набора.'); workspace.update(s => { if (s.templates.length >= 100) throw new Error('Можно сохранить до 100 наборов.'); s.templates.push({ id: uid(), name, foods: structuredClone(foods) }); }); closeModal(); render(); toast('Набор сохранён в библиотеке.'); } catch (error) { showFormError(error, ev.target); } });
}
function openTemplates() {
  const templates = workspace.state.templates;
  openModal('Ваши любимые сочетания.', templates.length ? `<p class="soft-copy">Выберите набор и добавьте его на ${dateLabel(selectedDate)}.</p><div class="template-choices">${templates.map(t => `<button type="button" class="template-choice" data-action="apply-template" data-value="${e(t.id)}">${icon('copy')}<span><strong>${e(t.name)}</strong><small>${num(totals(t.foods, false).kcal)} ккал · ${t.foods.length} продуктов</small></span>${icon('plus')}</button>`).join('')}</div>` : emptyState('Любимое можно повторить', 'Сохраните приём пищи как набор в дневнике. Здесь он будет всегда под рукой.'));
}
function applyTemplate(id) {
  const t = workspace.state.templates.find(t => t.id === id); if (!t) return;
  const date = selectedDate;
  const dialog = openModal(t.name, `<form id="apply-template-form"><p class="setup-description">${t.foods.map(f => e(f.name)).join(' · ')}<br>${num(totals(t.foods, false).kcal)} ккал · ${dateLabel(date)}</p><label class="field"><span>Приём пищи</span><select id="template-meal">${MEALS.map(m => `<option value="${m.id}" ${m.id === defaultMeal() ? 'selected' : ''}>${m.name}</option>`).join('')}</select></label><label class="check-row"><input id="template-checked" type="checkbox" ${date <= dateKey() ? 'checked' : ''}>Уже съедено</label>${errorText}<div class="dialog-actions">${btn('Отмена', 'close-modal', { cls: 'button button-ghost' })}${btn('Добавить набор', '', { type: 'submit', cls: 'button button-primary', symbol: 'plus' })}</div></form>`);
  dialog.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); try { const meal = $('template-meal').value, checked = date <= dateKey() && $('template-checked').checked; workspace.dayUpdate(date, d => { if (d.foods.length + t.foods.length > 1000) throw new Error('Слишком много записей за день.'); d.foods.push(...t.foods.map(f => ({ ...f, id: uid(), meal, checked }))); }); closeModal(); render(); toast('Любимое сочетание добавлено в дневник.'); } catch (error) { showFormError(error, ev.target); } });
}

function openDayEditor() {
  const date = selectedDate, day = workspace.getDay(date), plan = dayPlan(workspace.state, day);
  const dialog = openModal('Соберите день по-своему.', `<form id="day-plan-form"><p class="setup-description">${dateLabel(date, { day: 'numeric', month: 'long' })}. Выберите небольшие действия, которым хочется найти место. Часы — ориентир, а не дедлайн.</p><div class="form-grid"><label class="field" for="plan-rhythm"><span>Ритм дня</span><select id="plan-rhythm">${Object.entries(RHYTHMS).map(([id, r]) => `<option value="${id}" ${(day.rhythm || 'balance') === id ? 'selected' : ''}>${r.name}</option>`).join('')}</select></label>${field('Намерение на день', 'plan-intention', day.intention, 'maxlength="120" placeholder="Например, не спешить за обедом"')}</div><div class="day-plan-editor">${workspace.state.habits.map((h, i) => { const item = plan.find(p => p.id === h.id); return `<div class="day-plan-edit-row"><label for="plan-habit-${i}"><input type="checkbox" id="plan-habit-${i}" data-habit-id="${e(h.id)}" ${item ? 'checked' : ''}><span><strong>${e(h.name)}</strong><small>${e(h.detail || 'Небольшое действие для себя')}</small></span></label><input type="time" id="plan-time-${i}" data-time-for="${e(h.id)}" value="${e(item?.time || h.time)}" aria-label="Время: ${e(h.name)}" required></div>`; }).join('')}</div><p class="day-plan-editor-note">Можно оставить день без списка. Настройки питания, воды и движения останутся вашими.</p>${errorText}<div class="dialog-actions">${btn('Отмена', 'close-modal', { cls: 'button button-ghost' })}${btn('Сохранить мой маршрут', '', { type: 'submit', cls: 'button button-primary', symbol: 'check' })}</div></form>`, { wide: true });
  const form = dialog.querySelector('form');
  const rhythmField = dialog.querySelector('#plan-rhythm');
  for (const checkbox of form.querySelectorAll('[data-habit-id]')) {
    const time = [...form.querySelectorAll('[data-time-for]')].find(x => x.dataset.timeFor === checkbox.dataset.habitId);
    const update = () => { if (time) { time.disabled = !checkbox.checked; if (checkbox.checked) time.setAttribute('required', ''); else time.removeAttribute('required'); } };
    checkbox.addEventListener('change', update); update();
  }
  rhythmField.addEventListener('change', () => {
    const rhythm = RHYTHMS[rhythmField.value];
    if (!rhythm) return;
    for (const [id, time] of rhythm.slots) {
      const input = [...form.querySelectorAll('[data-time-for]')].find(x => x.dataset.timeFor === id);
      if (input) input.value = time;
    }
  });
  form.addEventListener('submit', ev => {
    ev.preventDefault();
    try {
      const raw = [...form.querySelectorAll('[data-habit-id]')].filter(x => x.checked).map(input => ({ habitId: input.dataset.habitId, time: [...form.querySelectorAll('[data-time-for]')].find(x => x.dataset.timeFor === input.dataset.habitId)?.value }));
      const nextPlan = normalizePlan(raw);
      if (nextPlan.length !== raw.length) throw new Error('Проверьте время выбранных ритуалов.');
      const rhythm = rhythmField.value;
      if (!Object.hasOwn(RHYTHMS, rhythm)) throw new Error('Выберите ритм дня.');
      workspace.dayUpdate(date, d => { d.plan = nextPlan; d.rhythm = rhythm; d.intention = $('plan-intention').value.trim().slice(0, 120); });
      closeModal(); render(); toast('Ваш маршрут сохранён. Следуйте удобному темпу.');
    } catch (error) { showFormError(error, form); }
  });
}
function openCheckIn(target = '') {
  const date = target === 'today' ? dateKey() : selectedDate, day = workspace.getDay(date), future = date > dateKey();
  const dialog = openModal(future ? 'Оставьте место для себя.' : 'Как вы — на самом деле?', `<form id="checkin-form" class="checkin-form"><p class="checkin-description">${future ? 'Что хочется принести в этот день?' : 'Без правильного ответа.<br>Просто немного внимания к себе.'}</p>${!future ? `<div class="checkin-moods" role="radiogroup" aria-label="Моё самочувствие">${MOODS.map(m => `<label class="checkin-choice"><input type="radio" name="checkin-mood" value="${m.id}" ${day.mood === m.id ? 'checked' : ''}>${icon(m.icon)}<span><strong>${m.name}</strong><small>${m.description}</small></span></label>`).join('')}</div><button type="button" id="clear-checkin-mood" class="text-button" style="margin-top:-10px;margin-bottom:20px">Пока без отметки</button>` : ''}${field('Сегодня я выбираю', 'checkin-intention', day.intention, 'maxlength="120" placeholder="Например, обедать без телефона"')}<label class="field" for="checkin-note"><span>Что хочется заметить</span><textarea id="checkin-note" rows="3" maxlength="3000" placeholder="Мысль, маленькая радость или то, что сейчас важно…">${e(day.note)}</textarea></label><span class="checkin-private">${icon('shield')}Личная заметка. Остаётся в вашем пространстве.</span>${errorText}<div class="dialog-actions">${btn('Пока не сейчас', 'close-modal', { cls: 'button button-ghost' })}${btn('Сохранить для себя', '', { type: 'submit', cls: 'button button-primary', symbol: 'check' })}</div></form>`, { wide: true });
  const form = dialog.querySelector('form');
  dialog.querySelector('#clear-checkin-mood')?.addEventListener('click', () => { for (const input of form.querySelectorAll('[name="checkin-mood"]')) input.checked = false; });
  form.addEventListener('submit', ev => {
    ev.preventDefault();
    try {
      const mood = future ? '' : [...form.querySelectorAll('[name="checkin-mood"]')].find(input => input.checked)?.value || '';
      if (mood && !MOODS.some(m => m.id === mood)) throw new Error('Выберите подходящую отметку.');
      workspace.dayUpdate(date, d => { d.mood = mood; d.intention = $('checkin-intention').value.trim().slice(0, 120); d.note = $('checkin-note').value.slice(0, 3000); });
      closeModal(); render(); toast('Немного внимания к себе сохранено.');
    } catch (error) { showFormError(error, form); }
  });
}
function openMoment(id) {
  const date = selectedDate, moment = dayPlan(workspace.state, workspace.getDay(date)).find(m => m.id === id);
  if (!moment) return;
  const prompts = { water: 'Стакан воды.<br>Простое начало заботы.', walk: 'Оставьте экран.<br>Посмотрите, что вокруг.', pause: 'Дайте вниманию<br>немного пространства.', breath: 'Вдохните спокойно.<br>Вернитесь к себе.' };
  const action = id === 'water' ? 'custom-water' : id === 'walk' ? 'activity' : ['pause', 'breath'].includes(id) ? 'breathing' : null;
  const label = id === 'water' ? 'Записать воду' : id === 'walk' ? 'Записать движение' : 'Открыть тихую комнату';
  const dialog = openModal(moment.name, `<div class="moment-emblem">${icon(moment.icon)}</div><p class="moment-description">${prompts[id] || e(moment.detail || moment.name)}</p><p class="moment-time">В вашем маршруте · ${e(moment.time)}<br>Сейчас тоже подходящий момент.</p><p class="soft-copy">${moment.done ? 'Вы уже отметили этот ритуал. Можно вернуться к нему, если хочется.' : 'Это приглашение, а не обязательство. Сделайте так, как удобно вам.'}</p>${errorText}<div class="dialog-actions">${action ? btn(label, action, { cls: 'button button-ghost', symbol: moment.icon }) : ''}<button type="button" id="moment-complete" class="button button-primary">${icon('check')}<span>${moment.done ? 'Вернуть в маршрут' : 'Я сделал это для себя'}</span></button></div>`);
  dialog.querySelector('#moment-complete').addEventListener('click', () => {
    try {
      if (date > dateKey()) throw new Error('Будущий ритуал пока можно только запланировать.');
      workspace.dayUpdate(date, d => { d.habits = d.habits.includes(id) ? d.habits.filter(x => x !== id) : [...d.habits, id]; });
      closeModal(); render(); toast(moment.done ? 'Ритуал возвращён в маршрут.' : 'Ещё немного заботы о себе.');
    } catch (error) { showFormError(error, dialog); }
  });
}
function openCommands() {
  const commands = [
    { id: 'food', title: 'Записать приём пищи', subtitle: 'Найти продукт или внести свой', symbol: 'bowl', kind: 'action', action: 'open-food', keywords: 'еда калории питание завтрак обед ужин' },
    { id: 'water', title: 'Добавить стакан воды', subtitle: '+250 мл в выбранный день', symbol: 'drop', kind: 'action', action: 'add-water', value: '250', keywords: 'вода пить стакан 250' },
    { id: 'quiet', title: 'Минута для себя', subtitle: 'Тихая комната · 1, 3 или 5 минут', symbol: 'wind', kind: 'action', action: 'breathing', keywords: 'дыхание пауза тишина отдых' },
    { id: 'checkin', title: 'Отметить самочувствие', subtitle: 'Состояние, намерение и личная заметка', symbol: 'leaf', kind: 'action', action: 'check-in', keywords: 'заметка настроение как я самочувствие намерение' },
    { id: 'plan', title: 'Собрать мой день', subtitle: 'Настроить время и выбрать ритуалы', symbol: 'calendar', kind: 'action', action: 'edit-day', keywords: 'маршрут план расписание день ритуалы' },
    { id: 'activity', title: 'Записать движение', subtitle: 'Шаги и минуты активности', symbol: 'walk', kind: 'action', action: 'activity', keywords: 'шаги активность спорт прогулка' },
    ...NAVCommands(),
    ...RECIPES.map(r => ({ id: `recipe-${r.id}`, title: r.name, subtitle: `Рецепт · ${r.time} минут`, symbol: 'bowl', kind: 'recipe', value: r.id, keywords: 'рецепт приготовить' })),
    ...[...workspace.state.products, ...PRODUCTS].map(p => ({ id: `product-${p.id}`, title: p.name, subtitle: `${num(p.kcal)} ккал / 100 г`, symbol: 'apple', kind: 'product', value: p.id, keywords: 'продукт еда' })),
  ];
  let matches = [], active = 0;
  const dialog = openModal('Одно действие — и дальше.', `<div class="command-input-wrap">${icon('search')}<input id="command-search" type="search" placeholder="Что вам сейчас нужно?" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="command-results" autocomplete="off" autofocus></div><div id="command-results" class="command-list" role="listbox" aria-label="Быстрые действия"></div><div class="command-footnote"><span>↑ ↓ выбрать · Enter открыть</span><span>Esc — вернуться в день</span></div>`, { cls: 'command-dialog' });
  const input = dialog.querySelector('#command-search'), list = dialog.querySelector('#command-results');
  function draw() {
    matches = commandMatches(commands, input.value).slice(0, 10);
    active = Math.max(0, Math.min(active, matches.length - 1));
    list.innerHTML = matches.map((c, i) => `<button type="button" class="command-item ${i === active ? 'active' : ''}" id="command-option-${i}" data-command-id="${e(c.id)}" role="option" aria-selected="${i === active}">${icon(c.symbol)}<span class="command-copy"><strong>${e(c.title)}</strong><small>${e(c.subtitle)}</small></span>${icon('arrow')}</button>`).join('') || '<p class="command-no-results">Пока ничего не нашлось. Попробуйте другое слово.</p>';
    if (matches.length) input.setAttribute('aria-activedescendant', `command-option-${active}`); else input.removeAttribute('aria-activedescendant');
    list.querySelectorAll('[data-command-id]').forEach((button, i) => button.addEventListener('click', () => run(matches[i])));
  }
  function run(command) {
    if (!command) return;
    closeModal();
    try {
      if (command.kind === 'route') navigate(command.value);
      else if (command.kind === 'recipe') openRecipe(command.value);
      else if (command.kind === 'product') { const p = productById(command.value); if (p) openFood('', { product: p }); }
      else actions[command.action]?.(command.value || '');
    } catch (error) { toast(error.message, { error: true }); }
  }
  input.addEventListener('input', () => { active = 0; draw(); });
  input.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); if (!matches.length) return; active = (active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length; draw(); dialog.querySelector(`#command-option-${active}`)?.scrollIntoView({ block: 'nearest' }); }
    if (event.key === 'Enter') { event.preventDefault(); run(matches[active]); }
  });
  draw();
}
function NAVCommands() { return views.NAV.map(([id, name, symbol]) => ({ id: `route-${id}`, title: name, subtitle: 'Перейти в раздел', symbol, kind: 'route', value: id, keywords: 'раздел открыть перейти' })); }

function openBreathing() {
  let timer = null, started = 0, elapsedBefore = 0, running = false, completed = false, lastPhase = '', duration = 60;
  const cleanup = () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); };
  const dialog = openModal('Тихая комната.', `<div class="breath-durations" aria-label="Продолжительность паузы">${BREATH_DURATIONS.map(n => `<button type="button" data-duration="${n}" class="${n === 60 ? 'active' : ''}" aria-pressed="${n === 60}">${n / 60} мин</button>`).join('')}</div><div class="breath-timer" id="breath-time" aria-live="off">01:00</div><div class="breath-scene"><div class="breath-orbit"></div><div class="breath-circle" id="breath-circle"></div><div class="breath-label"><strong id="breath-phase" aria-live="polite">Без спешки.</strong><small id="breath-cycle">Шесть спокойных циклов</small></div></div><p id="breath-description">Устройтесь удобно. Дышите мягко, без усилий.<br>Следуйте кругу в комфортном для вас темпе.</p><button type="button" id="breath-start" class="button button-light">${icon('play')}<span>Начать паузу</span></button><p class="breath-footnote">Если ритм неудобен, дышите как обычно или завершите паузу.</p>`, { cls: 'breathing-dialog', cleanup });
  const button = dialog.querySelector('#breath-start');
  dialog.querySelectorAll('[data-duration]').forEach(choice => choice.addEventListener('click', () => {
    if (running || elapsedBefore > 0) return;
    const next = Number(choice.dataset.duration); if (!BREATH_DURATIONS.includes(next)) return;
    duration = next; completed = false; lastPhase = '';
    for (const item of dialog.querySelectorAll('[data-duration]')) { item.classList.toggle('active', item === choice); item.setAttribute('aria-pressed', String(item === choice)); }
    $('breath-time').textContent = `${String(duration / 60).padStart(2, '0')}:00`;
    $('breath-phase').textContent = 'Без спешки.'; $('breath-cycle').textContent = `${duration / 10} спокойных циклов`;
    $('breath-description').innerHTML = 'Устройтесь удобно. Дышите мягко, без усилий.<br>Следуйте кругу в комфортном для вас темпе.';
    button.innerHTML = `${icon('play')}<span>Начать паузу</span>`;
  }));
  function elapsed() { return elapsedBefore + (running ? performance.now() - started : 0); }
  function tick() {
    const ms = elapsed(); const seconds = Math.max(0, Math.ceil((duration * 1000 - ms) / 1000));
    $('breath-time').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    if (ms >= duration * 1000) {
      clearInterval(timer); running = false; completed = true; elapsedBefore = 0;
      $('breath-time').textContent = 'ВРЕМЯ ДЛЯ СЕБЯ'; $('breath-phase').textContent = 'Спасибо себе.';
      $('breath-cycle').textContent = 'Вы нашли время для паузы'; $('breath-circle').classList.remove('inhale');
      $('breath-description').textContent = 'Побудьте в этом спокойствии ещё немного. Возвращайтесь к делам, когда будете готовы.';
      button.innerHTML = `${icon('play')}<span>Ещё немного тишины</span>`;
      for (const choice of dialog.querySelectorAll('[data-duration]')) choice.disabled = false;
      try { workspace.dayUpdate(dateKey(), d => { if (!d.habits.includes('breath')) d.habits.push('breath'); }); render(); } catch (error) { toast(error.message, { error: true }); }
      return;
    }
    const phase = ms % 10000 < 4000 ? 'inhale' : 'exhale';
    if (phase !== lastPhase) { lastPhase = phase; $('breath-circle').style.setProperty('--phase-duration', phase === 'inhale' ? '4s' : '6s'); $('breath-circle').classList.toggle('inhale', phase === 'inhale'); $('breath-phase').textContent = phase === 'inhale' ? 'Вдох.' : 'Выдох.'; }
    $('breath-cycle').textContent = `${Math.floor(ms / 10000) + 1} из ${duration / 10} · в удобном темпе`;
  }
  function pause() { elapsedBefore = elapsed(); running = false; clearInterval(timer); button.innerHTML = `${icon('play')}<span>Продолжить</span>`; $('breath-phase').textContent = 'Пауза.'; lastPhase = ''; }
  function onVisibility() { if (document.hidden && running) pause(); }
  document.addEventListener('visibilitychange', onVisibility);
  button.addEventListener('click', () => {
    if (running) { pause(); return; }
    if (completed) { elapsedBefore = 0; completed = false; }
    running = true; started = performance.now(); lastPhase = '';
    for (const choice of dialog.querySelectorAll('[data-duration]')) choice.disabled = true;
    button.innerHTML = `${icon('pause')}<span>Приостановить</span>`; tick(); timer = setInterval(tick, 150);
  });
}

function openPrivacy() {
  openModal('Личное остаётся личным.', `<div class="about-copy"><p>Дневник RITUA хранится локально в этом браузере. Приложение не публикует ваши записи и не отправляет их в стороннюю базу.</p></div><div class="privacy-facts">${[['shield', 'Ваш дневник — на вашем устройстве', 'Питание, вода, вес, имя и заметки сохраняются в localStorage этого браузера. В другом браузере их не будет без импорта копии.'], ['download', 'Копия, которой управляете вы', 'JSON сохраняет все записи, настройки и перенесённые данные FitCat. CSV подходит для анализа статистики. Очистка браузера может удалить локальный дневник.'], ['search', 'Внешний поиск — по вашему действию', 'При нажатии «Искать в Open Food Facts» название продукта отправляется этому сервису. Личные записи не отправляются. Встроенная база работает без сети.'], ['wifi', 'Работа без интернета', 'После первого открытия на поддерживаемом HTTPS-хостинге приложение кэширует интерфейс. Поиск в интернете и вход на закрытый сайт требуют подключения.']].map(([symbol, title, copy]) => `<div class="privacy-fact">${icon(symbol)}<div><strong>${title}</strong>${copy}</div></div>`).join('')}</div><p class="soft-copy">Доступ к опубликованной закрытой версии управляется платформой размещения. Эта памятка описывает поведение самого приложения.</p><div class="dialog-actions">${btn('Скачать мои данные', 'export-json', { cls: 'button button-ghost', symbol: 'download' })}${btn('Понятно', 'close-modal', { cls: 'button button-primary' })}</div>`);
}
function openAbout() {
  openModal('Забота в вашем ритме.', `<div class="about-brand">${brandMark()}<span>ritua.</span></div><div class="about-copy"><p>Личное пространство для хорошего самочувствия. Питание, вода, движение и небольшие ритуалы, которым найдётся место даже в насыщенном дне.</p><p>Мы верим в внимание к себе без давления, бесконечных серий и гонки за идеальными цифрами.</p><h3>Простые и честные ориентиры</h3><p>Цели задаются вами. Начальные значения — пример, а не медицинская рекомендация. Справочная пищевая ценность приблизительна; проверяйте конкретные продукты по этикетке.</p><p>О движении: <a href="https://www.cdc.gov/physical-activity-basics/guidelines/adults.html" target="_blank" rel="noopener noreferrer">материалы CDC</a>. О питьевом режиме: <a href="https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/water-drinks-nutrition/" target="_blank" rel="noopener noreferrer">материалы NHS</a>.</p><h3>RITUA Atelier 2.0</h3><p>Экспериментальная глава RITUA. Личный маршрут дня, отметка самочувствия, быстрые команды и тихая комната. Встроенные продукты и рецепты доступны без подписки. Автоматическое распознавание еды, облачная синхронизация и оплата в эту версию не включены.</p></div><div class="dialog-actions">${btn('О конфиденциальности', 'privacy', { cls: 'button button-ghost', symbol: 'shield' })}${btn('Хорошо', 'close-modal', { cls: 'button button-primary' })}</div>`);
}
function openReminders() {
  const day = workspace.getDay(dateKey());
  openModal('Ваш личный маршрут.', `<p class="soft-copy">Ваш выбранный ритм на сегодня. Время — мягкий ориентир, а не ещё один дедлайн.</p><div class="reminders-list">${dayPlan(workspace.state, day).map(h => `<div class="reminder-row">${icon(h.icon)}<div><strong>${e(h.name)}</strong><small>${e(h.detail)}</small></div><span>${day.habits.includes(h.id) ? icon('check') : e(h.time)}</span></div>`).join('')}</div><div class="inline-note compact">${icon('bell')}Расписание доступно внутри приложения. Уведомления, когда приложение закрыто, не отправляются.</div><div class="dialog-actions">${btn('Перейти к ритуалам', 'go-rituals', { cls: 'button button-primary', symbol: 'arrow' })}</div>`);
}
async function importFile(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) throw new Error('Файл слишком большой. Выберите JSON-копию размером до 5 МБ.');
  pendingImport = parseBackup(await file.text());
  const imported = pendingImport;
  confirmDialog('Восстановить ваше пространство?', `Файл: <strong>${e(file.name)}</strong><br>Дней с записями: ${Object.keys(imported.days).length}. Измерений веса: ${imported.weights.length}. Наборов: ${imported.templates.length}.<br><br>${workspace.demo ? 'Демонстрационные данные заменятся вашими записями.' : 'Текущие записи RITUA будут заменены. При необходимости сначала скачайте их резервную копию в настройках.'}`, () => { workspace.replace(imported); pendingImport = null; selectedDate = dateKey(); closeModal(); navigate('overview'); toast(imported.legacy ? 'Данные FitCat перенесены. Добро пожаловать в RITUA.' : 'Ваше пространство восстановлено.'); }, { label: 'Восстановить' });
}
function exportJSON() {
  const filename = `RITUA-${workspace.demo ? 'demo-' : ''}${dateKey()}.json`;
  downloadFile(filename, JSON.stringify({ ...workspace.state, exportedAt: new Date().toISOString(), ...(workspace.demo ? { demo: true } : {}) }, null, 2));
  toast(workspace.demo ? 'Скачана демонстрационная копия. Для своих записей создайте личный дневник.' : 'Резервная копия скачана. Храните её в надёжном месте.');
}
function deleteWithUndo(collection, id, message, identifier = 'id') {
  const index = workspace.state[collection].findIndex(x => x[identifier] === id); if (index < 0) return;
  const item = structuredClone(workspace.state[collection][index]);
  mutate(s => { s[collection] = s[collection].filter(x => x[identifier] !== id); });
  toast(message, { actionLabel: 'Вернуть', action: () => { mutate(s => { if (!s[collection].some(x => x[identifier] === id)) s[collection].splice(Math.min(index, s[collection].length), 0, item); }); } });
}
function toggleFavorite(id, button) {
  const was = workspace.state.favorites.includes(id);
  workspace.update(s => { s.favorites = was ? s.favorites.filter(x => x !== id) : [...s.favorites, id]; }); render();
  if (button?.closest('dialog')) { button.setAttribute('aria-pressed', String(!was)); button.classList.toggle('is-favorite', !was); button.querySelector('span').textContent = was ? 'В избранное' : 'В избранном'; }
}
const actions = {
  'close-modal': closeModal,
  'go-settings': () => navigate('settings'), 'go-diary': () => navigate('diary'),
  'edit-day': openDayEditor, 'check-in': openCheckIn, commands: openCommands, moment: openMoment,
  'set-rhythm': value => { if (!Object.hasOwn(RHYTHMS, value)) throw new Error('Выберите ритм дня.'); updateDay(d => { d.rhythm = value; d.plan = null; }); }, 'go-rituals': () => { selectedDate = dateKey(); navigate('rituals'); },
  setup: openSetup, privacy: openPrivacy, about: openAbout, reminders: openReminders, breathing: openBreathing,
  'open-food': value => openFood(MEALS.some(m => m.id === value) ? value : ''),
  'custom-product': () => openFood('', { productOnly: true }),
  'choose-product': id => fillProduct(productById(id)),
  'choose-external': i => fillProduct(foodContext?.external[Number(i)]),
  'search-online': (_, button) => searchOnline(button),
  'edit-food': id => { const food = workspace.getDay(selectedDate).foods.find(f => f.id === id); if (food) openFood(food.meal, { food }); },
  'toggle-food': id => updateDay(d => { const f = d.foods.find(f => f.id === id); if (!f) return; if (!f.checked && selectedDate > dateKey()) throw new Error('Будущую запись можно пока только запланировать.'); f.checked = !f.checked; }),
  'delete-food': id => {
    const date = selectedDate, index = workspace.getDay(date).foods.findIndex(f => f.id === id); if (index < 0) return;
    const food = structuredClone(workspace.getDay(date).foods[index]);
    workspace.dayUpdate(date, d => { d.foods = d.foods.filter(f => f.id !== id); }); render();
    toast('Запись удалена.', { actionLabel: 'Вернуть', action: () => { workspace.dayUpdate(date, d => { if (!d.foods.some(f => f.id === id)) d.foods.splice(Math.min(index, d.foods.length), 0, food); }); render(); } });
  },
  'view-meal': meal => { mealFilter = meal; navigate('diary'); },
  'date-prev': () => chooseDate(shiftDate(selectedDate, -1)), 'date-next': () => chooseDate(shiftDate(selectedDate, 1)), 'select-date': chooseDate,
  'add-water': amount => addWater(Number(amount)), 'custom-water': openWater,
  'delete-water': id => removeWater(id),
  'undo-water': () => { const last = workspace.getDay(selectedDate).waterLog.at(-1); if (last) removeWater(last.id); else toast('За этот день пока нет добавлений воды.'); },
  activity: openActivity,
  'toggle-habit': id => { if (selectedDate > dateKey()) throw new Error('Отмечайте ритуалы сегодня или за прошедшие дни.'); updateDay(d => { d.habits = d.habits.includes(id) ? d.habits.filter(h => h !== id) : [...d.habits, id]; }); },
  'new-habit': openHabit,
  'delete-habit': id => deleteWithUndo('habits', id, 'Ритуал удалён из расписания.'),
  'set-mood': mood => { const note = $('day-note')?.value; updateDay(d => { d.mood = d.mood === mood ? '' : mood; if (note != null) d.note = note; }); },
  'log-weight': openWeight,
  'delete-weight': date => deleteWithUndo('weights', date, 'Измерение удалено.', 'date'),
  period: p => { period = p === '30' ? 30 : 7; render(); }, metric: m => { metric = ['kcal', 'water', 'steps'].includes(m) ? m : 'kcal'; render(); },
  'library-tab': tab => { libraryTab = ['recipes', 'products', 'favorites', 'templates'].includes(tab) ? tab : 'recipes'; libraryQuery = ''; recipeFilter = 'all'; render(); },
  'recipe-filter': id => { recipeFilter = id; render(); }, recipe: openRecipe, 'add-recipe': addRecipe,
  favorite: toggleFavorite,
  'add-product': id => { const p = productById(id); if (p) openFood('', { product: p }); },
  'delete-product': id => deleteWithUndo('products', id, 'Продукт удалён из вашей библиотеки.'),
  'save-template': saveTemplate, 'open-templates': openTemplates, 'apply-template': applyTemplate,
  'delete-template': id => deleteWithUndo('templates', id, 'Набор удалён.'),
  'export-json': exportJSON,
  'export-csv': () => { const dates = Array.from({ length: period }, (_, i) => shiftDate(selectedDate, i - period + 1)); downloadFile(`RITUA-${workspace.demo ? 'demo-' : ''}${selectedDate}-${period}days.csv`, toCSV(workspace.state, dates), 'text/csv;charset=utf-8'); toast('Статистика скачана в CSV.'); },
  import: () => { $('import-file').value = ''; $('import-file').click(); },
  'clear-records': () => confirmDialog('Начать дневник с чистого листа?', 'Все записи питания, воды, активности, заметки и измерения веса в RITUA будут удалены. Профиль, библиотека и наборы сохранятся. Это действие нельзя отменить.<br><br>Перед удалением можно скачать резервную копию в настройках. Исходное хранилище FitCat не изменяется.', () => { workspace.update(s => { s.days = {}; s.weights = []; s.legacy = null; }); try { storage.removeItem(RECOVERY_KEY); } catch { /* User can still clear site data in browser settings. */ } closeModal(); render(); toast('Дневник очищен. Ваши настройки сохранены.'); }, { label: 'Удалить записи', danger: true }),
  install: async () => {
    if (installPrompt) { await installPrompt.prompt(); const result = await installPrompt.userChoice; installPrompt = null; if (result.outcome === 'accepted') toast('Установка начата.'); return; }
    openModal('RITUA всегда под рукой.', `<div class="about-copy"><p>Откройте приложение в обычном браузере по защищённому адресу.</p><h3>На iPhone и iPad</h3><p>В Safari нажмите «Поделиться», затем «На экран Домой».</p><h3>На Android</h3><p>Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».</p><h3>На компьютере</h3><p>Если браузер поддерживает установку, соответствующий значок появится в адресной строке или меню.</p></div><div class="dialog-actions">${btn('Понятно', 'close-modal', { cls: 'button button-primary' })}</div>`);
  },
};

document.addEventListener('click', async ev => {
  const button = ev.target.closest?.('[data-action]'); if (!button || button.disabled) return;
  const action = actions[button.dataset.action]; if (!action) return;
  ev.preventDefault(); try { await action(button.dataset.value || '', button); } catch (error) { toast(error.message || 'Не удалось выполнить действие. Повторите попытку.', { error: true }); }
});
document.addEventListener('input', ev => {
  if (ev.target.id === 'library-search') { libraryQuery = ev.target.value; $('library-results').innerHTML = views.libraryResults(context()); }
});
document.addEventListener('change', async ev => {
  try {
    if (ev.target.id === 'selected-date') chooseDate(ev.target.value);
    if (ev.target.id === 'theme-select') { workspace.update(s => { s.preferences.theme = ev.target.value; }); applyPreferences(); updateChrome(); }
    if (ev.target.id === 'reduced-motion') { workspace.update(s => { s.preferences.reducedMotion = ev.target.checked; }); applyPreferences(); updateChrome(); }
    if (ev.target.id === 'import-file') await importFile(ev.target.files?.[0]);
    if (ev.target.id === 'day-note') { workspace.dayUpdate(selectedDate, d => { d.note = ev.target.value.slice(0, 3000); }); updateChrome(); }
  } catch (error) { toast(error.message, { error: true }); if (['theme-select', 'reduced-motion'].includes(ev.target.id)) render(); }
});
document.addEventListener('submit', ev => {
  if (ev.target.id === 'profile-form') {
    ev.preventDefault(); const form = ev.target;
    try {
      const profile = { name: $('profile-name').value.trim(), intention: $('profile-intention').value, ...Object.fromEntries(['calories', 'protein', 'fat', 'carbs', 'water', 'steps'].map(k => [k, readNumeric(form, `profile-${k}`)])), targetWeight: $('profile-targetWeight').value === '' ? null : readNumeric(form, 'profile-targetWeight') };
      const valid = validateWorkspace(newWorkspace(profile), { strict: true }).profile;
      if (workspace.demo) { const next = newWorkspace(valid); next.preferences = structuredClone(workspace.state.preferences); workspace.replace(next); } else workspace.update(s => { s.profile = valid; });
      render(); toast('Ваши настройки сохранены.');
    } catch (error) { showFormError(error, form); }
  }
  if (ev.target.id === 'reflection-form') { ev.preventDefault(); try { workspace.dayUpdate(selectedDate, d => { d.note = $('day-note').value.slice(0, 3000); }); toast('Заметка сохранена.'); } catch (error) { showFormError(error, ev.target); } }
});
window.addEventListener('hashchange', () => { const next = routeFromHash(); if (next === route) return; closeModal(); route = next; render({ navigate: true }); });
window.addEventListener('storage', ev => { if (ev.key === STORAGE_KEY && workspace.sync()) { render(); toast('Записи обновлены из другого окна.'); } });
document.addEventListener('keydown', ev => {
  const tablist = ev.target.closest?.('[role="tablist"]');
  if (tablist && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) {
    const tabs = [...tablist.querySelectorAll('[role="tab"]')], index = tabs.indexOf(ev.target);
    const next = ev.key === 'Home' ? 0 : ev.key === 'End' ? tabs.length - 1 : (index + (ev.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    ev.preventDefault(); tabs[next]?.click();
    const currentTabs = [...document.querySelectorAll('[role="tablist"] [role="tab"]')]; currentTabs[next]?.focus();
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); openCommands(); }
});
window.addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); installPrompt = ev; });
window.addEventListener('appinstalled', () => { installPrompt = null; toast('RITUA установлена.'); });
window.addEventListener('online', () => { updateChrome(); });
window.addEventListener('offline', () => { updateChrome(); toast('Вы без сети. Дневник и встроенная библиотека продолжают работать.'); });
globalThis.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyPreferences());
function checkDate() {
  const today = dateKey(); if (today === currentToday) return;
  if (selectedDate === currentToday) selectedDate = today;
  currentToday = today; render();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkDate(); if (workspace.sync()) render(); } });
setInterval(checkDate, 60000);

$('app').innerHTML = views.shell(); render();
if (workspace.notice) setTimeout(() => toast(workspace.notice, { duration: 10000 }), 250);
if ('serviceWorker' in navigator && globalThis.isSecureContext) {
  let refreshing = false;
  navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { scope: new URL('../', import.meta.url).pathname }).then(reg => {
    const offer = () => { if (reg.waiting) toast('Готова новая версия RITUA.', { actionLabel: 'Обновить', duration: 15000, action: () => { refreshing = true; reg.waiting.postMessage({ type: 'SKIP_WAITING' }); } }); };
    if (reg.waiting) offer();
    reg.addEventListener('updatefound', () => { const worker = reg.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(); }); });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (refreshing) window.location.reload(); });
  }).catch(() => { /* The diary still works where service workers are unavailable. */ });
}
