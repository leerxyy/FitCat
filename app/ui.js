import { escapeHTML as e, clamp } from './core.js';
import { icon } from './icons.js';

const fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
export const num = n => fmt.format(Number(n) || 0);
export const dateLabel = (date, options = { day: 'numeric', month: 'long' }) => new Intl.DateTimeFormat('ru-RU', options).format(new Date(`${date}T12:00:00`));
export const titleCase = s => s.charAt(0).toUpperCase() + s.slice(1);
export function btn(label, action, { value = '', cls = 'button', symbol = '', disabled = false, type = 'button', aria = '' } = {}) {
  return `<button type="${type}" class="${cls}"${action ? ` data-action="${action}"` : ''}${value !== '' ? ` data-value="${e(value)}"` : ''}${disabled ? ' disabled' : ''}${aria ? ` aria-label="${e(aria)}"` : ''}>${symbol ? icon(symbol) : ''}${label ? `<span>${label}</span>` : ''}</button>`;
}
export const iconBtn = (symbol, label, action, value = '', cls = '') => btn('', action, { value, symbol, cls: `icon-button ${cls}`, aria: label });
export const pill = (label, cls = '') => `<span class="pill ${cls}">${label}</span>`;
export const emptyState = (title, description, action = '') => `<div class="empty-state"><span class="empty-icon">${icon('leaf')}</span><h3>${title}</h3><p>${description}</p>${action}</div>`;
export function bar(value, goal, cls = '', label = '') { const percent = Math.round(clamp(value / goal) * 100); return `<div class="progress-track ${cls}" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-label="${e(label)}"><span style="width:${percent}%"></span></div>`; }
export function ring(value, goal, size = 116, cls = '') {
  const progress = clamp(value / goal);
  return `<svg width="${size}" height="${size}" viewBox="0 0 120 120" class="progress-ring ${cls}" role="img" aria-label="${Math.round(progress * 100)}% дневного ориентира"><circle class="ring-track" cx="60" cy="60" r="50"/><circle class="ring-value" cx="60" cy="60" r="50" stroke-dasharray="314.159" stroke-dashoffset="${314.159 * (1 - progress)}" transform="rotate(-90 60 60)"/></svg>`;
}
let toastTimer;
export function toast(message, { actionLabel, action, duration = 5200, error = false } = {}) {
  clearTimeout(toastTimer);
  const dialog = document.querySelector('#modal-root dialog[open]');
  let region = document.getElementById('toast-region');
  if (dialog) {
    region.innerHTML = '';
    region = dialog.querySelector('.dialog-toast-region');
    if (!region) { region = document.createElement('div'); region.className = 'dialog-toast-region'; region.setAttribute('aria-live', 'polite'); region.setAttribute('aria-atomic', 'true'); dialog.append(region); }
  }
  region.innerHTML = `<div class="toast ${error ? 'toast-error' : ''}">${icon(error ? 'info' : 'check')}<span>${e(message)}</span>${actionLabel ? `<button type="button" class="toast-action">${e(actionLabel)}</button>` : ''}<button type="button" class="toast-close" aria-label="Закрыть уведомление">${icon('close')}</button></div>`;
  region.querySelector('.toast-action')?.addEventListener('click', () => { region.innerHTML = ''; try { action?.(); } catch (err) { toast(err.message, { error: true }); } });
  region.querySelector('.toast-close').addEventListener('click', () => { region.innerHTML = ''; clearTimeout(toastTimer); });
  toastTimer = setTimeout(() => { region.innerHTML = ''; }, duration);
}
let modalCleanup;
let returnFocus;
export function closeModal() {
  const dialog = document.querySelector('#modal-root dialog');
  if (!dialog) return;
  modalCleanup?.(); modalCleanup = null;
  if (dialog.open && dialog.close) dialog.close();
  document.getElementById('modal-root').innerHTML = '';
  document.body.classList.remove('modal-open');
  returnFocus?.focus?.({ preventScroll: true }); returnFocus = null;
}
export function openModal(title, content, { wide = false, cls = '', cleanup } = {}) {
  if (document.querySelector('#modal-root dialog')) closeModal();
  returnFocus = document.activeElement;
  modalCleanup = cleanup;
  document.getElementById('modal-root').innerHTML = `<dialog class="dialog ${wide ? 'dialog-wide' : ''} ${cls}" aria-labelledby="dialog-title"><div class="dialog-header"><div><span class="eyebrow">ВАШЕ ПРОСТРАНСТВО RITUA</span><h2 id="dialog-title">${e(title)}</h2></div>${iconBtn('close', 'Закрыть окно', 'close-modal')}</div><div class="dialog-content">${content}</div></dialog>`;
  const dialog = document.querySelector('#modal-root dialog');
  dialog.addEventListener('cancel', ev => { ev.preventDefault(); closeModal(); });
  dialog.addEventListener('click', ev => { if (ev.target === dialog) { const rect = dialog.getBoundingClientRect(); if (ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) closeModal(); } });
  dialog.showModal(); document.body.classList.add('modal-open');
  const first = dialog.querySelector('[autofocus]'); if (first) first.focus();
  return dialog;
}
export function confirmDialog(title, description, onConfirm, { label = 'Продолжить', danger = false } = {}) {
  const dialog = openModal(title, `<p class="dialog-description">${description}</p><div class="dialog-actions">${btn('Отмена', 'close-modal', { cls: 'button button-ghost' })}${btn(e(label), 'confirm-dialog', { cls: `button ${danger ? 'button-danger' : 'button-primary'}` })}</div>`);
  dialog.querySelector('[data-action="confirm-dialog"]').addEventListener('click', () => { try { onConfirm(); } catch (error) { toast(error.message, { error: true }); } });
}
export function downloadFile(filename, body, type = 'application/json;charset=utf-8') {
  const blob = new Blob([body], { type }); const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const errorText = '<p class="form-error" role="alert" hidden></p>';
export function showFormError(error, form = document) { const field = form.querySelector('.form-error'); if (field) { field.textContent = error.message || String(error); field.hidden = false; field.scrollIntoView?.({ block: 'nearest' }); } else toast(error.message, { error: true }); }
export function field(label, id, value = '', attrs = '', { type = 'text', hint = '', required = false } = {}) {
  return `<label class="field" for="${id}"><span>${label}${required ? ' <span class="required">*</span>' : ''}</span><input id="${id}" name="${id}" type="${type}" value="${e(value)}" ${attrs}${required ? ' required' : ''}>${hint ? `<small>${hint}</small>` : ''}</label>`;
}
