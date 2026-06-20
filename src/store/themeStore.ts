/**
 * SRP: тема (dark/light), отделена от fitStore.
 */

import { createSignal } from 'solid-js';

const [isDark, setIsDark] = createSignal(
  window.matchMedia('(prefers-color-scheme: dark)').matches,
);

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  setIsDark(e.matches);
});

export { isDark };
