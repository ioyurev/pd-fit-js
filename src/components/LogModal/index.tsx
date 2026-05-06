import { For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { state, toggleLog } from '../../store/fitStore';

export const LogModal: Component = () => {
  return (
    <Show when={state.isLogOpen}>
      <div class="modal-overlay" onClick={toggleLog}>
        {/* Остановка всплытия клика, чтобы закрывалось только по клику на фон */}
        <div class="modal-content" onClick={(e) => e.stopPropagation()}>
          <div class="modal-header">
            <h3>Лог работы</h3>
            <button class="btn-delete" onClick={toggleLog}>Закрыть</button>
          </div>
          <pre class="log-pre">
            <For each={state.log}>
              {(msg) => <div>{msg}</div>}
            </For>
          </pre>
        </div>
      </div>
    </Show>
  );
};
