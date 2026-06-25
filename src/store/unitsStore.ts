/**
 * SRP: единица отображения температуры, отделена от fitStore и themeStore.
 * Персистируется в localStorage для удобства пользователя.
 */

import { createSignal } from 'solid-js';
import type { TempUnit } from '@/lib/temperatureUnits';

const STORAGE_KEY = 'pdfit-temp-unit';

function loadUnit(): TempUnit {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'C' || stored === 'K') return stored;
  } catch {
    // localStorage недоступен
  }
  return 'K';
}

const [tempUnit, setTempUnitRaw] = createSignal<TempUnit>(loadUnit());

export function setTempUnit(unit: TempUnit) {
  setTempUnitRaw(unit);
  try {
    localStorage.setItem(STORAGE_KEY, unit);
  } catch {
    // игнорируем
  }
}

export { tempUnit };
