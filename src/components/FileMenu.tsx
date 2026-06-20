import { createSignal, Show, onMount, onCleanup, createEffect } from 'solid-js';
import type { Component } from 'solid-js';
import { state, loadProject } from '@/store/fitStore';
import { addToast } from '@/store/toastStore';
import {
  fileName,
  isDirty,
  displayName,
  setCurrentFile,
  clearCurrentFile,
  supportsNativeSave,
  getFileHandle,
} from '@/store/fileStore';
import {
  serializeProject,
  deserializeProject,
  openProjectFile,
  saveToHandle,
  saveAsViaFSA,
  downloadFile,
  hasFileSystemAccess,
  PROJECT_FILE_EXTENSION,
} from '@/lib/projectFile';
import { createDefaultParameters } from '@/lib/parameterSchema';
import { unwrap } from 'solid-js/store';

export const FileMenu: Component = () => {
  const [menuOpen, setMenuOpen] = createSignal(false);

  let menuRef: HTMLDivElement | undefined;

  const closeMenu = () => setMenuOpen(false);

  const toggleMenu = () => setMenuOpen(v => !v);

  // Закрытие при клике снаружи
  createEffect(() => {
    if (!menuOpen()) return;

    const handler = (e: MouseEvent) => {
      if (menuRef && !menuRef.contains(e.target as Node)) {
        closeMenu();
      }
    };

    const timer = window.setTimeout(() => {
      document.addEventListener('click', handler);
    }, 0);

    onCleanup(() => {
      clearTimeout(timer);
      document.removeEventListener('click', handler);
    });
  });

  const confirmUnsaved = (): boolean => {
    if (!isDirty()) return true;
    return window.confirm(
      'Текущий проект содержит несохранённые изменения.\nПродолжить без сохранения?',
    );
  };

  const getProjectContent = () =>
    serializeProject({
      systemType: state.systemType,
      compAName: state.compAName,
      compBName: state.compBName,
      parameters: unwrap(state.parameters),
      dataPoints: unwrap(state.dataPoints),
    });

  // ── Новый ──

  const handleNew = () => {
    closeMenu();
    if (!confirmUnsaved()) return;

    loadProject({
      systemType: 'eutectic',
      compAName: 'A',
      compBName: 'B',
      parameters: createDefaultParameters('eutectic'),
      dataPoints: [],
    });
    clearCurrentFile();
    addToast('Новый проект создан.', 'info', 3000);
  };

  // ── Открыть ──

  const handleOpen = async () => {
    closeMenu();
    if (!confirmUnsaved()) return;

    try {
      const { name, content, handle } = await openProjectFile();
      const project = deserializeProject(content);

      loadProject({
        systemType: project.systemType,
        compAName: project.compAName,
        compBName: project.compBName,
        parameters: project.parameters,
        dataPoints: project.dataPoints,
      });

      setCurrentFile(name, handle);
      addToast(`Проект «${name}» открыт.`, 'success', 3000);
    } catch (err: any) {
      if (
        err?.message === 'Отменено пользователем.' ||
        err?.name === 'AbortError'
      ) return;
      console.error(err);
      addToast(`Ошибка открытия: ${err.message}`, 'error', 6000);
    }
  };

  // ── Закрыть ──

  const handleClose = () => {
    closeMenu();
    if (!confirmUnsaved()) return;

    loadProject({
      systemType: 'eutectic',
      compAName: 'A',
      compBName: 'B',
      parameters: createDefaultParameters('eutectic'),
      dataPoints: [],
    });
    clearCurrentFile();
    addToast('Проект закрыт.', 'info', 3000);
  };

  // ── Сохранить (in-place через хэндл) ──

  const handleSave = async () => {
    closeMenu();
    const handle = getFileHandle();
    if (handle) {
      const content = getProjectContent();
      const ok = await saveToHandle(handle, content);
      if (ok) {
        setCurrentFile(fileName()!, handle);
        addToast('Проект сохранён.', 'success', 3000);
      } else {
        addToast('Не удалось записать файл. Попробуйте «Сохранить как».', 'error', 5000);
      }
    } else {
      // Нет хэндла → вызываем Save As
      await handleSaveAs();
    }
  };

  // ── Сохранить как (FSA) ──

  const handleSaveAs = async () => {
    closeMenu();
    const content = getProjectContent();
    const suggestedName = fileName() ?? 'project.pdfit';

    if (hasFileSystemAccess()) {
      const result = await saveAsViaFSA(content, suggestedName);
      if (result) {
        setCurrentFile(result.name, result.handle);
        addToast(`Проект сохранён как «${result.name}».`, 'success', 3000);
      }
      // null = отменено
    } else {
      // Fallback — скачать
      const finalName = suggestedName.endsWith(PROJECT_FILE_EXTENSION)
        ? suggestedName
        : suggestedName + PROJECT_FILE_EXTENSION;
      downloadFile(finalName, content);
      // При download мы не получаем хэндл → остаёмся без in-place сохранения
      setCurrentFile(finalName, null);
      addToast(`Файл «${finalName}» скачан.`, 'success', 3000);
    }
  };

  // ── Скачать (fallback — всегда доступно) ──

  const handleDownload = () => {
    closeMenu();
    const content = getProjectContent();
    const name = fileName() ?? 'project.pdfit';
    const finalName = name.endsWith(PROJECT_FILE_EXTENSION) ? name : name + PROJECT_FILE_EXTENSION;
    downloadFile(finalName, content);
    addToast(`Файл «${finalName}» скачан.`, 'success', 3000);
  };

  // ── Горячие клавиши ──

  onMount(() => {
    const onSave = () => handleSave();
    const onSaveAs = () => handleSaveAs();
    const onOpen = () => handleOpen();
    const onNew = () => handleNew();
    const onClose = () => handleClose();
    const onDownload = () => handleDownload();

    document.addEventListener('pdfit:save', onSave);
    document.addEventListener('pdfit:save-as', onSaveAs);
    document.addEventListener('pdfit:open', onOpen);
    document.addEventListener('pdfit:new', onNew);
    document.addEventListener('pdfit:close', onClose);
    document.addEventListener('pdfit:download', onDownload);

    onCleanup(() => {
      document.removeEventListener('pdfit:save', onSave);
      document.removeEventListener('pdfit:save-as', onSaveAs);
      document.removeEventListener('pdfit:open', onOpen);
      document.removeEventListener('pdfit:new', onNew);
      document.removeEventListener('pdfit:close', onClose);
      document.removeEventListener('pdfit:download', onDownload);
    });
  });

  // Определяем, какие пункты показывать
  const nativeSave = supportsNativeSave();

  return (
    <div class="file-menu-wrap" ref={menuRef}>
      <button class="file-menu-trigger" onClick={toggleMenu}>
        <span class="file-menu-icon">☰</span>
        <span class="file-menu-name">
          {displayName()}
          <Show when={isDirty()}>
            <span class="file-dirty-dot"> •</span>
          </Show>
        </span>
        <span class="file-menu-caret">▾</span>
      </button>

      <Show when={menuOpen()}>
        <div class="file-menu-dropdown">
          <button class="file-menu-item" onClick={handleNew}>
            <span class="file-menu-item-icon">📄</span>
            <span>Новый</span>
            <span class="file-menu-shortcut">Ctrl+N</span>
          </button>
          <button class="file-menu-item" onClick={handleOpen}>
            <span class="file-menu-item-icon">📂</span>
            <span>Открыть…</span>
            <span class="file-menu-shortcut">Ctrl+O</span>
          </button>
          <button class="file-menu-item" onClick={handleClose}>
            <span class="file-menu-item-icon">✖</span>
            <span>Закрыть</span>
            <span class="file-menu-shortcut">Ctrl+W</span>
          </button>

          <div class="file-menu-divider" />

          {/* Нативное сохранение — только если FSA доступен */}
          <Show when={nativeSave}>
            <button class="file-menu-item" onClick={handleSave}>
              <span class="file-menu-item-icon">💾</span>
              <span>Сохранить</span>
              <span class="file-menu-shortcut">Ctrl+S</span>
            </button>
            <button class="file-menu-item" onClick={handleSaveAs}>
              <span class="file-menu-item-icon">📋</span>
              <span>Сохранить как…</span>
              <span class="file-menu-shortcut">Ctrl+Shift+S</span>
            </button>
          </Show>

          {/* Скачивание — всегда (единственная кнопка если FSA нет) */}
          <button class="file-menu-item" onClick={handleDownload}>
            <span class="file-menu-item-icon">⬇</span>
            <span>Скачать{nativeSave ? ' копию' : ''}</span>
            <span class="file-menu-shortcut">{nativeSave ? '' : 'Ctrl+S'}</span>
          </button>
        </div>
      </Show>
    </div>
  );
};
