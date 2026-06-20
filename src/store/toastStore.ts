/**
 * SRP: управление уведомлениями, отделённое от fitStore.
 */

import { createStore } from 'solid-js/store';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

const [toasts, setToasts] = createStore<Toast[]>([]);

export function addToast(message: string, type: Toast['type'] = 'info', duration = 5000) {
  const id = Math.random().toString(36).substring(2, 9);
  setToasts(ts => [...ts, { id, type, message }]);
  if (duration > 0) {
    setTimeout(() => removeToast(id), duration);
  }
}

export function removeToast(id: string) {
  setToasts(ts => ts.filter(t => t.id !== id));
}

export { toasts };
