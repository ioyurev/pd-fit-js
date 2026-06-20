/**
 * SRP: сериализация/десериализация state в URL, миграция legacy-форматов.
 */

import { syncToURL, loadFromURL } from '@/lib/urlState';
import type { FitParameter } from '@/lib/fitAdapter';
import { migrateToLatest, CURRENT_VERSION } from '@/lib/migrations';

export function loadPersistedState(): any | null {
  const raw = loadFromURL();
  if (!raw) return null;

  try {
    return migrateToLatest(raw);
  } catch (err) {
    console.error('Ошибка миграции URL-state:', err);
    return null;
  }
}

export interface PersistableState {
  version: number;
  systemType: string;
  compAName: string;
  compBName: string;
  dataPoints: any[];
  parameters: FitParameter[];
}

let urlSyncTimer: number | undefined;

export function debouncedSyncToURL(snapshot: Omit<PersistableState, 'version'>) {
  clearTimeout(urlSyncTimer);
  urlSyncTimer = window.setTimeout(() => {
    syncToURL({ ...snapshot, version: CURRENT_VERSION });
  }, 150);
}
