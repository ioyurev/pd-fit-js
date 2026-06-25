/**
 * Модуль экспорта параметров и ликвидуса в CSV/XLSX.
 * SRP: только форматирование и запись файлов.
 */

import { utils, writeFile } from 'xlsx';
import type { FitParameter } from '@/lib/fitAdapter';
import type { LiquidusRow } from '@/store/fitSelectors';
import type { TempUnit } from '@/lib/temperatureUnits';
import { toDisplay, unitLabel } from '@/lib/temperatureUnits';

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportParamsCSV(
  params: FitParameter[],
  errors: Record<string, number>,
  chiSq: number,
  rwpVal: number,
) {
  const lines = [
    'Параметр,Значение,Погрешность,Фиксирован',
    ...params.map(p => {
      const err = p.fixed
        ? 'фикс.'
        : (errors[p.name] !== undefined ? errors[p.name].toFixed(6) : '—');
      return `${p.name},${p.value.toFixed(6)},${err},${p.fixed ? 'да' : 'нет'}`;
    }),
    '',
    `chi2,${chiSq.toFixed(6)},,`,
    `Rwp,${(rwpVal * 100).toFixed(4)}%,,`,
  ];
  downloadCSV('parameters.csv', lines.join('\r\n'));
}

export function exportParamsXLSX(
  params: FitParameter[],
  errors: Record<string, number>,
  chiSq: number,
  rwpVal: number,
) {
  const data = params.map(p => ({
    'Параметр': p.name,
    'Значение': p.value,
    'Погрешность': p.fixed ? 'фикс.' : (errors[p.name] ?? null),
    'Фиксирован': p.fixed ? 'да' : 'нет',
  }));
  const ws = utils.json_to_sheet(data);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Parameters');
  utils.sheet_add_aoa(ws, [
    [],
    ['chi2', chiSq],
    ['Rwp (%)', rwpVal * 100],
  ], { origin: -1 });
  writeFile(wb, 'parameters.xlsx');
}

export function exportLiquidusCSV(
  rows: LiquidusRow[],
  unit: TempUnit = 'K',
) {
  const lines = [
    `xB,T_liquidus (${unitLabel(unit)}),Stable phase`,
    ...rows.map(r => `${r.xB.toFixed(4)},${toDisplay(r.T_liq, unit).toFixed(4)},${r.phaseId}`),
  ];
  downloadCSV('liquidus.csv', lines.join('\r\n'));
}

export function exportLiquidusXLSX(
  rows: LiquidusRow[],
  unit: TempUnit = 'K',
) {
  const data = rows.map(r => ({
    xB: r.xB,
    [`T_liquidus (${unitLabel(unit)})`]: toDisplay(r.T_liq, unit),
    'Stable phase': r.phaseId,
  }));
  const ws = utils.json_to_sheet(data);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Liquidus');
  writeFile(wb, 'liquidus.xlsx');
}
