/**
 * SRP: состояние текущего файла проекта.
 * SSOT: единственный источник правды об имени файла, хэндле и состоянии «изменён».
 */

import { createSignal } from 'solid-js';
import { hasFileSystemAccess } from '@/lib/projectFile';

const DEFAULT_TITLE = 'Без названия';

const [fileName, setFileName] = createSignal<string | null>(null);
const [isDirty, setIsDirty] = createSignal(false);
const [fileHandle, setFileHandle] = createSignal<FileSystemFileHandle | null>(null);

/** Есть ли у нас активный хэндл, в который можно сохранять in-place */
export function canSaveInPlace(): boolean {
  return fileHandle() !== null;
}

/** Поддерживает ли браузер нативное сохранение */
export function supportsNativeSave(): boolean {
  return hasFileSystemAccess();
}

/** Отображаемое имя проекта (без расширения) */
export function displayName(): string {
  const name = fileName();
  if (!name) return DEFAULT_TITLE;
  return name.replace(/\.pdfit$/i, '');
}

/** Полный заголовок для header */
export function windowTitle(): string {
  const name = displayName();
  const dirty = isDirty() ? ' •' : '';
  return `${name}${dirty} — PD-Fit JS`;
}

export function markDirty() {
  setIsDirty(true);
}

export function markClean() {
  setIsDirty(false);
}

export function setCurrentFile(name: string | null, handle: FileSystemFileHandle | null = null) {
  setFileName(name);
  setFileHandle(handle);
  setIsDirty(false);
}

export function clearCurrentFile() {
  setFileName(null);
  setFileHandle(null);
  setIsDirty(false);
}

export function getFileHandle(): FileSystemFileHandle | null {
  return fileHandle();
}

export { fileName, isDirty };
