/**
 * SRP: сериализация/десериализация проекта в файл.
 * Единственный источник правды о формате файла проекта.
 *
 * Поддерживает File System Access API (Chrome/Edge) с fallback на download.
 */

import type { FitParameter } from '@/lib/fitAdapter';
import type { BranchDef } from '@/lib/types';
import type { SystemType } from '@/lib/parameterSchema';
import { CURRENT_VERSION, migrateToLatest } from '@/lib/migrations';

export const PROJECT_FILE_EXTENSION = '.pdfit';
export const PROJECT_FILE_MIME = 'application/json';

export interface ProjectDataPoint {
  xB: number;
  T: number;
  sigma: number;
  branch: BranchDef;
}

export interface ProjectFile {
  version: number;
  systemType: SystemType;
  lossType?: string;
  huberBeta?: number;
  compAName: string;
  compBName: string;
  parameters: FitParameter[];
  dataPoints: ProjectDataPoint[];
}

// ─── Сериализация ────────────────────────────────────────────────────────────

export function serializeProject(data: {
  systemType: SystemType;
  lossType?: string;
  huberBeta?: number;
  compAName: string;
  compBName: string;
  parameters: FitParameter[];
  dataPoints: ProjectDataPoint[];
}): string {
  const project: ProjectFile = {
    version: CURRENT_VERSION,
    systemType: data.systemType,
    lossType: data.lossType ?? 'L2',
    huberBeta: data.huberBeta ?? 10,
    compAName: data.compAName,
    compBName: data.compBName,
    parameters: data.parameters.map(p => ({
      name: p.name,
      value: p.value,
      fixed: p.fixed,
      min: p.min,
      max: p.max,
      boundsEnabled: p.boundsEnabled ?? false,
    })),
    dataPoints: data.dataPoints.map(dp => ({
      xB: dp.xB,
      T: dp.T,
      sigma: dp.sigma,
      branch: dp.branch,
    })),
  };
  return JSON.stringify(project, null, 2);
}

export function deserializeProject(json: string): ProjectFile {
  let raw: any;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Файл не содержит валидный JSON.');
  }

  if (!raw || typeof raw !== 'object') {
    throw new Error('Файл не содержит валидный JSON-объект.');
  }

  // Минимальная проверка: должен быть хотя бы массив parameters
  if (!raw.parameters && !raw.dataPoints) {
    throw new Error('Файл не является проектом PD-Fit.');
  }

  // Миграция до актуальной версии (бросит UnsupportedVersionError если файл из будущего)
  const migrated = migrateToLatest(raw);

  // Нормализация полей после миграции
  const parameters: FitParameter[] = (migrated.parameters ?? []).map((p: any) => ({
    name: p.name ?? '',
    value: p.value ?? 0,
    fixed: p.fixed ?? true,
    min: p.min ?? -Infinity,
    max: p.max ?? Infinity,
    boundsEnabled: p.boundsEnabled ?? false,
  }));

  const dataPoints: ProjectDataPoint[] = (migrated.dataPoints ?? []).map((dp: any) => ({
    xB: dp.xB ?? 0,
    T: dp.T ?? 0,
    sigma: dp.sigma ?? 1,
    branch: dp.branch ?? { type: 'pure', comp: 'A' },
  }));

  return {
    version: CURRENT_VERSION,
    systemType: migrated.systemType ?? 'eutectic',
    lossType: migrated.lossType ?? 'L2',
    huberBeta: migrated.huberBeta ?? 10,
    compAName: migrated.compAName ?? 'A',
    compBName: migrated.compBName ?? 'B',
    parameters,
    dataPoints,
  };
}

// ─── File System Access API detection ────────────────────────────────────────

/** Доступен ли File System Access API (showSaveFilePicker / showOpenFilePicker) */
export function hasFileSystemAccess(): boolean {
  return (
    typeof window !== 'undefined' &&
    'showSaveFilePicker' in window &&
    'showOpenFilePicker' in window
  );
}

const FILE_PICKER_TYPES = [
  {
    description: 'PD-Fit Project',
    accept: { [PROJECT_FILE_MIME]: [PROJECT_FILE_EXTENSION] },
  },
];

// ─── Открытие файла ──────────────────────────────────────────────────────────

export interface OpenResult {
  name: string;
  content: string;
  /** Хэндл для последующего save-in-place. null если открыто через fallback. */
  handle: FileSystemFileHandle | null;
}

/**
 * Открывает файл проекта.
 * Если File System Access API доступен — через showOpenFilePicker (хэндл сохраняется).
 * Иначе — через <input type="file"> (хэндл = null, сохранение = только скачивание).
 */
export async function openProjectFile(): Promise<OpenResult> {
  if (hasFileSystemAccess()) {
    return openViaFSA();
  }
  return openViaInput();
}

async function openViaFSA(): Promise<OpenResult> {
  const [handle] = await (window as any).showOpenFilePicker({
    types: FILE_PICKER_TYPES,
    multiple: false,
  });
  const file: File = await handle.getFile();
  const content = await file.text();
  return { name: file.name, content, handle };
}

function openViaInput(): Promise<OpenResult> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `${PROJECT_FILE_EXTENSION},.json`;

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('Файл не выбран.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        resolve({ name: file.name, content: reader.result as string, handle: null });
      };
      reader.onerror = () => reject(new Error('Ошибка чтения файла.'));
      reader.readAsText(file);
    });

    input.addEventListener('cancel', () => {
      reject(new Error('Отменено пользователем.'));
    });

    input.click();
  });
}

// ─── Сохранение файла ────────────────────────────────────────────────────────

/**
 * Сохраняет содержимое в существующий хэндл (File System Access API).
 * Возвращает true при успехе, false если прав нет.
 */
export async function saveToHandle(
  handle: FileSystemFileHandle,
  content: string,
): Promise<boolean> {
  try {
    const writable = await (handle as any).createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Показывает «Сохранить как» через File System Access API.
 * Возвращает новый хэндл + имя файла. Или null если отменено.
 */
export async function saveAsViaFSA(
  content: string,
  suggestedName: string,
): Promise<{ handle: FileSystemFileHandle; name: string } | null> {
  try {
    const handle: FileSystemFileHandle = await (window as any).showSaveFilePicker({
      suggestedName,
      types: FILE_PICKER_TYPES,
    });
    const writable = await (handle as any).createWritable();
    await writable.write(content);
    await writable.close();
    const file = await handle.getFile();
    return { handle, name: file.name };
  } catch {
    // Пользователь отменил
    return null;
  }
}

/**
 * Fallback: скачать файл через <a download>.
 */
export function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: PROJECT_FILE_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
