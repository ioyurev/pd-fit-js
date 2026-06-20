import { For } from 'solid-js';
import type { Component } from 'solid-js';
import { toasts, removeToast } from '@/store/toastStore';

export const ToastContainer: Component = () => {
  return (
    <div class="toast-container">
      <For each={toasts}>
        {(toast) => (
          <div class={`toast toast-${toast.type}`}>
            <div class="toast-content">
              <span class="toast-icon">
                {toast.type === 'success' && '✓'}
                {toast.type === 'error' && '✕'}
                {toast.type === 'warning' && '⚠'}
                {toast.type === 'info' && 'ℹ'}
              </span>
              <span class="toast-message">{toast.message}</span>
            </div>
            <button class="toast-close" onClick={() => removeToast(toast.id)}>
              ×
            </button>
          </div>
        )}
      </For>
    </div>
  );
};
