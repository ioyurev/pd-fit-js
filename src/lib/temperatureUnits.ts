/**
 * SSOT для конвертации единиц температуры.
 * Внутреннее представление — всегда Кельвины (K).
 * Этот модуль — единственный источник правды для:
 * - конвертации K ↔ °C
 * - подписей осей и единиц
 * - трансформации chart datasets
 */

export type TempUnit = 'K' | 'C';

const KELVIN_OFFSET = 273.15;

/** K → display */
export function toDisplay(kelvin: number, unit: TempUnit): number {
  return unit === 'C' ? kelvin - KELVIN_OFFSET : kelvin;
}

/** display → K */
export function fromDisplay(display: number, unit: TempUnit): number {
  return unit === 'C' ? display + KELVIN_OFFSET : display;
}

/** Подпись единицы для осей и заголовков */
export function unitLabel(unit: TempUnit): string {
  return unit === 'C' ? '°C' : 'K';
}

/** KaTeX-совместимая подпись единицы */
export function unitLabelKatex(unit: TempUnit): string {
  return unit === 'C' ? '\\text{°C}' : '\\text{К}';
}

/**
 * Трансформирует datasets Chart.js, конвертируя координату y (температуру).
 * Не мутирует входные данные.
 * Пропускает datasets без точек с координатами (пустые, label-only и т.п.)
 */
export function mapDatasetsTemperature(
  datasets: any[],
  unit: TempUnit,
): any[] {
  if (unit === 'K') return datasets;

  return datasets.map(ds => {
    if (!Array.isArray(ds.data) || ds.data.length === 0) return ds;

    // Проверяем, есть ли у первого элемента свойство y (scatter/line формат)
    const first = ds.data[0];
    if (typeof first === 'object' && first !== null && 'y' in first) {
      return {
        ...ds,
        data: ds.data.map((pt: any) => ({
          ...pt,
          y: toDisplay(pt.y, unit),
        })),
      };
    }

    return ds;
  });
}

/**
 * Определяет, является ли параметр температурным по имени.
 * SSOT: все проверки «это температура?» должны идти через эту функцию.
 */
export function isTemperatureParameter(name: string): boolean {
  return /^Tfus_/.test(name) || /^Ttrans_/.test(name);
}
