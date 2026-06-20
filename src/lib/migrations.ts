/**
 * SSOT для версионирования и миграции проектных данных.
 *
 * Правила:
 * 1. CURRENT_VERSION инкрементируется при любом изменении схемы.
 * 2. Каждая миграция v→v+1 — отдельная чистая функция.
 * 3. migrateToLatest() прогоняет цепочку миграций последовательно.
 * 4. Используется и для .pdfit файлов, и для URL-state.
 */

import { decodeBranch } from '@/lib/types';

/**
 * Текущая версия схемы данных проекта.
 * Инкрементировать при каждом изменении формата.
 *
 * История:
 *   0 — legacy (до введения версионирования, URL без version, старые branch-строки)
 *   1 — первая версионированная схема:
 *       - BranchDef вместо строк
 *       - systemType
 *       - boundsEnabled
 *       - compound parameters
 *       - isomorphous support (_liq / _sol)
 */
export const CURRENT_VERSION = 1;

/** Максимальная версия, которую мы можем прочитать */
export const MAX_SUPPORTED_VERSION = CURRENT_VERSION;

// ─── Типы ────────────────────────────────────────────────────────────────────

/** Минимальный контракт: объект с необязательным version */
export interface VersionedData {
  version?: number;
  [key: string]: any;
}

export class UnsupportedVersionError extends Error {
  constructor(fileVersion: number) {
    super(
      `Файл создан в более новой версии приложения (v${fileVersion}). ` +
      `Текущая версия поддерживает до v${MAX_SUPPORTED_VERSION}. ` +
      `Обновите приложение.`,
    );
    this.name = 'UnsupportedVersionError';
  }
}

// ─── Миграции ────────────────────────────────────────────────────────────────

type MigrationFn = (data: any) => any;

/**
 * Реестр миграций: ключ — версия ДО миграции, значение — функция,
 * которая принимает данные этой версии и возвращает данные следующей.
 *
 * migrate_0_to_1: legacy → v1
 */
const MIGRATIONS: Record<number, MigrationFn> = {
  0: migrate_0_to_1,
};

function migrate_0_to_1(data: any): any {
  const result = { ...data };

  // 1. Версия
  result.version = 1;

  // 2. systemType
  if (!result.systemType) {
    const hasLensParams = result.parameters?.some(
      (p: any) => p.name?.includes('_sol') || p.name?.includes('_liq'),
    );
    const hasLensPoints = result.dataPoints?.some(
      (p: any) => p.branch?.type === 'lens',
    );
    result.systemType = (hasLensParams || hasLensPoints) ? 'isomorphous' : 'eutectic';
  }

  // 3. Миграция имён параметров
  const PARAM_RENAMES: Record<string, string> = {
    'Ttrans_A': 'Ttrans_A_0',
    'dHtrans_A': 'dHtrans_A_0',
    'Ttrans_B': 'Ttrans_B_0',
    'dHtrans_B': 'dHtrans_B_0',
  };

  if (result.parameters) {
    result.parameters = result.parameters.map((p: any) => {
      const name = PARAM_RENAMES[p.name] ?? p.name;
      const val = p.value ?? 0;

      return {
        name,
        value: val,
        fixed: p.fixed ?? true,
        min: p.min ?? (val < 0 ? val * 2 : val * 0.5),
        max: p.max ?? (val < 0 ? val * 0.5 : val * 2),
        boundsEnabled: p.boundsEnabled ?? false,
      };
    });
  }

  // 4. Миграция ветвей (строки → BranchDef)
  if (result.dataPoints) {
    result.dataPoints = result.dataPoints.map((p: any) => {
      // Старые ветви: "A", "B", "eutectic", "Ttrans_A_0", ...
      const branch = typeof p.branch === 'string'
        ? decodeBranch(p.branch)
        : (p.branch ?? { type: 'pure', comp: 'A' });

      // Убираем weight (SSOT: вычисляется из sigma)
      const { weight: _w, ...rest } = p;

      return {
        ...rest,
        sigma: p.sigma ?? 1,
        branch,
      };
    });
  }

  // 5. Имена компонентов
  if (!result.compAName) result.compAName = 'A';
  if (!result.compBName) result.compBName = 'B';

  return result;
}

// ─── Публичный API ───────────────────────────────────────────────────────────

/**
 * Определяет версию данных.
 * Если поле version отсутствует — считаем legacy (v0).
 */
export function detectVersion(data: any): number {
  if (!data || typeof data !== 'object') return 0;
  if (typeof data.version === 'number' && data.version >= 0) return data.version;
  return 0;
}

/**
 * Применяет все необходимые миграции от текущей версии данных до CURRENT_VERSION.
 * Бросает UnsupportedVersionError если версия файла новее текущей.
 *
 * Чистая функция: не мутирует вход.
 */
export function migrateToLatest(raw: any): any {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Невалидные данные для миграции.');
  }

  let version = detectVersion(raw);

  if (version > MAX_SUPPORTED_VERSION) {
    throw new UnsupportedVersionError(version);
  }

  // Если уже актуальная версия — ничего не делаем
  if (version === CURRENT_VERSION) {
    return { ...raw };
  }

  // Последовательно прогоняем миграции
  let data = { ...raw };

  while (version < CURRENT_VERSION) {
    const migrateFn = MIGRATIONS[version];
    if (!migrateFn) {
      throw new Error(
        `Отсутствует миграция v${version} → v${version + 1}. ` +
        `Это баг — обратитесь к разработчику.`,
      );
    }
    data = migrateFn(data);
    version++;
  }

  return data;
}

/**
 * Полная валидация и нормализация данных после миграции.
 * Гарантирует что все обязательные поля присутствуют.
 */
export function normalizeProjectData(data: any): {
  version: number;
  systemType: 'eutectic' | 'isomorphous';
  compAName: string;
  compBName: string;
  parameters: any[];
  dataPoints: any[];
} {
  const migrated = migrateToLatest(data);

  return {
    version: CURRENT_VERSION,
    systemType: migrated.systemType ?? 'eutectic',
    compAName: migrated.compAName ?? 'A',
    compBName: migrated.compBName ?? 'B',
    parameters: Array.isArray(migrated.parameters) ? migrated.parameters : [],
    dataPoints: Array.isArray(migrated.dataPoints) ? migrated.dataPoints : [],
  };
}
